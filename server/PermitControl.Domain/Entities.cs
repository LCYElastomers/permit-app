namespace PermitControl.Domain;

public sealed class User
{
    public Guid Id { get; set; }
    public string Username { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public string Email { get; set; } = "";
    public AuthProvider AuthProvider { get; set; } = AuthProvider.LOCAL;
    public string? ExternalSubjectId { get; set; }
    public bool Enabled { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; }
}

public sealed class Role
{
    public Guid Id { get; set; }
    public string Name { get; set; } = "";
}

public sealed class UserRole
{
    public Guid UserId { get; set; }
    public Guid RoleId { get; set; }
    public User? User { get; set; }
    public Role? Role { get; set; }
}

public sealed class Area
{
    public Guid Id { get; set; }
    public string Name { get; set; } = "";
}

public sealed class Equipment
{
    public Guid Id { get; set; }
    public Guid AreaId { get; set; }
    public string Tag { get; set; } = "";
    public string Name { get; set; } = "";
    public Area? Area { get; set; }
}

public sealed class Contractor
{
    public Guid Id { get; set; }
    public string Name { get; set; } = "";
}

public sealed class Permit
{
    public Guid Id { get; set; }
    public string PermitNumber { get; set; } = "";
    public PermitType PermitType { get; set; }
    public PermitStatus Status { get; set; }
    public Guid AreaId { get; set; }
    public Guid? EquipmentId { get; set; }
    public string WorkOrder { get; set; } = "";
    public string JobDescription { get; set; } = "";
    public CompanyType CompanyType { get; set; }
    public Guid? ContractorId { get; set; }
    public Guid CreatedBy { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public DateTimeOffset PlannedStart { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset? ActivatedAt { get; set; }
    public DateTimeOffset? ClosedAt { get; set; }
    public int CurrentRevision { get; set; }

    public Area? Area { get; set; }
    public Equipment? Equipment { get; set; }
    public Contractor? Contractor { get; set; }
    public User? Creator { get; set; }
}

public sealed class PermitRevision
{
    public Guid Id { get; set; }
    public Guid PermitId { get; set; }
    public int Number { get; set; }
    public Guid CreatedBy { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public Permit? Permit { get; set; }
}

public sealed class PermitEvent
{
    public Guid Id { get; set; }
    public Guid PermitId { get; set; }
    public int PermitRevision { get; set; }
    public PermitEventType EventType { get; set; }
    public DateTimeOffset OccurredAt { get; set; }
    public DateTimeOffset RecordedAt { get; set; }
    public Guid? UserId { get; set; }
    public Guid? DeviceId { get; set; }
    public string? Payload { get; set; }
    public SyncSource SyncSource { get; set; }
    public Permit? Permit { get; set; }
}

public sealed class PermitParticipant
{
    public Guid Id { get; set; }
    public Guid PermitId { get; set; }
    public string RoleName { get; set; } = "";
    public Guid? UserId { get; set; }
    public string DisplayName { get; set; } = "";
    public Permit? Permit { get; set; }
}

public sealed class PermitApproval
{
    public Guid Id { get; set; }
    public Guid PermitId { get; set; }
    public string RoleName { get; set; } = "";
    public Guid? UserId { get; set; }
    public string Decision { get; set; } = "";
    public DateTimeOffset? DecidedAt { get; set; }
    public Permit? Permit { get; set; }
}

public sealed class PermitModule
{
    public Guid Id { get; set; }
    public Guid PermitId { get; set; }
    public PermitModuleKind Kind { get; set; }
    public bool Required { get; set; }
    public Permit? Permit { get; set; }
}

public sealed class PermitHazard
{
    public Guid Id { get; set; }
    public Guid PermitId { get; set; }
    public Guid? ModuleId { get; set; }
    public string Label { get; set; } = "";
}

public sealed class PermitControlRecord
{
    public Guid Id { get; set; }
    public Guid PermitId { get; set; }
    public Guid? ModuleId { get; set; }
    public string Label { get; set; } = "";
}

public sealed class PermitPpe
{
    public Guid Id { get; set; }
    public Guid PermitId { get; set; }
    public string Label { get; set; } = "";
}

public sealed class AtmosphericTest
{
    public Guid Id { get; set; }
    public Guid PermitId { get; set; }
    public Guid? ModuleId { get; set; }
    public DateTimeOffset TestedAt { get; set; }
    public decimal? OxygenPercent { get; set; }
    public decimal? LelPercent { get; set; }
    public decimal? CarbonMonoxidePpm { get; set; }
    public Guid? TesterUserId { get; set; }
    public TestResult Result { get; set; } = TestResult.RECORDED;
    public string? Notes { get; set; }
    public Permit? Permit { get; set; }
}

public sealed class Isolation
{
    public Guid Id { get; set; }
    public Guid PermitId { get; set; }
    public Guid? ModuleId { get; set; }
    public string Plan { get; set; } = "";
    public string? LockBox { get; set; }
    public DateTimeOffset? ZeroEnergyVerifiedAt { get; set; }
    public Guid? VerifiedBy { get; set; }
    public Permit? Permit { get; set; }
}

public sealed class PermitSuspension
{
    public Guid Id { get; set; }
    public Guid PermitId { get; set; }
    public Guid? EventId { get; set; }
    public string Reason { get; set; } = "";
    public DateTimeOffset SuspendedAt { get; set; }
    public Guid SuspendedBy { get; set; }
}

public sealed class PermitExtension
{
    public Guid Id { get; set; }
    public Guid PermitId { get; set; }
    public DateTimeOffset PreviousExpiresAt { get; set; }
    public DateTimeOffset NewExpiresAt { get; set; }
    public DateTimeOffset ExtendedAt { get; set; }
    public Guid ExtendedBy { get; set; }
}

public sealed class PermitReauthorization
{
    public Guid Id { get; set; }
    public Guid PermitId { get; set; }
    public DateTimeOffset ReauthorizedAt { get; set; }
    public Guid ReauthorizedBy { get; set; }
}

public sealed class PermitClosure
{
    public Guid Id { get; set; }
    public Guid PermitId { get; set; }
    public DateTimeOffset ClosedAt { get; set; }
    public Guid ClosedBy { get; set; }
    public string? Notes { get; set; }
}

public sealed class Attachment
{
    public Guid Id { get; set; }
    public Guid PermitId { get; set; }
    public Guid? PermitRevisionId { get; set; }
    public string OriginalFilename { get; set; } = "";
    public string StoredFilename { get; set; } = "";
    public StorageProvider StorageProvider { get; set; } = StorageProvider.LOCAL_SERVER;
    public string StorageKey { get; set; } = "";
    public string MimeType { get; set; } = "";
    public long FileSize { get; set; }
    public string Sha256 { get; set; } = "";
    public Guid CreatedBy { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public Guid? SupersededBy { get; set; }
    public Permit? Permit { get; set; }
}

public sealed class Device
{
    public Guid Id { get; set; }
    public string Name { get; set; } = "";
    public DateTimeOffset? LastSeenAt { get; set; }
}

public sealed class SyncEvent
{
    public Guid Id { get; set; }
    public Guid? DeviceId { get; set; }
    public Guid? PermitId { get; set; }
    public PermitEventType EventType { get; set; }
    public DateTimeOffset ReceivedAt { get; set; }
}
