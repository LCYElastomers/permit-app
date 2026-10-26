using System.Security.Cryptography;
using System.Text.Json;

namespace PermitControl.Domain;

public sealed class AuthoritativeGeneralWork
{
    public required Permit Permit { get; init; }
    public string? AreaName { get; init; }
    public string? EquipmentTag { get; init; }
    public string? CompanyName { get; init; }
    public IReadOnlyList<PermitHazard> Hazards { get; set; } = [];
    public IReadOnlyList<PermitControlRecord> Controls { get; set; } = [];
    public IReadOnlyList<PermitPpe> Ppe { get; set; } = [];
    public IReadOnlyList<PermitModule> Modules { get; init; } = [];
    public IReadOnlyList<PermitParticipant> Participants { get; init; } = [];
    public string? CreationFactsJson { get; init; }
    public string? SuspensionReason { get; init; }
    public DateTimeOffset? SuspendedAt { get; init; }
    public string? SuspendedByName { get; init; }
    public string? SuspendedByCode { get; init; }
    public IReadOnlyList<PermitModuleFact> ModuleFacts { get; set; } = [];
    public IReadOnlyList<PermitApproval> Approvals { get; set; } = [];
}

public sealed class GeneralWorkFacts
{
    public static readonly GeneralWorkFacts Empty = new();

    public string? AreaName { get; init; }
    public string? EquipmentTag { get; init; }
    public string? CompanyName { get; init; }
    public string? PlannedStartClock { get; init; }
    public string? PlannedExpirationClock { get; init; }
    public string? TaskType { get; init; }
    public string? EquipmentSystem { get; init; }
    public string? ServiceProcess { get; init; }
    public string? MaterialInService { get; init; }
    public string? Coordination { get; init; }
    public string? HeightControls { get; init; }
    public IReadOnlyList<string> PpeText { get; init; } = [];
    public IReadOnlyDictionary<string, string> Exclusions { get; init; } = new Dictionary<string, string>();
}

public sealed class DocumentSection
{
    public required string Title { get; init; }
    public required IReadOnlyList<string> Lines { get; init; }
}

public sealed class DocumentRunningHeader
{
    public required string PermitNumber { get; init; }
    public required int Revision { get; init; }
    public required string Status { get; init; }
    public required string Authority { get; init; }
}

public enum DocumentTone
{
    Caution,
    Active,
    Warning,
    Historical,
}

public sealed record DocumentField(string Label, string Value)
{
    public string Line { get; init; } = "";

    public string Text => Line.Length > 0 ? Line : $"{Label}: {Value}";
}

public sealed class DocumentPerson
{
    public required string Role { get; init; }
    public required IReadOnlyList<string> Lines { get; init; }
}

public sealed class PermitPresentation
{
    public required string TypeTitle { get; init; }
    public required string TypeShort { get; init; }
    public required string PermitNumber { get; init; }
    public required string Revision { get; init; }
    public required string Status { get; init; }
    public required string Authority { get; init; }
    public required DocumentTone Tone { get; init; }
    public required string RunningState { get; init; }
    public required IReadOnlyList<DocumentField> Location { get; init; }
    public required IReadOnlyList<DocumentField> Party { get; init; }
    public required IReadOnlyList<DocumentField> Validity { get; init; }
    public required string Scope { get; init; }
    public required IReadOnlyList<DocumentField> ScopeFacts { get; init; }
    public required IReadOnlyList<DocumentPerson> People { get; init; }
    public required IReadOnlyList<string> Hazards { get; init; }
    public required string HazardsNote { get; init; }
    public required IReadOnlyList<string> Controls { get; init; }
    public required string ControlsNote { get; init; }
    public required IReadOnlyList<string> Ppe { get; init; }
    public required string PpeNote { get; init; }
    public required IReadOnlyList<DocumentField> Conditions { get; init; }
    public required IReadOnlyList<DocumentSection> Modules { get; init; }
    public DocumentSection? Suspension { get; init; }
    public required DocumentSection Control { get; init; }
}

public sealed class PermitDocument
{
    public required DocumentRunningHeader RunningHeader { get; init; }
    public required PermitPresentation Presentation { get; init; }
    public required IReadOnlyList<string> Banner { get; init; }
    public required IReadOnlyList<DocumentSection> Sections { get; init; }

