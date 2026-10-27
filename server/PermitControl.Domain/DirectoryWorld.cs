namespace PermitControl.Domain;

public sealed class DirectoryWorld
{
    private readonly object gate = new();
    private readonly IPinHasher hasher;

    public DirectoryWorld(IPinHasher hasher)
    {
        this.hasher = hasher;
    }

    public List<User> Users { get; } = [];
    public List<Role> Roles { get; } = [];
    public List<UserRole> Membership { get; } = [];
    public List<UserCredential> Credentials { get; } = [];
    public List<UserPinHistory> History { get; } = [];
    public List<UserQualification> Qualifications { get; } = [];
    public List<CredentialAudit> Audits { get; } = [];
    public List<UserSession> Sessions { get; } = [];
    public List<Permit> Permits { get; } = [];
    public List<PermitApproval> Approvals { get; } = [];
    public List<PermitEvent> Events { get; } = [];
    public List<PermitHazard> Hazards { get; } = [];
    public List<PermitPpe> Ppe { get; } = [];
    public List<PermitRevision> Revisions { get; } = [];
    public List<PermitModule> Modules { get; } = [];
    public bool AllowSelfAuthorization { get; set; }
    public int LastUserCode { get; set; } = 8;

    public static DirectoryWorld Bootstrap(IPinHasher? hasher = null)
    {
        var world = new DirectoryWorld(hasher ?? Argon2PinHasher.Interactive);
        world.Roles.AddRange(DirectorySeed.Roles());
        world.Users.AddRange(DirectorySeed.Users());
        world.Membership.AddRange(DirectorySeed.Membership());
        world.Credentials.AddRange(DirectorySeed.Credentials());
        return world;
    }

    public IReadOnlyList<string> RolesOf(Guid userId) =>
        Membership.Where(item => item.UserId == userId)
            .Select(item => Roles.First(role => role.Id == item.RoleId).Name)
            .ToArray();

    public string? Enroll(Guid userId, string pin, string confirm, DateTimeOffset now, Guid? deviceId = null) =>
        Apply(PinCommands.Enroll(Credential(userId), HistoryOf(userId), pin, confirm, now, hasher, deviceId));

    public string? ChangePin(Guid userId, string current, string next, string confirm, DateTimeOffset now, Guid? deviceId = null) =>
        Apply(PinCommands.Change(Credential(userId), HistoryOf(userId), current, next, confirm, now, hasher, deviceId));

    public string? Verify(Guid userId, string pin, DateTimeOffset now, Guid? deviceId = null) =>
        Apply(PinCommands.Verify(Credential(userId), pin, now, hasher, deviceId));

    public string? RequireChange(Guid actorId, string actorPin, Guid targetId, DateTimeOffset now, Guid? deviceId = null)
    {
        var gateError = AdminPin(actorId, actorPin, now, deviceId);
        if (gateError is not null) return gateError;
        return Apply(PinCommands.RequireChange(Credential(targetId), now, actorId, deviceId));
    }

    public string? ResetEnrollment(Guid actorId, string actorPin, Guid targetId, DateTimeOffset now, Guid? deviceId = null, string? reason = null)
    {
        var gateError = AdminPin(actorId, actorPin, now, deviceId);
        if (gateError is not null) return gateError;
        return Apply(PinCommands.ResetEnrollment(Credential(targetId), HistoryOf(targetId), now, actorId, deviceId, reason));
    }

    public string? Unlock(Guid actorId, string actorPin, Guid targetId, DateTimeOffset now, Guid? deviceId = null)
    {
        var gateError = AdminPin(actorId, actorPin, now, deviceId);
        if (gateError is not null) return gateError;
        return Apply(PinCommands.Unlock(Credential(targetId), now, actorId, deviceId));
    }

