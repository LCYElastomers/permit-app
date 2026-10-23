using System.Text.Json;
using System.Text.Json.Serialization;

namespace PermitControl.Domain;

public sealed class GeneralWorkBody
{
    public string PermitType { get; set; } = "";
    public Guid? AreaId { get; init; }
    public string? AreaName { get; init; }
    public string? EquipmentTag { get; init; }
    public string? WorkOrder { get; init; }
    public string? JobDescription { get; init; }
    public string? CompanyType { get; init; }
    public string? CompanyName { get; init; }
    public string? Requester { get; init; }
    public string? Craft { get; init; }
    public string? PlannedStartClock { get; init; }
    public string? PlannedExpirationClock { get; init; }
    public IReadOnlyList<string>? Hazards { get; init; }
    public IReadOnlyList<string>? Controls { get; init; }
    public IReadOnlyList<string>? Ppe { get; init; }
    public string? TaskType { get; init; }
    public string? EquipmentSystem { get; init; }
    public string? ServiceProcess { get; init; }
    public string? MaterialInService { get; init; }
    public string? Coordination { get; init; }
    public string? HeightControls { get; init; }
    public IReadOnlyDictionary<string, string>? Exclusions { get; init; }
    public IReadOnlyList<ModuleFactInput>? ModuleFacts { get; set; }
}

public sealed class ModuleFactInput
{
    public string Module { get; set; } = "";
    public string Name { get; set; } = "";
    public string Value { get; set; } = "";
}

public sealed class GeneralWorkPush
{
    public Guid EventId { get; init; }
    public Guid PermitId { get; init; }
    public int Revision { get; init; }
    public string EventType { get; init; } = "";
    public DateTimeOffset OccurredAt { get; init; }
    public Guid? UserId { get; init; }
    public Guid? DeviceId { get; init; }
    public GeneralWorkBody? Body { get; init; }
}

public enum GeneralWorkResultKind
{
    Accepted,
    Duplicate,
    Invalid,
    Conflict,
}

public sealed class GeneralWorkResult
{
    public GeneralWorkResultKind Kind { get; init; }
    public string? Error { get; init; }
    public string? PermitNumber { get; init; }
    public Guid PermitId { get; init; }
    public Guid EventId { get; init; }
    public int Revision { get; init; }
    public GeneralWorkPlan? Plan { get; init; }

    public static GeneralWorkResult Accepted(GeneralWorkPlan plan) => new()
    {
        Kind = GeneralWorkResultKind.Accepted,
        PermitNumber = plan.Permit.PermitNumber,
        PermitId = plan.Permit.Id,
        EventId = plan.Event.Id,
        Revision = plan.Permit.CurrentRevision,
        Plan = plan,
    };

    public static GeneralWorkResult Duplicate(Guid eventId, Guid permitId, string permitNumber) => new()
    {
        Kind = GeneralWorkResultKind.Duplicate,
        PermitNumber = permitNumber,
        PermitId = permitId,
        EventId = eventId,
        Revision = 1,
    };

    public static GeneralWorkResult Invalid(string error) => new() { Kind = GeneralWorkResultKind.Invalid, Error = error };
    public static GeneralWorkResult Conflict(string error) => new() { Kind = GeneralWorkResultKind.Conflict, Error = error };
}

public sealed class GeneralWorkPlan
{
    public required Permit Permit { get; init; }
    public required PermitRevision Revision { get; init; }
    public required PermitEvent Event { get; init; }
    public required SyncEvent Receipt { get; init; }
    public required IReadOnlyList<PermitParticipant> Participants { get; init; }
    public required IReadOnlyList<PermitHazard> Hazards { get; init; }
    public required IReadOnlyList<PermitControlRecord> Controls { get; init; }
    public required IReadOnlyList<PermitPpe> Ppe { get; init; }
    public required IReadOnlyList<PermitModule> Modules { get; init; }
    public required IReadOnlyList<PermitModuleFact> ModuleFacts { get; init; }
}

public static class PermitNumbers
{
    public const int Width = 5;

    public static string Format(int year, int sequence)
    {
        if (year is < 2000 or > 9999 || sequence < 1)
        {
            throw new ArgumentOutOfRangeException(nameof(sequence));
        }

        return $"PTW-{year}-{sequence.ToString().PadLeft(Width, '0')}";
    }
}

