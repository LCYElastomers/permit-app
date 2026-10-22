using PermitControl.Domain;

namespace PermitControl.Application;

public sealed record HealthResponse(string Status, string Service, bool DatabaseConfigured);

public sealed record ReadinessResponse(string Status);

public sealed record PermitSummary(
    Guid Id,
    string PermitNumber,
    PermitType PermitType,
    PermitStatus Status,
    Guid AreaId,
    Guid? EquipmentId,
    string WorkOrder,
    string JobDescription,
    DateTimeOffset PlannedStart,
    DateTimeOffset ExpiresAt,
    DateTimeOffset? ClosedAt);

public sealed record PermitListResponse(IReadOnlyList<PermitSummary> Items);

public sealed record CreatePermitRequest(
    Guid Id,
    string PermitNumber,
    PermitType PermitType,
    Guid AreaId,
    Guid? EquipmentId,
    string WorkOrder,
    string JobDescription,
    CompanyType CompanyType,
    Guid? ContractorId,
    Guid CreatedBy,
    DateTimeOffset PlannedStart,
    DateTimeOffset ExpiresAt);

public sealed record AreaResponse(Guid Id, string Name);

public sealed record CreateAreaRequest(Guid? Id, string? Name);
public sealed record EquipmentResponse(Guid Id, Guid AreaId, string Tag, string Name);
public sealed record ContractorResponse(Guid Id, string Name);

public sealed record SyncPushRequest(IReadOnlyList<SyncPushEvent>? Events);

public sealed record SyncPushEvent(
    Guid Id,
    Guid PermitId,
    int PermitRevision,
    string? EventType,
    DateTimeOffset OccurredAt,
    Guid? UserId,
    Guid? DeviceId,
    GeneralWorkPermitSync? Permit);

public sealed record GeneralWorkPermitSync(
    string? PermitType,
    Guid? AreaId,
    string? AreaName,
    string? EquipmentTag,
    string? WorkOrder,
    string? JobDescription,
    string? CompanyType,
    string? CompanyName,
    string? Requester,
    string? Craft,
    string? PlannedStartClock,
    string? PlannedExpirationClock,
    IReadOnlyList<string>? Hazards,
    IReadOnlyList<string>? Controls,
    IReadOnlyList<string>? Ppe,
    string? TaskType,
    string? EquipmentSystem,
    string? ServiceProcess,
    string? MaterialInService,
    string? Coordination,
    string? HeightControls,
    IReadOnlyDictionary<string, string>? Exclusions);

public sealed record SyncPushResponse(IReadOnlyList<SyncAcknowledgement> Acknowledgements);

public sealed record SyncAcknowledgement(
    Guid EventId,
    Guid PermitId,
    string PermitNumber,
    int PermitRevision,
    string Result);

public sealed record SyncEventRequest(
    Guid Id,
    Guid PermitId,
    int PermitRevision,
    PermitEventType EventType,
    DateTimeOffset OccurredAt,
    Guid? UserId,
    Guid? DeviceId,
    string? Payload);

public sealed record SyncPullResponse(DateTimeOffset Since, IReadOnlyList<SyncEventRequest> Events);

public sealed record StoredFile(string StoredFilename, StorageProvider Provider, string StorageKey);

public sealed record FileSaveRequest(Guid Id, string OriginalFilename, string MimeType, byte[] Content);