    public (string? Error, string? Token) OpenWindows(string? domain, string? username, DateTimeOffset now)
    {
        var (normalizedDomain, name) = WindowsAccounts.Normalize(domain, username);
        if (string.IsNullOrEmpty(name)) return ("select-user", null);
        var matches = Users.Where(user => user.Enabled && WindowsAccounts.UsernameMatches(user, name) && WindowsAccounts.DomainMatches(user, normalizedDomain)).ToList();
        if (matches.Count != 1) return ("select-user", null);
        return (null, Issue(matches[0], now));
    }

    public (string? Error, string? Token) ConfirmUser(Guid userId, string pin, DateTimeOffset now, Guid? deviceId = null)
    {
        var user = Users.FirstOrDefault(item => item.Id == userId && item.Enabled);
        if (user is null) return ("pin-not-accepted", null);
        var error = Verify(userId, pin, now, deviceId);
        if (error is not null) return (error, null);
        if (Credential(userId).State != PinCredentialState.ACTIVE) return ("pin-not-enrolled", null);
        return (null, Issue(user, now));
    }

    public User? FindSession(string? token, DateTimeOffset now)
    {
        if (string.IsNullOrWhiteSpace(token)) return null;
        var hash = SessionTokens.Hash(token);
        var session = Sessions.FirstOrDefault(item => item.TokenHash == hash && item.RevokedAt is null && item.ExpiresAt > now);
        return session is null ? null : Users.FirstOrDefault(item => item.Id == session.UserId && item.Enabled);
    }

    public string? Submit(Guid permitId, Guid actorId, DateTimeOffset now, Guid? deviceId = null) =>
        Apply(LifecycleCommands.Submit(Permit(permitId), User(actorId), RolesOf(actorId), Hazards.Count(item => item.PermitId == permitId), now, deviceId));

    public string? Authorize(Guid permitId, Guid actorId, string pin, int revision, DateTimeOffset now, Guid? deviceId = null) =>
        Apply(LifecycleCommands.Authorize(Permit(permitId), User(actorId), Credential(actorId), RolesOf(actorId), Approvals.Where(item => item.PermitId == permitId).ToList(), Hazards.Count(item => item.PermitId == permitId), Ppe.Count(item => item.PermitId == permitId), AllowSelfAuthorization, pin, revision, now, hasher, deviceId));

    public string? ReturnForCorrection(Guid permitId, Guid actorId, int revision, DateTimeOffset now, Guid? deviceId = null) =>
        Apply(LifecycleCommands.ReturnForCorrection(Permit(permitId), User(actorId), RolesOf(actorId), revision, now, deviceId));

    public string? Accept(Guid permitId, Guid actorId, string pin, int revision, DateTimeOffset now, Guid? deviceId = null) =>
        Apply(LifecycleCommands.Accept(Permit(permitId), User(actorId), Credential(actorId), RolesOf(actorId), pin, revision, now, hasher, deviceId));

    public string? Activate(Guid permitId, Guid actorId, string pin, int revision, DateTimeOffset now, string? actingRole = null, Guid? deviceId = null)
    {
        var qualified = Qualifications.Where(item => item.Enabled && (item.ExpirationDate is null || item.ExpirationDate > now) && (item.EffectiveDate is null || item.EffectiveDate <= now))
            .Select(item => item.QualificationType)
            .ToArray();
        return Apply(LifecycleCommands.Activate(
            Permit(permitId),
            User(actorId),
            Credential(actorId),
            RolesOf(actorId),
            Approvals.Where(item => item.PermitId == permitId).ToList(),
            Modules.Where(item => item.PermitId == permitId).Select(item => item.Kind).ToArray(),
            qualified,
            Hazards.Count(item => item.PermitId == permitId),
            Ppe.Count(item => item.PermitId == permitId),
            pin,
            revision,
            actingRole,
            now,
            hasher,
            deviceId,
            Events.Where(item => item.PermitId == permitId).ToList()));
    }