    public bool Contains(string text) =>
        Banner.Any(line => line.Contains(text, StringComparison.Ordinal))
        || Sections.Any(section =>
            section.Title.Contains(text, StringComparison.Ordinal)
            || section.Lines.Any(line => line.Contains(text, StringComparison.Ordinal)));
}

public sealed class PermitPdfReceipt
{
    public Guid Id { get; init; }
    public Guid PermitId { get; init; }
    public int PermitRevision { get; init; }
    public string ExportType { get; init; } = "";
    public string MimeType { get; init; } = "application/pdf";
    public long FileSize { get; init; }
    public string Sha256 { get; init; } = "";
    public DateTimeOffset GeneratedAt { get; init; }
    public string Filename { get; init; } = "";
}

public enum PermitPdfKind
{
    Ready,
    NotFound,
    Invalid,
}

public sealed class PermitPdfPrepared
{
    public PermitPdfKind Kind { get; init; }
    public string? Error { get; init; }
    public PermitExport? Export { get; init; }
    public byte[]? Content { get; init; }
    public PermitPdfReceipt? Receipt { get; init; }
    public PermitDocument? Document { get; init; }

    public static PermitPdfPrepared NotFound() => new() { Kind = PermitPdfKind.NotFound, Error = "permit not found" };
    public static PermitPdfPrepared Invalid(string error) => new() { Kind = PermitPdfKind.Invalid, Error = error };

    public static PermitPdfPrepared Ready(PermitExport export, byte[] content, PermitPdfReceipt receipt, PermitDocument document) => new()
    {
        Kind = PermitPdfKind.Ready,
        Export = export,
        Content = content,
        Receipt = receipt,
        Document = document,
    };
}

public static class GeneralWorkFactsReader
{
    public static GeneralWorkFacts Read(string? payload)
    {
        if (string.IsNullOrWhiteSpace(payload)) return GeneralWorkFacts.Empty;
        try
        {
            using var document = JsonDocument.Parse(payload);
            var root = document.RootElement;
            if (root.ValueKind != JsonValueKind.Object) return GeneralWorkFacts.Empty;
            if (!root.TryGetProperty("kind", out var kind) || kind.GetString() != "general-work-facts") return GeneralWorkFacts.Empty;
            return new GeneralWorkFacts
            {
                AreaName = Text(root, "areaName"),
                EquipmentTag = Text(root, "equipmentTag"),
                CompanyName = Text(root, "companyName"),
                PlannedStartClock = Text(root, "plannedStartClock"),
                PlannedExpirationClock = Text(root, "plannedExpirationClock"),
                TaskType = Text(root, "taskType"),
                EquipmentSystem = Text(root, "equipmentSystem"),
                ServiceProcess = Text(root, "serviceProcess"),
                MaterialInService = Text(root, "materialInService"),
                Coordination = Text(root, "coordination"),
                HeightControls = Text(root, "heightControls"),
                PpeText = Texts(root, "ppeText"),
                Exclusions = Map(root, "exclusions"),
            };
        }
        catch (JsonException)
        {
            return GeneralWorkFacts.Empty;
        }
    }

    private static string? Text(JsonElement root, string name) =>
        root.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String ? Blank(value.GetString()) : null;

    private static IReadOnlyList<string> Texts(JsonElement root, string name)
    {
        if (!root.TryGetProperty(name, out var value) || value.ValueKind != JsonValueKind.Array) return [];
        return value.EnumerateArray()
            .Where(item => item.ValueKind == JsonValueKind.String)
            .Select(item => item.GetString()?.Trim() ?? "")
            .Where(item => item.Length > 0)
            .ToArray();
    }

    private static IReadOnlyDictionary<string, string> Map(JsonElement root, string name)
    {
        if (!root.TryGetProperty(name, out var value) || value.ValueKind != JsonValueKind.Object) return new Dictionary<string, string>();
        var map = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var property in value.EnumerateObject())
        {
            if (property.Value.ValueKind != JsonValueKind.String) continue;
            var text = property.Value.GetString()?.Trim();
            if (!string.IsNullOrEmpty(text)) map[property.Name] = text;
        }

        return map;
    }

    private static string? Blank(string? value)
    {
        var trimmed = value?.Trim();
        return string.IsNullOrEmpty(trimmed) ? null : trimmed;
    }
}

