namespace PermitControl.Domain;

public sealed record CommandResult(
    string? Error,
    CredentialAudit? Audit = null,
    UserPinHistory? Remember = null,
    IReadOnlyList<UserPinHistory>? Forget = null,
    User? Created = null,
    UserCredential? CreatedCredential = null,
    IReadOnlyList<UserRole>? Membership = null,
    UserQualification? Qualification = null,
    PermitApproval? Approval = null,
    PermitEvent? Event = null,
    PermitRevision? Revision = null,
    string? SessionToken = null,
    UserSession? Session = null);

public static class PinCommands
{
    public static CommandResult Enroll(UserCredential credential, IReadOnlyList<UserPinHistory> history, string pin, string confirm, DateTimeOffset now, IPinHasher hasher, Guid? deviceId)
    {
        if (credential.State is not (PinCredentialState.NOT_ENROLLED or PinCredentialState.ENROLLMENT_REQUIRED))
        {
            return new CommandResult(credential.State == PinCredentialState.TEMPORARILY_LOCKED ? "pin-locked" : "pin-already-enrolled");
        }

        var format = PinPolicy.ValidateFormat(pin);
        if (format is not null) return new CommandResult(format);
        if (!string.Equals(pin, confirm, StringComparison.Ordinal)) return new CommandResult("pin-confirmation-mismatch");
        if (Reuses(pin, credential.PinHash, history, hasher)) return new CommandResult("pin-reuse-not-allowed");

        var encoded = hasher.Hash(pin);
        RememberCurrent(credential, now, out var remembered);
        credential.PinHash = encoded;
        credential.State = PinCredentialState.ACTIVE;
        credential.ResumeState = null;
        credential.FailedAttempts = 0;
        credential.LockedUntil = null;
        credential.PinChangedAt = now;
        credential.UpdatedAt = now;
        return new CommandResult(
            null,
            Audit(CredentialAuditType.PIN_ENROLLED, credential.UserId, credential.UserId, now, deviceId, null),
            remembered,
            Trim(history, remembered));
    }

    public static CommandResult Change(UserCredential credential, IReadOnlyList<UserPinHistory> history, string currentPin, string nextPin, string confirm, DateTimeOffset now, IPinHasher hasher, Guid? deviceId)
    {
        if (Locked(credential, now)) return new CommandResult("pin-locked");
        if (credential.State is PinCredentialState.NOT_ENROLLED or PinCredentialState.ENROLLMENT_REQUIRED || string.IsNullOrEmpty(credential.PinHash))
        {
            return new CommandResult("pin-not-enrolled");
        }

        var verified = Verify(credential, currentPin, now, hasher, deviceId);
        if (verified.Error is not null) return verified;
        var format = PinPolicy.ValidateFormat(nextPin);
        if (format is not null) return new CommandResult(format);
        if (!string.Equals(nextPin, confirm, StringComparison.Ordinal)) return new CommandResult("pin-confirmation-mismatch");
        var forced = credential.State == PinCredentialState.CHANGE_REQUIRED;
        if (!forced && credential.PinChangedAt is { } changed && now - changed < PinPolicy.MinimumAge)
        {
            return new CommandResult("pin-minimum-age");
        }

        if (Reuses(nextPin, credential.PinHash, history, hasher)) return new CommandResult("pin-reuse-not-allowed");
        var encoded = hasher.Hash(nextPin);
        RememberCurrent(credential, now, out var remembered);
        credential.PinHash = encoded;
        credential.State = PinCredentialState.ACTIVE;
        credential.ResumeState = null;
        credential.FailedAttempts = 0;
        credential.LockedUntil = null;
        credential.PinChangedAt = now;
        credential.UpdatedAt = now;
        return new CommandResult(null, Audit(CredentialAuditType.PIN_CHANGED, credential.UserId, credential.UserId, now, deviceId, null), remembered, Trim(history, remembered));
    }