    public string? WithdrawAuthorization(Guid permitId, Guid actorId, string pin, int revision, string? reason, string? comments, DateTimeOffset now, Guid? deviceId = null) =>
        Apply(LifecycleCommands.WithdrawAuthorization(Permit(permitId), User(actorId), Credential(actorId), RolesOf(actorId), pin, revision, reason, comments, now, hasher, deviceId));

    public string? CreateUser(Guid actorId, User profile, IReadOnlyList<string> roles, DateTimeOffset now)
    {
        if (!PermitCapabilities.Has(RolesOf(actorId), nameof(AppRole.ADMIN))) return "capability-required";
        if (roles.Any(role => !PermitCapabilities.Known(role))) return "role-invalid";
        var (domain, username) = WindowsAccounts.Normalize(profile.WindowsDomain, profile.WindowsUsername);
        if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(profile.DisplayName)) return "profile-invalid";
        lock (gate)
        {
            LastUserCode += 1;
            var code = UserCodes.Format(LastUserCode);
            var user = new User
            {
                Id = Guid.NewGuid(),
                PermitUserCode = code,
                Username = string.IsNullOrEmpty(domain) ? username : $"{domain}\\{username}",
                DisplayName = profile.DisplayName.Trim(),
                Email = $"{code.ToLowerInvariant()}@permit-control.local",
                WindowsDomain = domain,
                WindowsUsername = username,
                PersonnelReference = profile.PersonnelReference.Trim(),
                PersonnelCode = profile.PersonnelCode.Trim(),
                JobTitle = profile.JobTitle.Trim(),
                Department = profile.Department?.Trim(),
                Enabled = profile.Enabled,
                AuthProvider = AuthProvider.LOCAL,
                CreatedAt = now,
            };
            Users.Add(user);
            Credentials.Add(new UserCredential { Id = Guid.NewGuid(), UserId = user.Id, State = PinCredentialState.NOT_ENROLLED, CreatedAt = now });
            foreach (var role in roles.Distinct(StringComparer.Ordinal))
            {
                Membership.Add(new UserRole { UserId = user.Id, RoleId = Roles.First(item => item.Name == role).Id });
            }

            profile.Id = user.Id;
            profile.PermitUserCode = code;
        }