public static class PermitDocumentStatus
{
    public readonly record struct Treatment(string Status, string Authority);

    public static Treatment Describe(PermitStatus status) => status switch
    {
        PermitStatus.DRAFT => new("DRAFT", "NOT AUTHORIZED FOR WORK"),
        PermitStatus.PENDING_REVIEW => new("PENDING REVIEW", "NOT AUTHORIZED FOR WORK"),
        PermitStatus.AUTHORIZED => new("AUTHORIZED", "NOT ACTIVE FOR WORK"),
        PermitStatus.ACTIVE => new("ACTIVE", "WORK AUTHORIZED"),
        PermitStatus.SUSPENDED => new("SUSPENDED", "WORK NOT AUTHORIZED"),
        PermitStatus.EXPIRED => new("EXPIRED", "WORK NOT AUTHORIZED"),
        PermitStatus.CANCELLED => new("CANCELLED", "WORK NOT AUTHORIZED"),
        PermitStatus.CLOSED => new("CLOSED", "HISTORICAL RECORD"),
        PermitStatus.SUPERSEDED => new("SUPERSEDED", "NOT CURRENT"),
        _ => new("UNRECOGNIZED STATUS", "NOT AUTHORIZED FOR WORK"),
    };
}

public static class GeneralWorkDocuments
{
    private static readonly Dictionary<string, string> ExclusionLabels = new(StringComparer.Ordinal)
    {
        ["excludeOpening"] = "Process opening required?",
        ["excludeContainment"] = "Containment break required?",
        ["excludeEntry"] = "Confined-space entry required?",
        ["excludeIsolation"] = "Energy isolation required?",
        ["excludeHotWork"] = "Hot work required?",
    };

    private static readonly Dictionary<string, string> FactLabels = new(StringComparer.Ordinal)
    {
        ["taskType"] = "Task type",
        ["equipmentSystem"] = "Equipment / system",
        ["serviceProcess"] = "Service / process",
        ["materialInService"] = "Material in service",
        ["coordination"] = "Operational coordination",
        ["heightControls"] = "Working at height",
        ["previousService"] = "Material previously in service",
        ["loto"] = "LOTO / energy control",
        ["lockBox"] = "Lock box",
        ["blindRequirements"] = "Blind requirements",
        ["initialTest"] = "Initial atmosphere test",
        ["retests"] = "Periodic atmosphere retests",
        ["hotWorkEquipment"] = "Hot-work equipment",
        ["areaPrep"] = "Area preparation",
        ["combustibleClearance"] = "Combustible clearance",
        ["ignitionControls"] = "Ignition controls",
        ["extinguishing"] = "Fire extinguishing equipment",
        ["fireWatch"] = "Fire watch",
        ["postFireWatch"] = "Post-work fire watch",
        ["vesselId"] = "Vessel / space ID",
        ["energyIsolation"] = "Isolation / LOTO",
        ["blinds"] = "Blind locations",
        ["mechanical"] = "Mechanical / process isolation",
        ["atmospheric"] = "Atmospheric testing",
        ["continuous"] = "Continuous / periodic monitoring",
        ["preparation"] = "Space preparation",
        ["entrant"] = "Authorized entrant",
        ["attendant"] = "Confined space attendant",
        ["rescue"] = "Rescue availability",
        ["hotWorkInside"] = "Hot work inside space",
        ["zeroEnergy"] = "Zero-energy verification",
        ["flushing"] = "Flushing",
        ["flushMaterial"] = "Flush material",
        ["depressured"] = "Depressured / drained",
        ["blinded"] = "Blinded / disconnected",
        ["cleaned"] = "Cleaned / steamed",
        ["nitrogen"] = "Nitrogen purge",
        ["sump"] = "Sump condition",
        ["barricades"] = "Barricades",
        ["digLocation"] = "Excavation location",
        ["depth"] = "Expected depth",
        ["competentPerson"] = "Competent person",
        ["utilityLocate"] = "Utility locate",
        ["locateTicket"] = "Locate ticket",
        ["drawings"] = "Underground drawings",
        ["undergroundHazards"] = "Underground hazards",
        ["isolationProtection"] = "Isolation / protection",
        ["protectiveSystem"] = "Protective system",
        ["soil"] = "Soil classification",
        ["access"] = "Access / egress",
        ["spoil"] = "Spoil-pile controls",
        ["setback"] = "Equipment setback",
        ["traffic"] = "Traffic controls",
        ["water"] = "Water conditions",
        ["panel"] = "Equipment / panel / circuit",
        ["voltage"] = "Voltage",
        ["qualifiedWorker"] = "Qualified electrical worker",
        ["nfpa70e"] = "NFPA 70E training verification",
        ["shockTraining"] = "Shock / arc-flash training",
        ["cpr"] = "CPR / first-aid availability",
        ["justification"] = "Energized-work justification",
        ["inspection"] = "Equipment inspection",
        ["labeling"] = "Arc-flash labeling",
        ["adjacentIsolation"] = "Adjacent-energy isolation",
        ["limitedBoundary"] = "Limited approach boundary",
        ["restrictedBoundary"] = "Restricted approach boundary",
        ["arcBoundary"] = "Arc-flash boundary",
        ["ppeCategory"] = "Arc-flash PPE category",
        ["tools"] = "Electrical tools",
        ["observer"] = "Observer / safety watch",
        ["disconnect"] = "Emergency disconnect",
        ["rescuePlan"] = "Rescue planning",
        ["electricalPpe"] = "Electrical PPE",
    };

