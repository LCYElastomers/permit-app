using System.Security.Cryptography;
using System.Text.Json;

namespace PermitControl.Domain;

public sealed class AuthoritativeGeneralWork
{
    public required Permit Permit { get; init; }
    public string? AreaName { get; init; }
    public string? EquipmentTag { get; init; }
    public string? CompanyName { get; init; }
    public IReadOnlyList<PermitHazard> Hazards { get; init; } = [];
    public IReadOnlyList<PermitControlRecord> Controls { get; init; } = [];
    public IReadOnlyList<PermitPpe> Ppe { get; init; } = [];
    public IReadOnlyList<PermitModule> Modules { get; init; } = [];
    public IReadOnlyList<PermitParticipant> Participants { get; init; } = [];
    public string? CreationFactsJson { get; init; }
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

public sealed class PermitDocument
{
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

public static class GeneralWorkDocuments
{
    private static readonly Dictionary<string, string> ExclusionLabels = new(StringComparer.Ordinal)
    {
        ["excludeOpening"] = "Process opening",
        ["excludeContainment"] = "Containment break",
        ["excludeEntry"] = "Confined-space entry",
        ["excludeIsolation"] = "Energy isolation",
        ["excludeHotWork"] = "Hot work",
    };

    public static PermitDocument Compose(AuthoritativeGeneralWork source, Guid exportId, DateTimeOffset generatedAtUtc)
    {
        var permit = source.Permit;
        var facts = GeneralWorkFactsReader.Read(source.CreationFactsJson);
        var authorized = permit.Status is PermitStatus.AUTHORIZED or PermitStatus.ACTIVE;
        var banner = new List<string>
        {
            "LCY PERMIT CONTROL",
            "GENERAL WORK PERMIT",
            $"Permit number: {Shown(permit.PermitNumber)}",
            $"Permit UUID: {permit.Id:D}",
            $"Revision: {permit.CurrentRevision}",
            $"Lifecycle status: {permit.Status}",
            $"Generated (UTC): {generatedAtUtc:yyyy-MM-dd HH:mm:ss} UTC",
            $"Export: {exportId:D}",
            $"Modules: {Modules(source.Modules)}",
        };
        if (permit.Status == PermitStatus.DRAFT)
        {
            banner.Add("DRAFT");
            banner.Add("NOT AUTHORIZED FOR WORK");
        }
        else if (!authorized)
        {
            banner.Add(permit.Status.ToString());
            banner.Add("NOT AUTHORIZED FOR WORK");
        }
        else
        {
            banner.Add($"Authorization: {permit.Status}");
        }

        var requester = Person(source.Participants, "Requester");
        var craft = Person(source.Participants, "Craft / Permit Receiver");
        return new PermitDocument
        {
            Banner = banner,
            Sections =
            [
                Section("GENERAL INFORMATION",
                [
                    $"Permit number: {Shown(permit.PermitNumber)}",
                    $"Status: {permit.Status}",
                    $"Revision: {permit.CurrentRevision}",
                    $"Area: {Shown(source.AreaName ?? facts.AreaName)}",
                    $"Equipment / tag: {Shown(source.EquipmentTag ?? facts.EquipmentTag)}",
                    $"Work order: {Shown(permit.WorkOrder)}",
                    $"Company type: {permit.CompanyType}",
                    $"Company: {Shown(source.CompanyName ?? facts.CompanyName)}",
                    $"Requester: {Shown(requester)}",
                    $"Craft / permit receiver: {Shown(craft)}",
                    $"Planned start: {Shown(facts.PlannedStartClock)}",
                    $"Planned expiration: {Shown(facts.PlannedExpirationClock)}",
                ]),
                Section("WORK SCOPE",
                [
                    $"Job description: {Shown(permit.JobDescription)}",
                    $"Task type: {Shown(facts.TaskType)}",
                ]),
                ItemSection("HAZARDS", source.Hazards.Select(item => item.Label)),
                ItemSection("CONTROLS", source.Controls.Select(item => item.Label)),
                ItemSection("PPE", source.Ppe.Select(item => item.Label).Concat(facts.PpeText)),
                Section("GENERAL WORK CONDITIONS", Conditions(facts)),
            ],
        };
    }

    private static IReadOnlyList<string> Conditions(GeneralWorkFacts facts)
    {
        var lines = new List<string>
        {
            $"Equipment / system: {Shown(facts.EquipmentSystem)}",
            $"Service / process: {Shown(facts.ServiceProcess)}",
            $"Material in service: {Shown(facts.MaterialInService)}",
            $"Operational coordination: {Shown(facts.Coordination)}",
            $"Working at height: {Shown(facts.HeightControls)}",
        };
        if (facts.Exclusions.Count == 0)
        {
            lines.Add("Exclusion answers: none recorded");
            return lines;
        }

        foreach (var item in facts.Exclusions.OrderBy(item => item.Key, StringComparer.Ordinal))
        {
            var label = ExclusionLabels.TryGetValue(item.Key, out var known) ? known : item.Key;
            lines.Add($"{label}: {item.Value}");
        }

        return lines;
    }

    private static DocumentSection Section(string title, IReadOnlyList<string> lines) => new() { Title = title, Lines = lines };

    private static DocumentSection ItemSection(string title, IEnumerable<string> items)
    {
        var lines = items.Select(item => item.Trim()).Where(item => item.Length > 0).Distinct(StringComparer.Ordinal).ToArray();
        return new DocumentSection { Title = title, Lines = lines.Length == 0 ? ["None recorded."] : lines };
    }

    private static string Modules(IReadOnlyList<PermitModule> modules)
    {
        var names = modules.Select(item => item.Kind.ToString()).Distinct(StringComparer.Ordinal).ToArray();
        return names.Length == 0 ? "None recorded." : string.Join(", ", names);
    }

    private static string? Person(IReadOnlyList<PermitParticipant> participants, string role) =>
        participants.FirstOrDefault(item => item.RoleName == role)?.DisplayName;

    private static string Shown(string? value)
    {
        var trimmed = value?.Trim();
        return string.IsNullOrEmpty(trimmed) ? "—" : trimmed;
    }
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
        if (source.Permit.PermitType != PermitType.GENERAL_WORK) return PermitPdfPrepared.Invalid("general-work-only");
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
            DocumentClassification = source.Permit.Status.ToString(),
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