    public static CommandResult Verify(UserCredential credential, string pin, DateTimeOffset now, IPinHasher hasher, Guid? deviceId)
    {
        if (Locked(credential, now)) return new CommandResult("pin-locked");
        ResumeIfExpired(credential, now);
        if (credential.State is PinCredentialState.NOT_ENROLLED or PinCredentialState.ENROLLMENT_REQUIRED || string.IsNullOrEmpty(credential.PinHash))
        {
            return new CommandResult("pin-not-enrolled");
        }

        if (!hasher.Verify(pin, credential.PinHash))
        {
            credential.FailedAttempts += 1;
            credential.UpdatedAt = now;
            if (credential.FailedAttempts < PinPolicy.FailedAttemptLimit) return new CommandResult("pin-not-accepted");
            credential.ResumeState = credential.State == PinCredentialState.TEMPORARILY_LOCKED
                ? credential.ResumeState ?? PinCredentialState.ACTIVE
                : credential.State;
            credential.State = PinCredentialState.TEMPORARILY_LOCKED;
            credential.LockedUntil = now.Add(PinPolicy.Lockout);
            return new CommandResult("pin-locked", Audit(CredentialAuditType.PIN_LOCKED, credential.UserId, credential.UserId, now, deviceId, "failed-attempts"));
        }

        credential.FailedAttempts = 0;
        credential.LockedUntil = null;
        if (credential.State == PinCredentialState.TEMPORARILY_LOCKED)
        {
            credential.State = credential.ResumeState ?? PinCredentialState.ACTIVE;
            credential.ResumeState = null;
        }

        credential.UpdatedAt = now;
        return new CommandResult(null);
    }

    public static CommandResult RequireChange(UserCredential target, DateTimeOffset now, Guid actorId, Guid? deviceId)
    {
        if (target.State is not (PinCredentialState.ACTIVE or PinCredentialState.TEMPORARILY_LOCKED) || string.IsNullOrEmpty(target.PinHash))
        {
            return new CommandResult("pin-not-enrolled");
        }

        if (target.State == PinCredentialState.TEMPORARILY_LOCKED) target.ResumeState = PinCredentialState.CHANGE_REQUIRED;
        else target.State = PinCredentialState.CHANGE_REQUIRED;
        if (target.State != PinCredentialState.TEMPORARILY_LOCKED) target.State = PinCredentialState.CHANGE_REQUIRED;
        target.UpdatedAt = now;
        return new CommandResult(null, Audit(CredentialAuditType.PIN_CHANGE_REQUIRED, target.UserId, actorId, now, deviceId, null));
    }

    public static CommandResult ResetEnrollment(UserCredential target, IReadOnlyList<UserPinHistory> history, DateTimeOffset now, Guid actorId, Guid? deviceId, string? reason)
    {
        RememberCurrent(target, now, out var remembered);
        target.PinHash = null;
        target.State = PinCredentialState.ENROLLMENT_REQUIRED;
        target.ResumeState = null;
        target.FailedAttempts = 0;
        target.LockedUntil = null;
        target.UpdatedAt = now;
        return new CommandResult(
            null,
            Audit(CredentialAuditType.PIN_ENROLLMENT_RESET, target.UserId, actorId, now, deviceId, string.IsNullOrWhiteSpace(reason) ? null : reason.Trim()),
            remembered,
            Trim(history, remembered));
    }

    public static CommandResult Unlock(UserCredential target, DateTimeOffset now, Guid actorId, Guid? deviceId)
    {
        var resume = target.ResumeState ?? (string.IsNullOrEmpty(target.PinHash) ? PinCredentialState.NOT_ENROLLED : PinCredentialState.ACTIVE);
        target.State = resume;
        target.ResumeState = null;
        target.FailedAttempts = 0;
        target.LockedUntil = null;
        target.UpdatedAt = now;
        return new CommandResult(null, Audit(CredentialAuditType.PIN_UNLOCKED, target.UserId, actorId, now, deviceId, null));
    }

    public static bool Reuses(string pin, string? currentHash, IReadOnlyList<UserPinHistory> history, IPinHasher hasher)
    {
        if (!string.IsNullOrEmpty(currentHash) && hasher.Verify(pin, currentHash)) return true;
        return history
            .OrderByDescending(item => item.CreatedAt)
            .Take(PinPolicy.HistoryDepth)
            .Any(item => hasher.Verify(pin, item.PinHash));
    }

    private static bool Locked(UserCredential credential, DateTimeOffset now) =>
        credential.State == PinCredentialState.TEMPORARILY_LOCKED && credential.LockedUntil is { } until && now < until;