    public static PermitDocument Compose(AuthoritativeGeneralWork source, Guid exportId, DateTimeOffset generatedAtUtc)
    {
        var permit = source.Permit;
        var facts = GeneralWorkFactsReader.Read(source.CreationFactsJson);
        var treatment = PermitDocumentStatus.Describe(permit.Status);
        var revision = $"{permit.CurrentRevision:00}";
        var number = string.IsNullOrWhiteSpace(permit.PermitNumber) ? "Not assigned" : permit.PermitNumber.Trim();
        var titles = PermitTitle(permit.PermitType);
        var tone = Tone(permit.Status);
        var people = People(source);
        var hazards = Clean(source.Hazards.Select(item => item.Label));
        var controls = Clean(source.Controls.Select(item => item.Label));
        var ppe = Clean(source.Ppe.Select(item => item.Label).Concat(facts.PpeText));
        var conditions = permit.PermitType == PermitType.GENERAL_WORK ? Conditions(facts) : [];
        var modules = ModuleFactSections(source.ModuleFacts);
        var suspension = Suspension(source);
        var control = Section("DOCUMENT CONTROL",
        [
            $"Permit UUID: {permit.Id:D}",
            $"Revision: {revision}",
            $"Export ID: {exportId:D}",
            $"Generated: {generatedAtUtc:yyyy-MM-dd HH:mm:ss} UTC",
            $"Permit type code: {ShownStatus(permit.PermitType)}",
            $"Modules: {ModuleList(source.Modules)}",
        ]);
        var presentation = new PermitPresentation
        {
            TypeTitle = titles.Title,
            TypeShort = titles.Short,
            PermitNumber = number,
            Revision = revision,
            Status = treatment.Status,
            Authority = treatment.Authority,
            Tone = tone,
            RunningState = $"{treatment.Status} - {treatment.Authority}",
            Location =
            [
                Field("Area", Present(source.AreaName ?? facts.AreaName)),
                Field("Equipment / tag", Present(source.EquipmentTag ?? facts.EquipmentTag)),
                Field("Work order", Present(permit.WorkOrder)),
            ],
            Party =
            [
                Field("Company", Company(source, facts)),
                Field("Requester", Present(Participant(source.Participants, "Requester"))),
                Field("Permit receiver", Present(Participant(source.Participants, "Craft / Permit Receiver"))),
            ],
            Validity = Validity(permit, facts),
            Scope = Present(permit.JobDescription),
            ScopeFacts = ScopeFacts(facts),
            People = people,
            Hazards = hazards,
            HazardsNote = "No hazards recorded.",
            Controls = controls,
            ControlsNote = "No controls recorded.",
            Ppe = ppe,
            PpeNote = "No PPE recorded.",
            Conditions = conditions,
            Modules = modules,
            Suspension = suspension,
            Control = control,
        };
        var banner = new List<string>
        {
            "LCY PERMIT CONTROL",
            titles.Title,
            number,
            $"REV {revision}",
            treatment.Status,
            treatment.Authority,
        };
        var sections = new List<DocumentSection>
        {
            Section("WORK LOCATION", presentation.Location.Select(item => item.Text).ToArray()),
            Section("WORK PARTY", presentation.Party.Select(item => item.Text).ToArray()),
            Section("VALIDITY", presentation.Validity.Select(item => item.Text).ToArray()),
            Section("WORK SCOPE", [presentation.Scope, ..presentation.ScopeFacts.Select(item => item.Text)]),
            Section("PEOPLE & AUTHORIZATION", people.SelectMany(item => new[] { item.Role }.Concat(item.Lines)).ToArray()),
            Section("HAZARDS", hazards.Count == 0 ? [presentation.HazardsNote] : hazards),
            Section("CONTROLS", controls.Count == 0 ? [presentation.ControlsNote] : controls),
            Section("PPE", ppe.Count == 0 ? [presentation.PpeNote] : ppe),
        };
        if (conditions.Count > 0) sections.Add(Section("GENERAL WORK CONDITIONS", conditions.Select(item => item.Text).ToArray()));
        sections.AddRange(modules);
        if (suspension is not null) sections.Add(suspension);
        sections.Add(control);
        return new PermitDocument
        {
            RunningHeader = new DocumentRunningHeader
            {
                PermitNumber = number,
                Revision = permit.CurrentRevision,
                Status = treatment.Status,
                Authority = treatment.Authority,
            },
            Presentation = presentation,
            Banner = banner,
            Sections = sections,
        };
    }