        return null;
    }

    public string? EditProfile(Guid actorId, Guid targetId, User edits)
    {
        if (!PermitCapabilities.Has(RolesOf(actorId), nameof(AppRole.ADMIN))) return "capability-required";
        var user = User(targetId);
        var code = user.PermitUserCode;
        var id = user.Id;
        var (domain, username) = WindowsAccounts.Normalize(edits.WindowsDomain, edits.WindowsUsername);
        user.DisplayName = edits.DisplayName.Trim();
        user.WindowsDomain = domain;
        user.WindowsUsername = username;
        user.Username = string.IsNullOrEmpty(domain) ? username : $"{domain}\\{username}";
        user.PersonnelReference = edits.PersonnelReference.Trim();
        user.PersonnelCode = edits.PersonnelCode.Trim();
        user.JobTitle = edits.JobTitle.Trim();
        user.Department = edits.Department?.Trim();
        user.UpdatedAt = DateTimeOffset.UtcNow;
        if (user.Id != id || user.PermitUserCode != code) return "identity-changed";
        return null;
    }

    public string? SetEnabled(Guid actorId, string actorPin, Guid targetId, bool enabled, DateTimeOffset now, Guid? deviceId = null)
    {
        if (!enabled)
        {
            var gateError = AdminPin(actorId, actorPin, now, deviceId);
            if (gateError is not null) return gateError;
        }
        else if (!PermitCapabilities.Has(RolesOf(actorId), nameof(AppRole.ADMIN)))
        {
            return "capability-required";
        }

        User(targetId).Enabled = enabled;
        return null;
    }

    public string? SetRoles(Guid actorId, string? actorPin, Guid targetId, IReadOnlyList<string> roles, DateTimeOffset now, Guid? deviceId = null)
    {
        if (!PermitCapabilities.Has(RolesOf(actorId), nameof(AppRole.ADMIN))) return "capability-required";
        if (roles.Any(role => !PermitCapabilities.Known(role))) return "role-invalid";
        var sensitive = roles.Contains(nameof(AppRole.SUPER_ADMIN)) || roles.Contains(nameof(AppRole.PERMIT_AUTHORIZER))
            || RolesOf(targetId).Any(role => role is nameof(AppRole.SUPER_ADMIN) or nameof(AppRole.PERMIT_AUTHORIZER));
        if (sensitive)
        {
            var gateError = AdminPin(actorId, actorPin ?? "", now, deviceId);
            if (gateError is not null) return gateError;
        }

        Membership.RemoveAll(item => item.UserId == targetId);
        foreach (var role in roles.Distinct(StringComparer.Ordinal))
        {
            Membership.Add(new UserRole { UserId = targetId, RoleId = Roles.First(item => item.Name == role).Id });
        }

        return null;
    }

    public string? AddQualification(Guid actorId, Guid targetId, QualificationType type, DateTimeOffset now)
    {
        if (!PermitCapabilities.Has(RolesOf(actorId), nameof(AppRole.ADMIN))) return "capability-required";
        Qualifications.Add(new UserQualification
        {
            Id = Guid.NewGuid(),
            UserId = targetId,
            QualificationType = type,
            Enabled = true,
            VerifiedByUserId = actorId,
            CreatedAt = now,
        });
        return null;
    }

    public Permit AddPermit(PermitType type, string description, string workOrder, params PermitModuleKind[] modules)
    {
        var permit = new Permit
        {
            Id = Guid.NewGuid(),
            PermitNumber = "PTW-2026-00021",
            PermitType = type,
            Status = PermitStatus.DRAFT,
            WorkOrder = workOrder,
            JobDescription = description,
            CompanyType = CompanyType.LCY,
            CurrentRevision = 1,
            CreatedAt = DirectorySeed.CreatedAt,
            UpdatedAt = DirectorySeed.CreatedAt,
        };
        Permits.Add(permit);
        Hazards.Add(new PermitHazard { Id = Guid.NewGuid(), PermitId = permit.Id, Label = "Line break" });
        Ppe.Add(new PermitPpe { Id = Guid.NewGuid(), PermitId = permit.Id, Label = "Hard hat" });
        foreach (var module in modules) Modules.Add(new PermitModule { Id = Guid.NewGuid(), PermitId = permit.Id, Kind = module, Required = true });
        return permit;
    }

    private string? AdminPin(Guid actorId, string pin, DateTimeOffset now, Guid? deviceId)
    {
        if (!PermitCapabilities.Has(RolesOf(actorId), nameof(AppRole.SUPER_ADMIN))) return "capability-required";
        return Verify(actorId, pin, now, deviceId);
    }

    private string Issue(User user, DateTimeOffset now)
    {
        var (token, hash) = SessionTokens.Create();
        Sessions.Add(new UserSession
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            TokenHash = hash,
            CreatedAt = now,
            ExpiresAt = now.AddHours(12),
        });
        return token;
    }

    private string? Apply(CommandResult result)
    {
        if (result.Audit is not null) Audits.Add(result.Audit);
        if (result.Remember is not null) History.Add(result.Remember);
        if (result.Forget is not null)
        {
            foreach (var item in result.Forget) History.Remove(item);
        }

        if (result.Approval is not null) Approvals.Add(result.Approval);
        if (result.Event is not null) Events.Add(result.Event);
        if (result.Revision is not null) Revisions.Add(result.Revision);
        return result.Error;
    }

    private User User(Guid id) => Users.First(item => item.Id == id);
    private UserCredential Credential(Guid id) => Credentials.First(item => item.UserId == id);
    private Permit Permit(Guid id) => Permits.First(item => item.Id == id);
    private List<UserPinHistory> HistoryOf(Guid id) => History.Where(item => item.UserId == id).ToList();
}