    private static void ResumeIfExpired(UserCredential credential, DateTimeOffset now)
    {
        if (credential.State != PinCredentialState.TEMPORARILY_LOCKED) return;
        if (credential.LockedUntil is { } until && now < until) return;
        credential.State = credential.ResumeState ?? PinCredentialState.ACTIVE;
        credential.ResumeState = null;
        credential.LockedUntil = null;
        credential.FailedAttempts = 0;
    }

    private static void RememberCurrent(UserCredential credential, DateTimeOffset now, out UserPinHistory? remembered)
    {
        remembered = string.IsNullOrEmpty(credential.PinHash)
            ? null
            : new UserPinHistory { Id = Guid.NewGuid(), UserId = credential.UserId, PinHash = credential.PinHash, CreatedAt = now };
    }

    private static IReadOnlyList<UserPinHistory> Trim(IReadOnlyList<UserPinHistory> history, UserPinHistory? added)
    {
        var kept = history.OrderByDescending(item => item.CreatedAt).Take(PinPolicy.HistoryDepth - (added is null ? 0 : 1)).Select(item => item.Id).ToHashSet();
        if (added is not null) kept.Add(added.Id);
        return history.Where(item => !kept.Contains(item.Id)).ToArray();
    }

    private static CredentialAudit Audit(CredentialAuditType type, Guid target, Guid actor, DateTimeOffset now, Guid? deviceId, string? reason) => new()
    {
        Id = Guid.NewGuid(),
        EventType = type,
        TargetUserId = target,
        PerformedByUserId = actor,
        OccurredAt = now,
        DeviceId = deviceId,
        ReasonCode = reason,
    };
}

public static class LifecycleCommands
{
    public static CommandResult Submit(Permit permit, User actor, IReadOnlyCollection<string> roles, int hazardCount, DateTimeOffset now, Guid? deviceId, int? formVersion = null)
    {
        if (!PermitCapabilities.Has(roles, nameof(AppRole.REQUESTER))) return new CommandResult("capability-required");
        if (!actor.Enabled) return new CommandResult("user-disabled");
        if (permit.Status != PermitStatus.DRAFT) return new CommandResult("lifecycle-conflict");
        if (hazardCount < 1 || string.IsNullOrWhiteSpace(permit.JobDescription) || string.IsNullOrWhiteSpace(permit.WorkOrder))
        {
            return new CommandResult("permit-incomplete");
        }

        permit.Status = PermitStatus.PENDING_REVIEW;
        permit.UpdatedAt = now;
        if (permit.CreatedBy is null) permit.CreatedBy = actor.Id;
        if (permit.FormConfigurationVersion is null && formVersion is > 0) permit.FormConfigurationVersion = formVersion;
        return Record(permit, actor, nameof(AppRole.REQUESTER), "SUBMITTED", PermitEventType.PERMIT_SUBMITTED, now, deviceId);
    }

    public static CommandResult Authorize(
        Permit permit,
        User actor,
        UserCredential credential,
        IReadOnlyCollection<string> roles,
        IReadOnlyList<PermitApproval> approvals,
        int hazardCount,
        int ppeCount,
        bool allowSelf,
        string pin,
        int revision,
        DateTimeOffset now,
        IPinHasher hasher,
        Guid? deviceId)
    {
        if (!PermitCapabilities.Has(roles, nameof(AppRole.PERMIT_AUTHORIZER))) return new CommandResult("capability-required");
        if (permit.Status != PermitStatus.PENDING_REVIEW) return new CommandResult("lifecycle-conflict");
        if (permit.CurrentRevision != revision) return new CommandResult("revision-conflict");
        if (PermitPreparation.Blocking(permit.PermitType, permit.JobDescription, permit.WorkOrder, hazardCount, ppeCount).Count > 0)
        {
            return new CommandResult("permit-incomplete");
        }

        if (!allowSelf && (permit.CreatedBy == actor.Id || approvals.Any(item => item.UserId == actor.Id && item.Decision == "SUBMITTED")))
        {
            return new CommandResult("self-authorization-denied");
        }

        var pinError = Confirmed(credential, pin, now, hasher, deviceId);
        if (pinError.Error is not null) return pinError;
        permit.Status = PermitStatus.AUTHORIZED;
        permit.UpdatedAt = now;
        return Record(permit, actor, nameof(AppRole.PERMIT_AUTHORIZER), "AUTHORIZED", PermitEventType.PERMIT_AUTHORIZED, now, deviceId);
    }