    private static (string Title, string Short) PermitTitle(PermitType type) => type switch
    {
        PermitType.GENERAL_WORK => ("GENERAL WORK PERMIT", "GENERAL WORK"),
        PermitType.HOT_WORK => ("HOT WORK PERMIT", "HOT WORK"),
        PermitType.CONFINED_SPACE => ("CONFINED SPACE ENTRY PERMIT", "CONFINED SPACE"),
        PermitType.OPENING_BLINDING => ("OPENING / BLINDING PERMIT", "OPENING / BLINDING"),
        PermitType.EXCAVATION => ("EXCAVATION PERMIT", "EXCAVATION"),
        PermitType.LIVE_ELECTRICAL => ("LIVE ELECTRICAL WORK PERMIT", "LIVE ELECTRICAL"),
        _ => ("PERMIT TO WORK", "PERMIT"),
    };

    private static DocumentTone Tone(PermitStatus status)
    {
        if (!Enum.IsDefined(status)) return DocumentTone.Warning;
        return status switch
        {
            PermitStatus.ACTIVE => DocumentTone.Active,
            PermitStatus.SUSPENDED or PermitStatus.EXPIRED or PermitStatus.CANCELLED => DocumentTone.Warning,
            PermitStatus.CLOSED or PermitStatus.SUPERSEDED => DocumentTone.Historical,
            _ => DocumentTone.Caution,
        };
    }

    private static IReadOnlyList<DocumentField> Validity(Permit permit, GeneralWorkFacts facts)
    {
        var fields = new List<DocumentField>();
        if (permit.PlannedStart is not null) fields.Add(Field("Planned start", Stamp(permit.PlannedStart)));
        else fields.Add(Field("Planned start", Present(facts.PlannedStartClock)));
        if (permit.PlannedStart is not null && !string.IsNullOrWhiteSpace(facts.PlannedStartClock))
        {
            fields.Add(Field("Stated start", facts.PlannedStartClock.Trim()));
        }

        if (permit.ExpiresAt is not null) fields.Add(Field("Expires", Stamp(permit.ExpiresAt)));
        else fields.Add(Field("Expires", Present(facts.PlannedExpirationClock)));
        if (permit.ExpiresAt is not null && !string.IsNullOrWhiteSpace(facts.PlannedExpirationClock))
        {
            fields.Add(Field("Stated end", facts.PlannedExpirationClock.Trim()));
        }

        if (permit.ActivatedAt is not null) fields.Add(Field("Activated", Stamp(permit.ActivatedAt)));
        return fields;
    }

    private static IReadOnlyList<DocumentField> ScopeFacts(GeneralWorkFacts facts)
    {
        var fields = new List<DocumentField>();
        AddFact(fields, "Task type", facts.TaskType);
        AddFact(fields, "Service / process", facts.ServiceProcess);
        AddFact(fields, "Material in service", facts.MaterialInService);
        return fields;
    }