/// <summary>
/// Locked counter with the same allocate-or-revert rule as the PostgreSQL
/// permit_number_counters row. Production uses that row inside the acceptance transaction.
/// </summary>
public sealed class PermitNumberAllocator
{
    private readonly object gate = new();
    private readonly Dictionary<int, int> last = [];

    public string Allocate(int year)
    {
        lock (gate)
        {
            var next = last.GetValueOrDefault(year) + 1;
            last[year] = next;
            return PermitNumbers.Format(year, next);
        }
    }

    public void Revert(int year, string number)
    {
        lock (gate)
        {
            var current = last.GetValueOrDefault(year);
            if (PermitNumbers.Format(year, current) == number && current > 0)
            {
                last[year] = current - 1;
            }
        }
    }
}

public static class PermitNumberSql
{
    public const string Allocate =
        """
        INSERT INTO permit_number_counters ("Year", "LastValue")
        VALUES (@year, 1)
        ON CONFLICT ("Year") DO UPDATE
        SET "LastValue" = permit_number_counters."LastValue" + 1
        RETURNING "LastValue"
        """;
}

public static class GeneralWorkAcceptance
{
    private static readonly string[] ExclusionKeys =
    [
        "excludeOpening",
        "excludeContainment",
        "excludeEntry",
        "excludeIsolation",
        "excludeHotWork",
    ];

    private static readonly JsonSerializerOptions PayloadJson = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    public static string? Validate(GeneralWorkPush push)
    {
        if (push.EventId == Guid.Empty) return "event-id-required";
        if (push.PermitId == Guid.Empty) return "permit-id-required";
        if (push.Revision != 1) return "revision-invalid";
        if (!string.Equals(push.EventType, nameof(PermitEventType.PERMIT_CREATED), StringComparison.Ordinal))
        {
            return "event-not-supported";
        }

        if (push.OccurredAt == default) return "occurred-at-required";
        if (push.Body is null) return "permit-required";
        if (!PermitModuleComposition.TryType(push.Body.PermitType, out _))
        {
            return "permit-type-invalid";
        }

        if (push.Body.AreaId == Guid.Empty) return "area-invalid";
        if (!TryCompany(push.Body.CompanyType, out _)) return "company-type-invalid";
        if (Length(push.Body.WorkOrder) > 40) return "work-order-too-long";
        if (Length(push.Body.JobDescription) > 2000) return "job-description-too-long";
        if (Length(push.Body.AreaName) > 120) return "area-name-too-long";
        if (Length(push.Body.Requester) > 160 || Length(push.Body.Craft) > 160 || Length(push.Body.CompanyName) > 160)
        {
            return "name-too-long";
        }

        if (Labels(push.Body.Hazards).Any(label => label.Length > 160)
            || Labels(push.Body.Controls).Any(label => label.Length > 160))
        {
            return "label-too-long";
        }

        return null;
    }