    public static CommandResult Accept(Permit permit, User actor, UserCredential credential, IReadOnlyCollection<string> roles, string pin, int revision, DateTimeOffset now, IPinHasher hasher, Guid? deviceId)
    {
        if (!PermitCapabilities.Has(roles, nameof(AppRole.CRAFT_RECEIVER))) return new CommandResult("capability-required");
        if (permit.Status != PermitStatus.AUTHORIZED) return new CommandResult("lifecycle-conflict");
        if (permit.CurrentRevision != revision) return new CommandResult("revision-conflict");
        var pinError = Confirmed(credential, pin, now, hasher, deviceId);
        if (pinError.Error is not null) return pinError;
        permit.UpdatedAt = now;
        return Record(permit, actor, nameof(AppRole.CRAFT_RECEIVER), "ACCEPTED", PermitEventType.PERMIT_ACCEPTED, now, deviceId);
    }

    public static CommandResult Activate(
        Permit permit,
        User actor,
        UserCredential credential,
        IReadOnlyCollection<string> roles,
        IReadOnlyList<PermitApproval> approvals,
        IReadOnlyCollection<PermitModuleKind> modules,
        IReadOnlyCollection<QualificationType> qualified,
        int hazardCount,
        int ppeCount,
        string pin,
        int revision,
        string? actingRole,
        DateTimeOffset now,
        IPinHasher hasher,
        Guid? deviceId)
    {
        var role = string.IsNullOrWhiteSpace(actingRole) ? nameof(AppRole.PERMIT_AUTHORIZER) : actingRole;
        if (role is not (nameof(AppRole.PERMIT_AUTHORIZER) or nameof(AppRole.CRAFT_RECEIVER)) || !PermitCapabilities.Has(roles, role))
        {
            return new CommandResult("capability-required");
        }

        if (permit.Status != PermitStatus.AUTHORIZED) return new CommandResult("lifecycle-conflict");
        if (permit.CurrentRevision != revision) return new CommandResult("revision-conflict");
        if (approvals.All(item => item.Decision != "AUTHORIZED") || approvals.All(item => item.Decision != "ACCEPTED"))
        {
            return new CommandResult("lifecycle-conflict");
        }

        if (PermitPreparation.Blocking(permit.PermitType, permit.JobDescription, permit.WorkOrder, hazardCount, ppeCount).Count > 0)
        {
            return new CommandResult("permit-incomplete");
        }

        var missing = SpecialtyRequirements.Missing(permit.PermitType, modules, qualified);
        if (missing.Count > 0) return new CommandResult("specialty-incomplete");
        var pinError = Confirmed(credential, pin, now, hasher, deviceId);
        if (pinError.Error is not null) return pinError;
        permit.Status = PermitStatus.ACTIVE;
        permit.ActivatedAt = now;
        permit.UpdatedAt = now;
        return Record(permit, actor, role, "ACTIVATED", PermitEventType.PERMIT_ACTIVATED, now, deviceId);
    }

    public static CommandResult ReturnForCorrection(
        Permit permit,
        User actor,
        IReadOnlyCollection<string> roles,
        int revision,
        DateTimeOffset now,
        Guid? deviceId)
    {
        if (!PermitCapabilities.Has(roles, nameof(AppRole.REQUESTER)) && !PermitCapabilities.Has(roles, nameof(AppRole.PERMIT_AUTHORIZER)))
        {
            return new CommandResult("capability-required");
        }

        if (permit.Status != PermitStatus.AUTHORIZED) return new CommandResult("lifecycle-conflict");
        if (permit.CurrentRevision != revision) return new CommandResult("revision-conflict");
        permit.CurrentRevision += 1;
        permit.Status = PermitStatus.PENDING_REVIEW;
        permit.UpdatedAt = now;
        var recorded = new PermitRevision
        {
            Id = Guid.NewGuid(),
            PermitId = permit.Id,
            Number = permit.CurrentRevision,
            CreatedBy = actor.Id,
            CreatedAt = now,
        };
        var acting = PermitCapabilities.Has(roles, nameof(AppRole.PERMIT_AUTHORIZER))
            ? nameof(AppRole.PERMIT_AUTHORIZER)
            : nameof(AppRole.REQUESTER);
        var result = Record(permit, actor, acting, "RETURNED_FOR_CORRECTION", PermitEventType.PERMIT_RETURNED_FOR_CORRECTION, now, deviceId);
        return result with { Approval = null, Revision = recorded };
    }