    private static void AddFact(List<DocumentField> fields, string label, string? value)
    {
        if (!string.IsNullOrWhiteSpace(value)) fields.Add(Field(label, value.Trim()));
    }

    private static IReadOnlyList<DocumentPerson> People(AuthoritativeGeneralWork source)
    {
        var people = new List<DocumentPerson>
        {
            PersonCard("REQUESTED BY", Approval(source.Approvals, "SUBMITTED"), Participant(source.Participants, "Requester"), "Submitted"),
            PersonCard("PERMIT AUTHORIZER", Approval(source.Approvals, "AUTHORIZED"), null, "Authorized"),
            PersonCard("CRAFT / PERMIT RECEIVER", Approval(source.Approvals, "ACCEPTED"), Participant(source.Participants, "Craft / Permit Receiver"), "Accepted"),
        };
        AddSpecialist(people, source, "FIRE WATCH", "fireWatch", PermitModuleKind.FIRE_WATCH, source.Permit.PermitType == PermitType.HOT_WORK);
        AddSpecialist(people, source, "CONFINED SPACE ATTENDANT", "attendant", PermitModuleKind.CONFINED_SPACE, source.Permit.PermitType == PermitType.CONFINED_SPACE);
        AddSpecialist(people, source, "COMPETENT PERSON", "competentPerson", PermitModuleKind.EXCAVATION, source.Permit.PermitType == PermitType.EXCAVATION);
        AddSpecialist(people, source, "QUALIFIED ELECTRICAL WORKER", "qualifiedWorker", PermitModuleKind.LIVE_ELECTRICAL, source.Permit.PermitType == PermitType.LIVE_ELECTRICAL);
        return people;
    }

    private static void AddSpecialist(List<DocumentPerson> people, AuthoritativeGeneralWork source, string role, string factName, PermitModuleKind kind, bool typeRequires)
    {
        var value = source.ModuleFacts.FirstOrDefault(item => item.Name == factName)?.Value?.Trim();
        var applies = typeRequires || source.Modules.Any(item => item.Kind == kind) || source.ModuleFacts.Any(item => item.ModuleKind == kind);
        if (!applies && string.IsNullOrWhiteSpace(value)) return;
        people.Add(string.IsNullOrWhiteSpace(value)
            ? new DocumentPerson { Role = role, Lines = ["NOT ASSIGNED"] }
            : new DocumentPerson { Role = role, Lines = [value] });
    }

    private static DocumentPerson PersonCard(string role, PermitApproval? approval, string? participant, string timeLabel)
    {
        if (approval is not null)
        {
            var lines = new List<string> { approval.DisplayNameSnapshot!.Trim() };
            if (!string.IsNullOrWhiteSpace(approval.PermitUserCodeSnapshot)) lines.Add(approval.PermitUserCodeSnapshot.Trim());
            if (!string.IsNullOrWhiteSpace(approval.JobTitleSnapshot)) lines.Add(approval.JobTitleSnapshot.Trim());
            lines.Add($"{timeLabel}: {Stamp(approval.DecidedAt)}");
            return new DocumentPerson { Role = role, Lines = lines };
        }

        if (!string.IsNullOrWhiteSpace(participant))
        {
            return new DocumentPerson { Role = role, Lines = [participant.Trim(), $"{timeLabel}: PENDING"] };
        }

        return new DocumentPerson { Role = role, Lines = ["PENDING"] };
    }

    private static PermitApproval? Approval(IReadOnlyList<PermitApproval> approvals, string decision) =>
        approvals.Where(item => item.Decision == decision && item.DecidedAt is not null && !string.IsNullOrWhiteSpace(item.DisplayNameSnapshot))
            .OrderBy(item => item.DecidedAt)
            .LastOrDefault();

    private static IReadOnlyList<DocumentSection> ModuleFactSections(IReadOnlyList<PermitModuleFact> facts)
    {
        var sections = new List<DocumentSection>();
        foreach (var group in facts.GroupBy(item => item.ModuleKind).OrderBy(item => item.Key.ToString(), StringComparer.Ordinal))
        {
            var lines = group
                .Where(item => !item.Name.Equals("ppe", StringComparison.OrdinalIgnoreCase) && !string.IsNullOrWhiteSpace(item.Value))
                .OrderBy(item => item.Name, StringComparer.Ordinal)
                .Select(item => $"{FactLabel(item.Name)}: {item.Value.Trim()}")
                .ToArray();
            if (lines.Length > 0) sections.Add(Section(ModuleTitle(group.Key), lines));
        }

        return sections;
    }

