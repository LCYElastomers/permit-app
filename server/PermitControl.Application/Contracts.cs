using PermitControl.Domain;

namespace PermitControl.Application;

public sealed record HealthResponse(string Status, string Service, bool DatabaseConfigured);

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
public sealed record EquipmentResponse(Guid Id, Guid AreaId, string Tag, string Name);
public sealed record ContractorResponse(Guid Id, string Name);

public sealed record SyncPushRequest(IReadOnlyList<SyncEventRequest> Events);

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