    public static GeneralWorkPlan Build(GeneralWorkPush push, string permitNumber, DateTimeOffset recordedAt)
    {
        var body = push.Body ?? throw new InvalidOperationException("permit body is required");
        TryCompany(body.CompanyType, out var company);
        if (!PermitModuleComposition.TryType(body.PermitType, out var permitType))
        {
            throw new InvalidOperationException("permit type is required");
        }
        var permit = new Permit
        {
            Id = push.PermitId,
            PermitNumber = permitNumber,
            PermitType = permitType,
            Status = PermitStatus.DRAFT,
            AreaId = body.AreaId,
            EquipmentId = null,
            WorkOrder = body.WorkOrder?.Trim() ?? "",
            JobDescription = body.JobDescription?.Trim() ?? "",
            CompanyType = company,
            ContractorId = null,
            CreatedBy = null,
            CreatedAt = recordedAt,
            UpdatedAt = recordedAt,
            PlannedStart = null,
            ExpiresAt = null,
            CurrentRevision = 1,
        };
        var revision = new PermitRevision
        {
            Id = Guid.NewGuid(),
            PermitId = permit.Id,
            Number = 1,
            CreatedBy = null,
            CreatedAt = recordedAt,
        };
        var participants = new List<PermitParticipant>();
        AddParticipant(participants, permit.Id, "Requester", body.Requester);
        AddParticipant(participants, permit.Id, "Craft / Permit Receiver", body.Craft);
        var hazards = Labels(body.Hazards).Select(label => new PermitHazard
        {
            Id = Guid.NewGuid(),
            PermitId = permit.Id,
            Label = label,
        }).ToList();
        var controls = Labels(body.Controls).Select(label => new PermitControlRecord
        {
            Id = Guid.NewGuid(),
            PermitId = permit.Id,
            Label = label,
        }).ToList();
        var ppe = Labels(body.Ppe).Where(label => label.Length <= 160).Select(label => new PermitPpe
        {
            Id = Guid.NewGuid(),
            PermitId = permit.Id,
            Label = label,
        }).ToList();
        var modules = PermitModuleComposition.For(permitType)
            .Select(item => Module(permit.Id, item.Kind, item.Required))
            .ToList();
        AddApplicableModules(modules, permitType, permit.Id, body);
        var moduleFacts = ModuleFacts(permit.Id, body);
        return new GeneralWorkPlan
        {
            Permit = permit,
            Revision = revision,
            Event = new PermitEvent
            {
                Id = push.EventId,
                PermitId = permit.Id,
                PermitRevision = 1,
                EventType = PermitEventType.PERMIT_CREATED,
                OccurredAt = push.OccurredAt,
                RecordedAt = recordedAt,
                UserId = push.UserId,
                DeviceId = push.DeviceId,
                Payload = Facts(body),
                SyncSource = SyncSource.CLIENT,
            },
            Receipt = new SyncEvent
            {
                Id = push.EventId,
                DeviceId = push.DeviceId,
                PermitId = permit.Id,
                EventType = PermitEventType.PERMIT_CREATED,
                ReceivedAt = recordedAt,
            },
            Participants = participants,
            Hazards = hazards,
            Controls = controls,
            Ppe = ppe,
            Modules = modules,
            ModuleFacts = moduleFacts,
        };
    }

    private static List<PermitModuleFact> ModuleFacts(Guid permitId, GeneralWorkBody body)
    {
        var facts = new List<PermitModuleFact>();
        void Add(PermitModuleKind module, string name, string? value)
        {
            var trimmed = value?.Trim();
            if (string.IsNullOrEmpty(trimmed) || trimmed.Length > 500 || name.Length > 80) return;
            if (facts.Any(item => item.ModuleKind == module && item.Name == name)) return;
            facts.Add(new PermitModuleFact
            {
                Id = Guid.NewGuid(),
                PermitId = permitId,
                ModuleKind = module,
                Name = name,
                Value = trimmed,
            });
        }

        Add(PermitModuleKind.CORE, "taskType", body.TaskType);
        Add(PermitModuleKind.CORE, "equipmentSystem", body.EquipmentSystem);
        Add(PermitModuleKind.CORE, "serviceProcess", body.ServiceProcess);
        Add(PermitModuleKind.CORE, "materialInService", body.MaterialInService);
        Add(PermitModuleKind.CORE, "coordination", body.Coordination);
        Add(PermitModuleKind.WORKING_AT_HEIGHT, "heightControls", body.HeightControls);
        foreach (var item in body.ModuleFacts ?? [])
        {
            if (!Enum.TryParse(item.Module, out PermitModuleKind module) || !Enum.IsDefined(module)) continue;
            Add(module, item.Name.Trim(), item.Value);
        }

        return facts;
    }

    private static string? Facts(GeneralWorkBody body)
    {
        var exclusions = body.Exclusions?
            .Where(item => ExclusionKeys.Contains(item.Key, StringComparer.Ordinal) && !string.IsNullOrWhiteSpace(item.Value))
            .ToDictionary(item => item.Key, item => item.Value.Trim());
        var longPpe = Labels(body.Ppe).Where(label => label.Length > 160).ToArray();
        var facts = new Dictionary<string, object?>();
        Add(facts, "areaName", body.AreaName);
        Add(facts, "equipmentTag", body.EquipmentTag);
        Add(facts, "companyName", body.CompanyName);
        Add(facts, "plannedStartClock", body.PlannedStartClock);
        Add(facts, "plannedExpirationClock", body.PlannedExpirationClock);
        Add(facts, "taskType", body.TaskType);
        Add(facts, "equipmentSystem", body.EquipmentSystem);
        Add(facts, "serviceProcess", body.ServiceProcess);
        Add(facts, "materialInService", body.MaterialInService);
        Add(facts, "coordination", body.Coordination);
        Add(facts, "heightControls", body.HeightControls);
        if (exclusions is { Count: > 0 }) facts["exclusions"] = exclusions;
        if (longPpe.Length > 0) facts["ppeText"] = longPpe;
        if (!string.Equals(body.PermitType, nameof(PermitType.GENERAL_WORK), StringComparison.Ordinal)) return null;
        facts["kind"] = "general-work-facts";
        return JsonSerializer.Serialize(facts, PayloadJson);
    }