    private static string ModuleTitle(PermitModuleKind kind) => kind switch
    {
        PermitModuleKind.HOT_WORK => "HOT WORK CONTROLS",
        PermitModuleKind.FIRE_WATCH => "FIRE WATCH",
        PermitModuleKind.ATMOSPHERIC_MONITORING => "ATMOSPHERIC MONITORING",
        PermitModuleKind.LOTO_ISOLATION => "LOTO / ISOLATION",
        PermitModuleKind.CONFINED_SPACE => "CONFINED SPACE ENTRY",
        PermitModuleKind.RESCUE => "RESCUE",
        PermitModuleKind.EXCAVATION => "EXCAVATION",
        PermitModuleKind.OPENING_BLINDING => "OPENING / BLINDING",
        PermitModuleKind.LIVE_ELECTRICAL => "LIVE ELECTRICAL WORK",
        PermitModuleKind.WORKING_AT_HEIGHT => "WORKING AT HEIGHT",
        _ => kind.ToString().Replace('_', ' '),
    };

    private static string FactLabel(string name)
    {
        if (FactLabels.TryGetValue(name, out var known)) return known;
        var spaced = System.Text.RegularExpressions.Regex.Replace(name, "([a-z])([A-Z])", "$1 $2").Replace('_', ' ');
        return spaced.Length == 0 ? name : char.ToUpperInvariant(spaced[0]) + spaced[1..];
    }

    private static DocumentSection? Suspension(AuthoritativeGeneralWork source)
    {
        if (string.IsNullOrWhiteSpace(source.SuspensionReason) && source.SuspendedAt is null && string.IsNullOrWhiteSpace(source.SuspendedByName)) return null;
        var who = string.IsNullOrWhiteSpace(source.SuspendedByName) ? "Not recorded" : source.SuspendedByName.Trim();
        if (!string.IsNullOrWhiteSpace(source.SuspendedByCode)) who = $"{who} / {source.SuspendedByCode.Trim()}";
        return Section("SUSPENSION",
        [
            $"Suspended at: {(source.SuspendedAt is null ? "Not recorded" : Stamp(source.SuspendedAt))}",
            $"Suspended by: {who}",
            $"Reason: {Present(source.SuspensionReason)}",
        ]);
    }

    private static IReadOnlyList<DocumentField> Conditions(GeneralWorkFacts facts)
    {
        var fields = new List<DocumentField>();
        AddFact(fields, "Equipment / system", facts.EquipmentSystem);
        AddFact(fields, "Operational coordination", facts.Coordination);
        AddFact(fields, "Working at height", facts.HeightControls);
        foreach (var item in facts.Exclusions.OrderBy(entry => entry.Key, StringComparer.Ordinal))
        {
            var label = ExclusionLabels.TryGetValue(item.Key, out var known) ? known : FactLabel(item.Key);
            var answer = Answer(item.Value);
            fields.Add(new DocumentField(label, answer) { Line = $"{label} {answer}" });
        }

        return fields;
    }

    private static string Answer(string value) => value.Trim().ToLowerInvariant() switch
    {
        "excluded" or "no" or "false" => "NO",
        "included" or "yes" or "true" => "YES",
        _ => value.Trim(),
    };

    private static DocumentSection Section(string title, IReadOnlyList<string> lines) => new() { Title = title, Lines = lines };

    private static DocumentField Field(string label, string value) => new(label, value);

    private static string ModuleList(IReadOnlyList<PermitModule> modules)
    {
        var names = modules.Select(item => item.Kind.ToString()).Distinct(StringComparer.Ordinal).OrderBy(item => item, StringComparer.Ordinal).ToArray();
        return names.Length == 0 ? "Not recorded" : string.Join(", ", names);
    }

