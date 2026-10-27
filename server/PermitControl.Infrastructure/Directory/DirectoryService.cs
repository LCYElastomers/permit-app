using System.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using PermitControl.Application;
using PermitControl.Domain;
using PermitControl.Infrastructure.Persistence;

namespace PermitControl.Infrastructure.Identity;

public sealed class DirectoryService(PermitDbContext database) : IPlantDirectory
{
    private readonly IPinHasher hasher = Argon2PinHasher.Interactive;

    public async Task<IdentityBootstrap> OpenWindowsAsync(string? domain, string? username, CancellationToken cancellationToken)
    {
        var (normalizedDomain, name) = WindowsAccounts.Normalize(domain, username);
        var users = string.IsNullOrEmpty(name)
            ? []
            : await database.Users.Where(user => user.Enabled && user.WindowsUsername.ToLower() == name).ToListAsync(cancellationToken);
        var matches = users.Where(user => WindowsAccounts.DomainMatches(user, normalizedDomain)).ToList();
        if (matches.Count != 1)
        {
            var choices = await database.Users.AsNoTracking().Where(user => user.Enabled)
                .OrderBy(user => user.PermitUserCode)
                .Select(user => new UserChoice(user.Id, user.PermitUserCode, user.DisplayName, user.JobTitle))
                .ToListAsync(cancellationToken);
            return new IdentityBootstrap("select", null, choices);
        }

        var session = await IssueAsync(matches[0], cancellationToken);
        return new IdentityBootstrap("mapped", session, []);
    }

    public async Task<SessionStart> ConfirmAsync(Guid userId, string pin, Guid? deviceId, CancellationToken cancellationToken)
    {
        var user = await database.Users.FirstOrDefaultAsync(item => item.Id == userId && item.Enabled, cancellationToken);
        if (user is null) throw new DirectoryRejected("pin-not-accepted");
        await using var transaction = await database.Database.BeginTransactionAsync(cancellationToken);
        var credential = await CredentialAsync(userId, cancellationToken);
        var error = Apply(PinCommands.Verify(credential, pin, Now(), hasher, deviceId));
        if (error is null && credential.State != PinCredentialState.ACTIVE) error = "pin-not-enrolled";
        if (error is not null)
        {
            await database.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            throw new DirectoryRejected(error);
        }

        var session = await IssueAsync(user, cancellationToken);
        await database.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return session;
    }

    public async Task<UserProfileView?> CurrentAsync(string? token, CancellationToken cancellationToken)
    {
        var actor = await ActorAsync(token, cancellationToken);
        return actor is null ? null : await ViewAsync(actor.User, false, cancellationToken);
    }

    public Task<string?> EnrollAsync(string? token, string pin, string confirm, Guid? deviceId, CancellationToken cancellationToken) =>
        PinAsync(token, (credential, history, now) => PinCommands.Enroll(credential, history, pin, confirm, now, hasher, deviceId), cancellationToken);

    public Task<string?> ChangePinAsync(string? token, string currentPin, string nextPin, string confirm, Guid? deviceId, CancellationToken cancellationToken) =>
        PinAsync(token, (credential, history, now) => PinCommands.Change(credential, history, currentPin, nextPin, confirm, now, hasher, deviceId), cancellationToken);

    public async Task<IReadOnlyList<UserProfileView>> ListUsersAsync(string? token, string? search, bool? enabled, CancellationToken cancellationToken)
    {
        var actor = await RequireAsync(token, nameof(AppRole.ADMIN), cancellationToken);
        var query = database.Users.AsNoTracking().AsQueryable();
        if (enabled is not null) query = query.Where(user => user.Enabled == enabled);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(user => user.DisplayName.ToLower().Contains(term) || user.PermitUserCode.ToLower().Contains(term) || user.WindowsUsername.ToLower().Contains(term) || user.JobTitle.ToLower().Contains(term));
        }