    private static void Add(Dictionary<string, object?> facts, string key, string? value)
    {
        var trimmed = value?.Trim();
        if (!string.IsNullOrEmpty(trimmed)) facts[key] = trimmed;
    }

    private static void AddParticipant(List<PermitParticipant> participants, Guid permitId, string role, string? name)
    {
        var trimmed = name?.Trim();
        if (string.IsNullOrEmpty(trimmed)) return;
        participants.Add(new PermitParticipant
        {
            Id = Guid.NewGuid(),
            PermitId = permitId,
            RoleName = role,
            DisplayName = trimmed,
        });
    }

    private static void AddApplicableModules(List<PermitModule> modules, PermitType type, Guid permitId, GeneralWorkBody body)
    {
        var facts = body.ModuleFacts ?? [];
        bool Fact(PermitModuleKind kind) => facts.Any(item =>
            Enum.TryParse(item.Module, out PermitModuleKind parsed)
            && Enum.IsDefined(parsed)
            && parsed == kind
            && !string.IsNullOrWhiteSpace(item.Value));
        void Ensure(PermitModuleKind kind)
        {
            if (Fact(kind) && modules.All(item => item.Kind != kind))
                modules.Add(Module(permitId, kind, false));
        }

        if ((!string.IsNullOrWhiteSpace(body.HeightControls) || Fact(PermitModuleKind.WORKING_AT_HEIGHT))
            && modules.All(item => item.Kind != PermitModuleKind.WORKING_AT_HEIGHT))
        {
            modules.Add(Module(permitId, PermitModuleKind.WORKING_AT_HEIGHT, false));
        }

        if (type == PermitType.GENERAL_WORK) Ensure(PermitModuleKind.PROCEDURE);
        else if (type == PermitType.HOT_WORK) Ensure(PermitModuleKind.LOTO_ISOLATION);
        else if (type == PermitType.CONFINED_SPACE)
        {
            Ensure(PermitModuleKind.HOT_WORK);
            Ensure(PermitModuleKind.FIRE_WATCH);
        }
        else if (type is PermitType.OPENING_BLINDING or PermitType.EXCAVATION)
            Ensure(PermitModuleKind.ATMOSPHERIC_MONITORING);
    }

    private static PermitModule Module(Guid permitId, PermitModuleKind kind, bool required) => new()
    {
        Id = Guid.NewGuid(),
        PermitId = permitId,
        Kind = kind,
        Required = required,
    };

    private static IEnumerable<string> Labels(IReadOnlyList<string>? values) =>
        (values ?? []).Select(value => value.Trim()).Where(value => value.Length > 0).Distinct(StringComparer.Ordinal);

    private static int Length(string? value) => value?.Trim().Length ?? 0;

    private static bool TryCompany(string? value, out CompanyType company)
    {
        if (string.Equals(value, nameof(CompanyType.LCY), StringComparison.Ordinal))
        {
            company = CompanyType.LCY;
            return true;
        }

        if (string.Equals(value, nameof(CompanyType.CONTRACTOR), StringComparison.Ordinal))
        {
            company = CompanyType.CONTRACTOR;
            return true;
        }

        company = default;
        return false;
    }
}

public static class PermitModuleComposition
{
    public static bool TryType(string? value, out PermitType type) =>
        Enum.TryParse(value, out type) && Enum.IsDefined(type);