    private static string Company(AuthoritativeGeneralWork source, GeneralWorkFacts facts)
    {
        var name = source.CompanyName ?? facts.CompanyName;
        if (!string.IsNullOrWhiteSpace(name)) return name.Trim();
        return source.Permit.CompanyType == CompanyType.LCY ? "LCY" : "Not recorded";
    }

    private static string? Participant(IReadOnlyList<PermitParticipant> participants, string role) =>
        participants.FirstOrDefault(item => item.RoleName == role)?.DisplayName;

    private static IReadOnlyList<string> Clean(IEnumerable<string> items) =>
        items.Select(item => item.Trim()).Where(item => item.Length > 0).Distinct(StringComparer.Ordinal).ToArray();

    private static string Present(string? value)
    {
        var trimmed = value?.Trim();
        return string.IsNullOrEmpty(trimmed) ? "Not recorded" : trimmed;
    }

    private static string ShownStatus(PermitType type) =>
        Enum.IsDefined(type) ? type.ToString() : "UNRECOGNIZED";

    private static string Stamp(DateTimeOffset? value) =>
        value!.Value.ToUniversalTime().ToString("yyyy-MM-dd HH:mm:ss") + " UTC";
}

public static class PermitExportKeys
{
    public static string Generated(Guid permitId, Guid exportId) =>
        $"exports/generated/{permitId:D}/{exportId:D}.pdf";

    public static string DownloadName(string? permitNumber, int revision)
    {
        var identity = string.IsNullOrWhiteSpace(permitNumber) ? "Permit" : Clean(permitNumber);
        return $"{identity}-General-Work-Rev-{revision:00}.pdf";
    }

    public static string Sha256Hex(byte[] content) => Convert.ToHexString(SHA256.HashData(content)).ToLowerInvariant();

    private static string Clean(string value)
    {
        var cleaned = new string(value.Trim().Select(character =>
            char.IsAsciiLetterOrDigit(character) || character is '-' or '_' ? character : '-').ToArray());
        return cleaned.Length == 0 ? "Permit" : cleaned;
    }
}

public static class PermitPdfExporting
{
    public static PermitPdfPrepared Prepare(
        AuthoritativeGeneralWork? source,
        PermitExportType exportType,
        Guid exportId,
        DateTimeOffset generatedAtUtc,
        Func<PermitDocument, byte[]> render)
    {
        if (exportId == Guid.Empty) return PermitPdfPrepared.Invalid("export-id-required");
        if (source is null || source.Permit.Id == Guid.Empty) return PermitPdfPrepared.NotFound();
        if (!PermitModuleComposition.TryType(source.Permit.PermitType.ToString(), out _)) return PermitPdfPrepared.Invalid("permit-type-invalid");
        if (exportType == PermitExportType.FINAL_ARCHIVE) return PermitPdfPrepared.Invalid("final-archive-not-available");
        if (exportType is not (PermitExportType.PRINT or PermitExportType.SNAPSHOT)) return PermitPdfPrepared.Invalid("export-type-invalid");

        var document = GeneralWorkDocuments.Compose(source, exportId, generatedAtUtc);
        var content = render(document);
        if (content is null || content.Length == 0) return PermitPdfPrepared.Invalid("empty-pdf");
        var export = new PermitExport
        {
            Id = exportId,
            PermitId = source.Permit.Id,
            PermitRevision = source.Permit.CurrentRevision,
            ExportType = exportType,
            StorageKey = PermitExportKeys.Generated(source.Permit.Id, exportId),
            MimeType = "application/pdf",
            FileSize = content.Length,
            Sha256 = PermitExportKeys.Sha256Hex(content),
            GeneratedAt = generatedAtUtc,
            GeneratedBy = null,
            DocumentClassification = Enum.IsDefined(source.Permit.Status) ? source.Permit.Status.ToString() : "UNRECOGNIZED",
        };
        var receipt = new PermitPdfReceipt
        {
            Id = export.Id,
            PermitId = export.PermitId,
            PermitRevision = export.PermitRevision,
            ExportType = export.ExportType.ToString(),
            MimeType = export.MimeType,
            FileSize = export.FileSize,
            Sha256 = export.Sha256,
            GeneratedAt = export.GeneratedAt,
            Filename = PermitExportKeys.DownloadName(source.Permit.PermitNumber, source.Permit.CurrentRevision),
        };
        return PermitPdfPrepared.Ready(export, content, receipt, document);
    }
}