        var users = await query.OrderBy(user => user.PermitUserCode).ToListAsync(cancellationToken);
        var views = new List<UserProfileView>();
        foreach (var user in users) views.Add(await ViewAsync(user, PermitCapabilities.Has(actor.Roles, nameof(AppRole.ADMIN)), cancellationToken));
        return views;
    }

    public async Task<UserProfileView?> GetUserAsync(string? token, Guid userId, CancellationToken cancellationToken)
    {
        await RequireAsync(token, nameof(AppRole.ADMIN), cancellationToken);
        var user = await database.Users.AsNoTracking().FirstOrDefaultAsync(item => item.Id == userId, cancellationToken);
        return user is null ? null : await ViewAsync(user, true, cancellationToken);
    }

    public async Task<(string? Error, UserProfileView? User)> CreateUserAsync(string? token, UserProfileEdit edit, CancellationToken cancellationToken)
    {
        var actor = await RequireAsync(token, nameof(AppRole.ADMIN), cancellationToken);
        if (edit.Roles.Any(role => !PermitCapabilities.Known(role))) return ("role-invalid", null);
        var (domain, username) = WindowsAccounts.Normalize(edit.WindowsDomain, edit.WindowsUsername);
        if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(edit.DisplayName)) return ("profile-invalid", null);
        await using var transaction = await database.Database.BeginTransactionAsync(cancellationToken);
        var sequence = await AllocateCodeAsync(cancellationToken);
        var now = Now();
        var code = UserCodes.Format(sequence);
        var user = new User
        {
            Id = Guid.NewGuid(),
            PermitUserCode = code,
            Username = string.IsNullOrEmpty(domain) ? username : $"{domain}\\{username}",
            DisplayName = edit.DisplayName.Trim(),
            Email = $"{code.ToLowerInvariant()}@permit-control.local",
            WindowsDomain = domain ?? "",
            WindowsUsername = username,
            PersonnelReference = edit.PersonnelReference.Trim(),
            PersonnelCode = edit.PersonnelCode.Trim(),
            JobTitle = edit.JobTitle.Trim(),
            Department = edit.Department?.Trim(),
            Enabled = edit.Enabled,
            AuthProvider = AuthProvider.LOCAL,
            CreatedAt = now,
        };
        database.Users.Add(user);
        database.UserCredentials.Add(new UserCredential { Id = Guid.NewGuid(), UserId = user.Id, State = PinCredentialState.NOT_ENROLLED, CreatedAt = now });
        foreach (var role in edit.Roles.Distinct(StringComparer.Ordinal))
        {
            var roleId = await database.Roles.Where(item => item.Name == role).Select(item => item.Id).FirstAsync(cancellationToken);
            database.UserRoles.Add(new UserRole { UserId = user.Id, RoleId = roleId });
        }

        if (edit.UpdateContact)
        {
            var email = string.IsNullOrWhiteSpace(edit.Email) ? user.Email : edit.Email;
            var contactError = await ApplyContactAsync(user, actor.User.Id, email, edit.MobilePhone, edit.AlternatePhone, null, cancellationToken);
            if (contactError is not null) return (contactError, null);
        }

        await database.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return (null, await ViewAsync(user, true, cancellationToken));
    }

    public async Task<string?> UpdateUserAsync(string? token, Guid userId, UserProfileEdit edit, CancellationToken cancellationToken)
    {
        var actor = await RequireAsync(token, nameof(AppRole.ADMIN), cancellationToken);
        var user = await database.Users.FirstOrDefaultAsync(item => item.Id == userId, cancellationToken);
        if (user is null) return "user-not-found";
        var code = user.PermitUserCode;
        var (domain, username) = WindowsAccounts.Normalize(edit.WindowsDomain, edit.WindowsUsername);
        user.DisplayName = edit.DisplayName.Trim();
        user.WindowsDomain = domain ?? "";
        user.WindowsUsername = username;
        user.Username = string.IsNullOrEmpty(domain) ? username : $"{domain}\\{username}";
        user.PersonnelReference = edit.PersonnelReference.Trim();
        user.PersonnelCode = edit.PersonnelCode.Trim();
        user.JobTitle = edit.JobTitle.Trim();
        user.Department = edit.Department?.Trim();
        user.Enabled = edit.Enabled;
        user.UpdatedAt = Now();
        if (user.PermitUserCode != code) return "identity-changed";
        if (edit.UpdateContact)
        {
            var contactError = await ApplyContactAsync(user, actor.User.Id, edit.Email, edit.MobilePhone, edit.AlternatePhone, null, cancellationToken);
            if (contactError is not null) return contactError;
        }
        user.UpdatedAt = Now();
        await database.SaveChangesAsync(cancellationToken);
        return null;
    }

    public async Task<(string? Error, UserProfileView? User)> UpdateOwnProfileAsync(string? token, SelfProfileEdit edit, CancellationToken cancellationToken)
    {
        var actor = await ActorAsync(token, cancellationToken) ?? throw new DirectoryRejected("session-required");
        var user = await database.Users.FirstOrDefaultAsync(item => item.Id == actor.User.Id, cancellationToken);
        if (user is null) return ("user-not-found", null);
        var error = await ApplyContactAsync(
            user,
            actor.User.Id,
            edit.Email,
            edit.MobilePhone,
            edit.AlternatePhone,
            edit.Preferences?.Select(item => (item.Channel, item.Topic, item.Enabled)).ToArray() ?? [],
            cancellationToken);
        if (error is not null) return (error, null);
        await database.SaveChangesAsync(cancellationToken);
        return (null, await ViewAsync(user, false, cancellationToken));
    }

    public async Task<string?> SetRolesAsync(string? token, Guid userId, IReadOnlyList<string> roles, string? pin, Guid? deviceId, CancellationToken cancellationToken)
    {
        var actor = await RequireAsync(token, nameof(AppRole.ADMIN), cancellationToken);
        if (roles.Any(role => !PermitCapabilities.Known(role))) return "role-invalid";
        var current = await RoleNamesAsync(userId, cancellationToken);
        var sensitive = roles.Concat(current).Any(role => role is nameof(AppRole.SUPER_ADMIN) or nameof(AppRole.PERMIT_AUTHORIZER));
        await using var transaction = await database.Database.BeginTransactionAsync(cancellationToken);
        if (sensitive)
        {
            if (!PermitCapabilities.Has(actor.Roles, nameof(AppRole.SUPER_ADMIN))) return "capability-required";
            var error = Apply(PinCommands.Verify(await CredentialAsync(actor.User.Id, cancellationToken), pin ?? "", Now(), hasher, deviceId));
            if (error is not null)
            {
                await database.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);
                return error;
            }
        }

        var existing = await database.UserRoles.Where(item => item.UserId == userId).ToListAsync(cancellationToken);
        database.UserRoles.RemoveRange(existing);
        foreach (var role in roles.Distinct(StringComparer.Ordinal))
        {
            var roleId = await database.Roles.Where(item => item.Name == role).Select(item => item.Id).FirstAsync(cancellationToken);
            database.UserRoles.Add(new UserRole { UserId = userId, RoleId = roleId });
        }

        await database.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return null;
    }

    public async Task<string?> AddQualificationAsync(string? token, Guid userId, string qualification, CancellationToken cancellationToken)
    {
        await RequireAsync(token, nameof(AppRole.ADMIN), cancellationToken);
        if (!Enum.TryParse<QualificationType>(qualification, out var type) || !Enum.IsDefined(type)) return "qualification-invalid";
        database.UserQualifications.Add(new UserQualification
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            QualificationType = type,
            Enabled = true,
            CreatedAt = Now(),
        });
        await database.SaveChangesAsync(cancellationToken);
        return null;
    }

    public Task<string?> RequirePinChangeAsync(string? token, Guid userId, string pin, Guid? deviceId, CancellationToken cancellationToken) =>
        AdminPinAsync(token, pin, deviceId, (credential, _, now) => PinCommands.RequireChange(credential, now, credential.UserId, deviceId), userId, cancellationToken);

    public Task<string?> ResetEnrollmentAsync(string? token, Guid userId, string pin, Guid? deviceId, string? reason, CancellationToken cancellationToken) =>
        AdminPinAsync(token, pin, deviceId, (credential, history, now) => PinCommands.ResetEnrollment(credential, history, now, credential.UserId, deviceId, reason), userId, cancellationToken);

    public Task<string?> UnlockAsync(string? token, Guid userId, string pin, Guid? deviceId, CancellationToken cancellationToken) =>
        AdminPinAsync(token, pin, deviceId, (credential, _, now) => PinCommands.Unlock(credential, now, credential.UserId, deviceId), userId, cancellationToken);

    public async Task<string?> SetEnabledAsync(string? token, Guid userId, bool enabled, string? pin, Guid? deviceId, CancellationToken cancellationToken)
    {
        var actor = await RequireAsync(token, enabled ? nameof(AppRole.ADMIN) : nameof(AppRole.SUPER_ADMIN), cancellationToken);
        var user = await database.Users.FirstOrDefaultAsync(item => item.Id == userId, cancellationToken);
        if (user is null) return "user-not-found";
        if (!enabled)
        {
            var error = Apply(PinCommands.Verify(await CredentialAsync(actor.User.Id, cancellationToken), pin ?? "", Now(), hasher, deviceId));
            if (error is not null)
            {
                await database.SaveChangesAsync(cancellationToken);
                return error;
            }
        }

        user.Enabled = enabled;
        user.UpdatedAt = Now();
        await database.SaveChangesAsync(cancellationToken);
        return null;
    }

    public async Task<IReadOnlyList<PermitLifecycleView>> ListPermitsAsync(string? status, CancellationToken cancellationToken)
    {
        var query = database.Permits.AsNoTracking().Include(item => item.Area).Include(item => item.Equipment).AsQueryable();
        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<PermitStatus>(status, out var parsed)) query = query.Where(item => item.Status == parsed);
        var permits = await query.OrderByDescending(item => item.UpdatedAt).ToListAsync(cancellationToken);
        var views = new List<PermitLifecycleView>();
        foreach (var permit in permits) views.Add(await PermitViewAsync(permit, cancellationToken));
        return views;
    }

    public async Task<PermitLifecycleView?> GetPermitAsync(Guid permitId, CancellationToken cancellationToken)
    {
        var permit = await database.Permits.AsNoTracking().Include(item => item.Area).Include(item => item.Equipment).FirstOrDefaultAsync(item => item.Id == permitId, cancellationToken);
        return permit is null ? null : await PermitViewAsync(permit, cancellationToken);
    }

    public async Task<string?> SubmitAsync(string? token, Guid permitId, Guid? deviceId, CancellationToken cancellationToken)
    {
        var actor = await RequireAsync(token, nameof(AppRole.REQUESTER), cancellationToken);
        return await LifecycleAsync(permitId, (permit, hazards, _, _, _, _, _) =>
            LifecycleCommands.Submit(permit, actor.User, actor.Roles, hazards, Now(), deviceId), cancellationToken);
    }

    public async Task<string?> AuthorizeAsync(string? token, Guid permitId, string pin, int revision, Guid? deviceId, CancellationToken cancellationToken)
    {
        var actor = await RequireSessionAsync(token, cancellationToken);
        var allow = await database.PermitPolicies.Where(item => item.Key == PermitPolicies.AllowSelfAuthorization).Select(item => item.Enabled).FirstOrDefaultAsync(cancellationToken);
        return await LifecycleAsync(permitId, (permit, hazards, ppe, _, approvals, _, _) =>
            LifecycleCommands.Authorize(permit, actor.User, actor.Credential, actor.Roles, approvals, hazards, ppe, allow, pin, revision, Now(), hasher, deviceId), cancellationToken);
    }

    public Task<string?> AcceptAsync(string? token, Guid permitId, string pin, int revision, Guid? deviceId, CancellationToken cancellationToken) =>
        ActorLifecycle(token, permitId, (actor, permit, _, _, _, approvals, _, _) =>
            LifecycleCommands.Accept(permit, actor.User, actor.Credential, actor.Roles, pin, revision, Now(), hasher, deviceId), cancellationToken);

    public Task<string?> ActivateAsync(string? token, Guid permitId, string pin, int revision, string? actingRole, Guid? deviceId, CancellationToken cancellationToken) =>
        ActorLifecycle(token, permitId, (actor, permit, hazards, ppe, modules, approvals, qualified, history) =>
            LifecycleCommands.Activate(permit, actor.User, actor.Credential, actor.Roles, approvals, modules, qualified, hazards, ppe, pin, revision, actingRole, Now(), hasher, deviceId, history), cancellationToken);

    public async Task<string?> WithdrawAuthorizationAsync(string? token, Guid permitId, string pin, int revision, string? reason, string? comments, Guid? deviceId, CancellationToken cancellationToken)
    {
        var actor = await RequireSessionAsync(token, cancellationToken);
        return await LifecycleAsync(permitId, (permit, _, _, _, _, _, _) =>
            LifecycleCommands.WithdrawAuthorization(permit, actor.User, actor.Credential, actor.Roles, pin, revision, reason, comments, Now(), hasher, deviceId), cancellationToken);
    }

    public async Task<string?> ReturnForCorrectionAsync(string? token, Guid permitId, int revision, Guid? deviceId, CancellationToken cancellationToken)
    {
        var actor = await RequireSessionAsync(token, cancellationToken);
        return await LifecycleAsync(permitId, (permit, _, _, _, _, _, _) =>
            LifecycleCommands.ReturnForCorrection(permit, actor.User, actor.Roles, revision, Now(), deviceId), cancellationToken);
    }

    private async Task<string?> ActorLifecycle(string? token, Guid permitId, Func<Actor, Permit, int, int, IReadOnlyCollection<PermitModuleKind>, List<PermitApproval>, IReadOnlyCollection<QualificationType>, IReadOnlyList<PermitEvent>, CommandResult> command, CancellationToken cancellationToken)
    {
        var actor = await RequireSessionAsync(token, cancellationToken);
        return await LifecycleAsync(permitId, (permit, hazards, ppe, modules, approvals, qualified, history) => command(actor, permit, hazards, ppe, modules, approvals, qualified, history), cancellationToken);
    }

    private async Task<string?> LifecycleAsync(Guid permitId, Func<Permit, int, int, IReadOnlyCollection<PermitModuleKind>, List<PermitApproval>, IReadOnlyCollection<QualificationType>, IReadOnlyList<PermitEvent>, CommandResult> command, CancellationToken cancellationToken)
    {
        await using var transaction = await database.Database.BeginTransactionAsync(cancellationToken);
        var permit = await database.Permits.FirstOrDefaultAsync(item => item.Id == permitId, cancellationToken);
        if (permit is null) return "permit-not-found";
        var hazards = await database.PermitHazards.CountAsync(item => item.PermitId == permitId, cancellationToken);
        var ppe = await database.PermitPpe.CountAsync(item => item.PermitId == permitId, cancellationToken);
        var modules = await database.PermitModules.Where(item => item.PermitId == permitId).Select(item => item.Kind).ToListAsync(cancellationToken);
        var approvals = await database.PermitApprovals.Where(item => item.PermitId == permitId).ToListAsync(cancellationToken);
        var history = await database.PermitEvents.Where(item => item.PermitId == permitId).ToListAsync(cancellationToken);
        var participantIds = await database.PermitParticipants.Where(item => item.PermitId == permitId && item.UserId != null).Select(item => item.UserId!.Value).ToListAsync(cancellationToken);
        var now = Now();
        var qualified = await database.UserQualifications.Where(item => participantIds.Contains(item.UserId) && item.Enabled).ToListAsync(cancellationToken);
        var held = qualified.Where(item => (item.ExpirationDate is null || item.ExpirationDate > now) && (item.EffectiveDate is null || item.EffectiveDate <= now)).Select(item => item.QualificationType).ToArray();
        var error = Apply(command(permit, hazards, ppe, modules, approvals, held, history));
        await database.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return error;
    }

    private async Task<string?> PinAsync(string? token, Func<UserCredential, List<UserPinHistory>, DateTimeOffset, CommandResult> command, CancellationToken cancellationToken)
    {
        var actor = await RequireSessionAsync(token, cancellationToken);
        await using var transaction = await database.Database.BeginTransactionAsync(cancellationToken);
        var history = await database.UserPinHistories.Where(item => item.UserId == actor.User.Id).ToListAsync(cancellationToken);
        var error = Apply(command(actor.Credential, history, Now()));
        await database.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return error;
    }

    private async Task<string?> AdminPinAsync(string? token, string pin, Guid? deviceId, Func<UserCredential, List<UserPinHistory>, DateTimeOffset, CommandResult> command, Guid targetId, CancellationToken cancellationToken)
    {
        var actor = await RequireAsync(token, nameof(AppRole.SUPER_ADMIN), cancellationToken);
        await using var transaction = await database.Database.BeginTransactionAsync(cancellationToken);
        var now = Now();
        var actorError = Apply(PinCommands.Verify(actor.Credential, pin, now, hasher, deviceId));
        if (actorError is not null)
        {
            await database.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return actorError;
        }

        var target = await CredentialAsync(targetId, cancellationToken);
        var history = await database.UserPinHistories.Where(item => item.UserId == targetId).ToListAsync(cancellationToken);
        var result = command(target, history, now);
        result = result with { Audit = result.Audit is null ? null : CopyAudit(result.Audit, actor.User.Id) };
        var error = Apply(result);
        await database.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return error;
    }

    private static CredentialAudit CopyAudit(CredentialAudit audit, Guid actorId) => new()
    {
        Id = audit.Id,
        EventType = audit.EventType,
        TargetUserId = audit.TargetUserId,
        PerformedByUserId = actorId,
        OccurredAt = audit.OccurredAt,
        DeviceId = audit.DeviceId,
        ReasonCode = audit.ReasonCode,
    };

    private string? Apply(CommandResult result)
    {
        if (result.Audit is not null) database.CredentialAudits.Add(result.Audit);
        if (result.Remember is not null) database.UserPinHistories.Add(result.Remember);
        if (result.Forget is not null) database.UserPinHistories.RemoveRange(result.Forget);
        if (result.Approval is not null) database.PermitApprovals.Add(result.Approval);
        if (result.Event is not null) database.PermitEvents.Add(result.Event);
        if (result.Revision is not null) database.PermitRevisions.Add(result.Revision);
        return result.Error;
    }

    private async Task<SessionStart> IssueAsync(User user, CancellationToken cancellationToken)
    {
        var (token, hash) = SessionTokens.Create();
        var now = Now();
        database.UserSessions.Add(new UserSession { Id = Guid.NewGuid(), UserId = user.Id, TokenHash = hash, CreatedAt = now, ExpiresAt = now.AddHours(12) });
        await database.SaveChangesAsync(cancellationToken);
        return new SessionStart(token, await ViewAsync(user, false, cancellationToken));
    }

    private async Task<Actor?> ActorAsync(string? token, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(token)) return null;
        var hash = SessionTokens.Hash(token.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase) ? token[7..].Trim() : token.Trim());
        var now = Now();
        var session = await database.UserSessions.FirstOrDefaultAsync(item => item.TokenHash == hash && item.RevokedAt == null && item.ExpiresAt > now, cancellationToken);
        if (session is null) return null;
        var user = await database.Users.FirstOrDefaultAsync(item => item.Id == session.UserId && item.Enabled, cancellationToken);
        if (user is null) return null;
        return new Actor(user, await CredentialAsync(user.Id, cancellationToken), await RoleNamesAsync(user.Id, cancellationToken));
    }

    private async Task<Actor> RequireSessionAsync(string? token, CancellationToken cancellationToken) =>
        await ActorAsync(token, cancellationToken) ?? throw new DirectoryRejected("session-required");

    private async Task<Actor> RequireAsync(string? token, string capability, CancellationToken cancellationToken)
    {
        var actor = await ActorAsync(token, cancellationToken) ?? throw new DirectoryRejected("session-required");
        if (!PermitCapabilities.Has(actor.Roles, capability)) throw new DirectoryRejected("capability-required");
        return actor;
    }

    private async Task<UserCredential> CredentialAsync(Guid userId, CancellationToken cancellationToken) =>
        await database.UserCredentials.FirstAsync(item => item.UserId == userId, cancellationToken);

    private async Task<IReadOnlyList<string>> RoleNamesAsync(Guid userId, CancellationToken cancellationToken) =>
        await database.UserRoles.Where(item => item.UserId == userId).Join(database.Roles, link => link.RoleId, role => role.Id, (_, role) => role.Name).ToListAsync(cancellationToken);

    private async Task<UserProfileView> ViewAsync(User user, bool includeAttempts, CancellationToken cancellationToken)
    {
        var credential = await database.UserCredentials.AsNoTracking().FirstAsync(item => item.UserId == user.Id, cancellationToken);
        var roles = await RoleNamesAsync(user.Id, cancellationToken);
        var qualifications = await database.UserQualifications.AsNoTracking().Where(item => item.UserId == user.Id).ToListAsync(cancellationToken);
        var preferences = await database.UserNotificationPreferences.AsNoTracking().Where(item => item.UserId == user.Id).ToListAsync(cancellationToken);
        return UserProfiles.View(user, credential, roles, qualifications, preferences, includeAttempts);
    }

    private async Task<string?> ApplyContactAsync(User user, Guid performedBy, string? email, string? mobile, string? alternate, IReadOnlyList<(string Channel, string Topic, bool Enabled)>? preferences, CancellationToken cancellationToken)
    {
        var tracked = await database.UserNotificationPreferences.Where(item => item.UserId == user.Id).ToListAsync(cancellationToken);
        var working = tracked.Select(item => new UserNotificationPreference { UserId = item.UserId, Channel = item.Channel, Topic = item.Topic, Enabled = item.Enabled }).ToList();
        ContactRules.NormalizePhone(mobile, out var normalizedMobile);
        var requested = preferences ?? working.Select(item => item.Channel == NotificationCatalog.Sms && normalizedMobile is null ? (item.Channel, item.Topic, false) : (item.Channel, item.Topic, item.Enabled)).ToArray();
        var error = ProfileContactRules.Apply(user, working, email, mobile, alternate, requested, out var changed);
        if (error is not null) return error;
        if (changed.Count == 0) return null;
        if (changed.Contains("NotificationPreferences"))
        {
            database.UserNotificationPreferences.RemoveRange(tracked);
            database.UserNotificationPreferences.AddRange(working);
        }
        var summary = string.Join(",", changed);
        database.CredentialAudits.Add(new CredentialAudit
        {
            Id = Guid.NewGuid(),
            EventType = CredentialAuditType.USER_PROFILE_UPDATED,
            TargetUserId = user.Id,
            PerformedByUserId = performedBy,
            OccurredAt = Now(),
            ReasonCode = summary.Length <= 80 ? summary : summary[..80],
        });
        user.UpdatedAt = Now();
        return null;
    }

    private async Task<PermitLifecycleView> PermitViewAsync(Permit permit, CancellationToken cancellationToken)
    {
        var hazards = await database.PermitHazards.AsNoTracking().Where(item => item.PermitId == permit.Id).Select(item => item.Label).ToListAsync(cancellationToken);
        var controls = await database.PermitControls.AsNoTracking().Where(item => item.PermitId == permit.Id).Select(item => item.Label).ToListAsync(cancellationToken);
        var ppe = await database.PermitPpe.AsNoTracking().Where(item => item.PermitId == permit.Id).Select(item => item.Label).ToListAsync(cancellationToken);
        var modules = await database.PermitModules.AsNoTracking().Where(item => item.PermitId == permit.Id).Select(item => item.Kind.ToString()).ToListAsync(cancellationToken);
        var moduleKinds = await database.PermitModules.AsNoTracking().Where(item => item.PermitId == permit.Id).Select(item => item.Kind).ToListAsync(cancellationToken);
        var approvals = await database.PermitApprovals.AsNoTracking().Where(item => item.PermitId == permit.Id).ToListAsync(cancellationToken);
        var historyTypes = new[]
        {
            PermitEventType.SUBMITTED,
            PermitEventType.PERMIT_SUBMITTED,
            PermitEventType.AUTHORIZED,
            PermitEventType.PERMIT_AUTHORIZED,
            PermitEventType.PERMIT_AUTHORIZATION_WITHDRAWN,
            PermitEventType.ACCEPTED,
            PermitEventType.PERMIT_ACCEPTED,
            PermitEventType.ACTIVATED,
            PermitEventType.PERMIT_ACTIVATED,
            PermitEventType.PERMIT_RETURNED_FOR_CORRECTION,
            PermitEventType.SUSPENDED,
            PermitEventType.PERMIT_SUSPENDED,
            PermitEventType.REAUTHORIZED,
            PermitEventType.PERMIT_REAUTHORIZED,
        };
        var historyEvents = await database.PermitEvents.AsNoTracking()
            .Where(item => item.PermitId == permit.Id && historyTypes.Contains(item.EventType))
            .OrderByDescending(item => item.OccurredAt)
            .ToListAsync(cancellationToken);
        var history = historyEvents
            .Select(item => new AuthorizationHistoryEntry(item.PermitRevision, item.EventType.ToString(), item.DisplayNameSnapshot ?? "", item.OccurredAt, item.PermitUserCodeSnapshot, item.UserId, WithdrawalReasons.Display(item.EventType, item.Payload)))
            .ToList();
        var participantIds = await database.PermitParticipants.AsNoTracking().Where(item => item.PermitId == permit.Id && item.UserId != null).Select(item => item.UserId!.Value).ToListAsync(cancellationToken);
        var qualified = await database.UserQualifications.AsNoTracking().Where(item => participantIds.Contains(item.UserId) && item.Enabled).Select(item => item.QualificationType).ToListAsync(cancellationToken);
        var missing = SpecialtyRequirements.Missing(permit.PermitType, moduleKinds, qualified).Select(item => item.ToString()).ToArray();
        return new PermitLifecycleView(
            permit.Id,
            permit.PermitNumber,
            permit.PermitType.ToString(),
            permit.Status.ToString(),
            permit.CurrentRevision,
            permit.JobDescription,
            permit.WorkOrder,
            permit.Area?.Name,
            hazards,
            controls,
            ppe,
            modules,
            approvals.Select(item => new ApprovalView(item.ActingRole ?? item.RoleName, item.DisplayNameSnapshot ?? "", item.PermitUserCodeSnapshot ?? "", item.JobTitleSnapshot, item.DecidedAt, item.Decision, item.PermitRevision, item.UserId)).ToArray(),
            missing,
            permit.Equipment?.Tag,
            permit.CreatedBy,
            await database.PermitPolicies.AsNoTracking().Where(item => item.Key == PermitPolicies.AllowSelfAuthorization).Select(item => item.Enabled).FirstOrDefaultAsync(cancellationToken),
            history);
    }

    private async Task<int> AllocateCodeAsync(CancellationToken cancellationToken)
    {
        var connection = database.Database.GetDbConnection();
        if (connection.State != ConnectionState.Open) await connection.OpenAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.Transaction = database.Database.CurrentTransaction?.GetDbTransaction();
        command.CommandText = UserCodes.AllocateSql;
        var value = await command.ExecuteScalarAsync(cancellationToken);
        return value switch
        {
            int number => number,
            long number => checked((int)number),
            _ => throw new DatabaseUnavailableException(),
        };
    }

    private static DateTimeOffset Now() => DateTimeOffset.UtcNow;

    private sealed record Actor(User User, UserCredential Credential, IReadOnlyList<string> Roles);
}

public sealed class DirectoryRejected(string code) : Exception(code)
{
    public string Code { get; } = code;
}