    public static IReadOnlyList<(PermitModuleKind Kind, bool Required)> For(PermitType type) => type switch
    {
        PermitType.GENERAL_WORK =>
        [
            (PermitModuleKind.CORE, true),
            (PermitModuleKind.JSA, true),
            (PermitModuleKind.HAZARD_ASSESSMENT, true),
            (PermitModuleKind.PPE, true),
        ],
        PermitType.HOT_WORK =>
        [
            (PermitModuleKind.CORE, true),
            (PermitModuleKind.JSA, true),
            (PermitModuleKind.HAZARD_ASSESSMENT, true),
            (PermitModuleKind.PPE, true),
            (PermitModuleKind.ATMOSPHERIC_MONITORING, true),
            (PermitModuleKind.HOT_WORK, true),
            (PermitModuleKind.FIRE_WATCH, true),
        ],
        PermitType.CONFINED_SPACE =>
        [
            (PermitModuleKind.CORE, true),
            (PermitModuleKind.JSA, true),
            (PermitModuleKind.HAZARD_ASSESSMENT, true),
            (PermitModuleKind.PPE, true),
            (PermitModuleKind.LOTO_ISOLATION, true),
            (PermitModuleKind.ATMOSPHERIC_MONITORING, true),
            (PermitModuleKind.CONFINED_SPACE, true),
            (PermitModuleKind.RESCUE, true),
        ],
        PermitType.OPENING_BLINDING =>
        [
            (PermitModuleKind.CORE, true),
            (PermitModuleKind.JSA, true),
            (PermitModuleKind.HAZARD_ASSESSMENT, true),
            (PermitModuleKind.PPE, true),
            (PermitModuleKind.LOTO_ISOLATION, true),
            (PermitModuleKind.OPENING_BLINDING, true),
        ],
        PermitType.EXCAVATION =>
        [
            (PermitModuleKind.CORE, true),
            (PermitModuleKind.JSA, true),
            (PermitModuleKind.HAZARD_ASSESSMENT, true),
            (PermitModuleKind.PPE, true),
            (PermitModuleKind.EXCAVATION, true),
        ],
        PermitType.LIVE_ELECTRICAL =>
        [
            (PermitModuleKind.CORE, true),
            (PermitModuleKind.JSA, true),
            (PermitModuleKind.HAZARD_ASSESSMENT, true),
            (PermitModuleKind.PPE, true),
            (PermitModuleKind.LIVE_ELECTRICAL, true),
        ],
        _ => [(PermitModuleKind.CORE, true)],
    };
}

public sealed class GeneralWorkSession
{
    private readonly PermitNumberAllocator numbers = new();
    private readonly List<Permit> permits = [];
    private readonly List<PermitEvent> events = [];
    private readonly List<SyncEvent> receipts = [];
    private readonly List<PermitRevision> revisions = [];

    public IReadOnlyList<Permit> Permits => permits;
    public IReadOnlyList<PermitEvent> Events => events;
    public IReadOnlyList<SyncEvent> Receipts => receipts;
    public IReadOnlyList<PermitRevision> Revisions => revisions;

    public GeneralWorkResult Accept(GeneralWorkPush push, DateTimeOffset recordedAt, bool failBeforeCommit = false)
    {
        var existing = receipts.FirstOrDefault(item => item.Id == push.EventId);
        if (existing is not null)
        {
            if (existing.PermitId != push.PermitId) return GeneralWorkResult.Conflict("event-permit-mismatch");
            var stored = permits.First(item => item.Id == push.PermitId);
            return GeneralWorkResult.Duplicate(push.EventId, push.PermitId, stored.PermitNumber);
        }

        if (permits.Any(item => item.Id == push.PermitId)) return GeneralWorkResult.Conflict("permit-already-created");
        var error = GeneralWorkAcceptance.Validate(push);
        if (error is not null) return GeneralWorkResult.Invalid(error);

        string? number = null;
        try
        {
            if (failBeforeCommit) throw new InvalidOperationException("commit failed");
            number = numbers.Allocate(recordedAt.Year);
            var plan = GeneralWorkAcceptance.Build(push, number, recordedAt);
            permits.Add(plan.Permit);
            revisions.Add(plan.Revision);
            events.Add(plan.Event);
            receipts.Add(plan.Receipt);
            return GeneralWorkResult.Accepted(plan);
        }
        catch
        {
            if (number is not null) numbers.Revert(recordedAt.Year, number);
            permits.RemoveAll(item => item.Id == push.PermitId);
            revisions.RemoveAll(item => item.PermitId == push.PermitId);
            events.RemoveAll(item => item.Id == push.EventId);
            receipts.RemoveAll(item => item.Id == push.EventId);
            throw;
        }
    }
}