    private static CommandResult Confirmed(UserCredential credential, string pin, DateTimeOffset now, IPinHasher hasher, Guid? deviceId)
    {
        if (credential.State == PinCredentialState.CHANGE_REQUIRED) return new CommandResult("pin-change-required");
        var verified = PinCommands.Verify(credential, pin, now, hasher, deviceId);
        if (verified.Error is not null) return verified;
        if (credential.State != PinCredentialState.ACTIVE) return new CommandResult("pin-not-enrolled");
        return new CommandResult(null);
    }

    private static CommandResult Record(Permit permit, User actor, string actingRole, string decision, PermitEventType type, DateTimeOffset now, Guid? deviceId)
    {
        var approval = new PermitApproval
        {
            Id = Guid.NewGuid(),
            PermitId = permit.Id,
            RoleName = actingRole,
            UserId = actor.Id,
            Decision = decision,
            DecidedAt = now,
            PermitRevision = permit.CurrentRevision,
            PermitUserCodeSnapshot = actor.PermitUserCode,
            DisplayNameSnapshot = actor.DisplayName,
            JobTitleSnapshot = actor.JobTitle,
            ActingRole = actingRole,
            WindowsUsernameSnapshot = actor.WindowsUsername,
        };
        var ev = new PermitEvent
        {
            Id = Guid.NewGuid(),
            PermitId = permit.Id,
            PermitRevision = permit.CurrentRevision,
            EventType = type,
            OccurredAt = now,
            RecordedAt = now,
            UserId = actor.Id,
            DeviceId = deviceId,
            SyncSource = SyncSource.SERVER,
            PermitUserCodeSnapshot = actor.PermitUserCode,
            DisplayNameSnapshot = actor.DisplayName,
            JobTitleSnapshot = actor.JobTitle,
            ActingRole = actingRole,
            WindowsUsernameSnapshot = actor.WindowsUsername,
        };
        return new CommandResult(null, Approval: approval, Event: ev);
    }
}

public static class SpecialtyRequirements
{
    public static IReadOnlyList<QualificationType> Missing(PermitType type, IReadOnlyCollection<PermitModuleKind> modules, IReadOnlyCollection<QualificationType> qualified)
    {
        var required = new List<QualificationType>();
        if (modules.Contains(PermitModuleKind.FIRE_WATCH) || type == PermitType.HOT_WORK) required.Add(QualificationType.FIRE_WATCH);
        if (type == PermitType.CONFINED_SPACE || modules.Contains(PermitModuleKind.CONFINED_SPACE))
        {
            required.Add(QualificationType.ATTENDANT);
            required.Add(QualificationType.AUTHORIZED_ENTRANT);
            required.Add(QualificationType.GAS_TESTER);
        }

        if (modules.Contains(PermitModuleKind.RESCUE) && !required.Contains(QualificationType.ATTENDANT)) required.Add(QualificationType.ATTENDANT);
        if (type == PermitType.EXCAVATION || modules.Contains(PermitModuleKind.EXCAVATION)) required.Add(QualificationType.COMPETENT_PERSON);
        if (type == PermitType.LIVE_ELECTRICAL || modules.Contains(PermitModuleKind.LIVE_ELECTRICAL))
        {
            required.Add(QualificationType.QUALIFIED_ELECTRICAL_WORKER);
        }

        if (modules.Contains(PermitModuleKind.ATMOSPHERIC_MONITORING) && type is PermitType.HOT_WORK or PermitType.CONFINED_SPACE)
        {
            if (!required.Contains(QualificationType.GAS_TESTER)) required.Add(QualificationType.GAS_TESTER);
        }

        return required.Where(item => !qualified.Contains(item)).Distinct().ToArray();
    }
}
