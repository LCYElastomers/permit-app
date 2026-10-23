namespace PermitControl.Domain;

public enum AppRole
{
    SUPER_ADMIN,
    ADMIN,
    REQUESTER,
    PERMIT_AUTHORIZER,
    SHIFT_SUPERVISOR,
    CRAFT_RECEIVER,
    SAFETY,
    VIEWER,
}

public enum QualificationType
{
    GAS_TESTER,
    FIRE_WATCH,
    ATTENDANT,
    AUTHORIZED_ENTRANT,
    COMPETENT_PERSON,
    QUALIFIED_ELECTRICAL_WORKER,
    SAFETY_WATCH,
}

public enum PinCredentialState
{
    NOT_ENROLLED,
    ACTIVE,
    CHANGE_REQUIRED,
    ENROLLMENT_REQUIRED,
    TEMPORARILY_LOCKED,
}

public enum CredentialAuditType
{
    PIN_ENROLLED,
    PIN_CHANGED,
    PIN_CHANGE_REQUIRED,
    PIN_ENROLLMENT_RESET,
    PIN_LOCKED,
    PIN_UNLOCKED,
}

public sealed class UserCredential
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public PinCredentialState State { get; set; } = PinCredentialState.NOT_ENROLLED;
    public PinCredentialState? ResumeState { get; set; }
    public string? PinHash { get; set; }
    public int FailedAttempts { get; set; }
    public DateTimeOffset? LockedUntil { get; set; }
    public DateTimeOffset? PinChangedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? UpdatedAt { get; set; }
    public User? User { get; set; }
}

public sealed class UserPinHistory
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string PinHash { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; }
    public User? User { get; set; }
}

public sealed class UserQualification
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public QualificationType QualificationType { get; set; }
    public DateTimeOffset? EffectiveDate { get; set; }
    public DateTimeOffset? ExpirationDate { get; set; }
    public bool Enabled { get; set; } = true;
    public Guid? VerifiedByUserId { get; set; }
    public string? Notes { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? UpdatedAt { get; set; }
    public User? User { get; set; }
}

public sealed class CredentialAudit
{
    public Guid Id { get; set; }
    public CredentialAuditType EventType { get; set; }
    public Guid TargetUserId { get; set; }
    public Guid PerformedByUserId { get; set; }
    public DateTimeOffset OccurredAt { get; set; }
    public Guid? DeviceId { get; set; }
    public string? ReasonCode { get; set; }
}

public sealed class UserSession
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string TokenHash { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset? RevokedAt { get; set; }
    public User? User { get; set; }
}

public sealed class UserCodeCounter
{
    public int Id { get; set; }
    public int LastValue { get; set; }
}

public sealed class PermitPolicySetting
{
    public string Key { get; set; } = "";
    public bool Enabled { get; set; }
}
