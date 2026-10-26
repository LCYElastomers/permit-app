namespace PermitControl.Domain;

public sealed class WorkType
{
    public Guid Id { get; set; }
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public bool Enabled { get; set; } = true;
    public int DisplayOrder { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? UpdatedAt { get; set; }
}

public sealed class HazardDefinition
{
    public Guid Id { get; set; }
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public bool Enabled { get; set; } = true;
    public int DisplayOrder { get; set; }
    public string? ApplicablePermitTypes { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? UpdatedAt { get; set; }
}

public sealed class ControlDefinition
{
    public Guid Id { get; set; }
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public bool Enabled { get; set; } = true;
    public int DisplayOrder { get; set; }
    public string? ApplicablePermitTypes { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? UpdatedAt { get; set; }
}

public sealed class PpeDefinition
{
    public Guid Id { get; set; }
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public bool Enabled { get; set; } = true;
    public int DisplayOrder { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? UpdatedAt { get; set; }
}

public sealed class PermitTemplate
{
    public Guid Id { get; set; }
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public string PermitType { get; set; } = "";
    public Guid? DefaultAreaId { get; set; }
    public Guid? DefaultWorkTypeId { get; set; }
    public bool Enabled { get; set; } = true;
    public int Version { get; set; } = 1;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? UpdatedAt { get; set; }
}

public sealed class PermitTemplateItem
{
    public Guid Id { get; set; }
    public Guid TemplateId { get; set; }
    public string Kind { get; set; } = "";
    public string Code { get; set; } = "";
    public string Label { get; set; } = "";
    public PermitTemplate? Template { get; set; }
}

public sealed class PermitFieldDefinition
{
    public Guid Id { get; set; }
    public string PermitType { get; set; } = "";
    public string? ModuleKind { get; set; }
    public string Code { get; set; } = "";
    public string Label { get; set; } = "";
    public string? HelpText { get; set; }
    public string FieldType { get; set; } = "";
    public bool Required { get; set; }
    public int DisplayOrder { get; set; }
    public bool Enabled { get; set; } = true;
    public int ConfigurationVersion { get; set; } = 1;
}

public sealed class PermitFieldChoice
{
    public Guid Id { get; set; }
    public Guid FieldDefinitionId { get; set; }
    public string Code { get; set; } = "";
    public string Label { get; set; } = "";
    public string? Description { get; set; }
    public int DisplayOrder { get; set; }
    public bool Enabled { get; set; } = true;
    public PermitFieldDefinition? Field { get; set; }
}

public sealed class FormPublication
{
    public int Id { get; set; } = 1;
    public int PublishedVersion { get; set; }
    public DateTimeOffset? PublishedAt { get; set; }
    public Guid? PublishedByUserId { get; set; }
}

public sealed class PermitRule
{
    public Guid Id { get; set; }
    public int ConfigurationVersion { get; set; } = 1;
    public string ConditionCode { get; set; } = "";
    public string ConditionValue { get; set; } = "";
    public string Action { get; set; } = "";
    public string ActionTarget { get; set; } = "";
    public bool Enabled { get; set; } = true;
}

public sealed class ConfigurationAudit
{
    public Guid Id { get; set; }
    public Guid PerformedByUserId { get; set; }
    public DateTimeOffset OccurredAt { get; set; }
    public string EntityType { get; set; } = "";
    public Guid? EntityId { get; set; }
    public string Action { get; set; } = "";
    public string Summary { get; set; } = "";
    public Guid? DeviceId { get; set; }
}

public static class CatalogRules
{
    public static readonly string[] FieldTypes =
    [
        "TEXT", "MULTILINE_TEXT", "YES_NO", "NUMBER", "DECIMAL", "DATE", "TIME", "DATETIME", "SINGLE_SELECT", "MULTI_SELECT",
    ];

    public static readonly string[] RuleActions =
    [
        "REQUIRE_MODULE", "SHOW_FIELD", "REQUIRE_FIELD", "REQUIRE_QUALIFICATION", "REQUIRE_CONTROL", "REQUIRE_PPE",
    ];

    public static readonly string[] TemplateItemKinds = ["HAZARD", "CONTROL", "PPE", "MODULE"];

    public static string? Access(IReadOnlyCollection<string> roles) =>
        PermitCapabilities.Has(roles, nameof(AppRole.ADMIN)) ? null : "capability-required";

    public static string? Code(string? value)
    {
        var code = value?.Trim().ToUpperInvariant() ?? "";
        if (code.Length is < 2 or > 40) return "code-invalid";
        if (code.Any(character => !char.IsAsciiLetterOrDigit(character) && character is not ('_' or '-'))) return "code-invalid";
        return ContainsExecutable(code) ? "executable-content-rejected" : null;
    }

    public static string? Label(string? value)
    {
        var label = value?.Trim() ?? "";
        if (label.Length is < 1 or > 160) return "label-invalid";
        return ContainsExecutable(label) ? "executable-content-rejected" : null;
    }

    public static string? FieldType(string? value) =>
        FieldTypes.Contains(value?.Trim().ToUpperInvariant()) ? null : "field-type-invalid";

    public static string? Rule(string? action, string? conditionCode, string? conditionValue, string? target)
    {
        if (!RuleActions.Contains(action?.Trim().ToUpperInvariant())) return "rule-action-invalid";
        if (Code(conditionCode) is { } condition) return condition;
        if (Code(target) is { } actionTarget) return actionTarget;
        var compared = conditionValue?.Trim() ?? "";
        if (compared.Length is < 1 or > 80) return "rule-value-invalid";
        return ContainsExecutable(compared) ? "executable-content-rejected" : null;
    }

    public static bool ContainsExecutable(string? value)
    {
        if (string.IsNullOrEmpty(value)) return false;
        foreach (var character in value)
        {
            if (character is '<' or '>' or '{' or '}' or ';' or '`' or '\\') return true;
        }

        var text = value.ToLowerInvariant();
        return text.Contains("javascript", StringComparison.Ordinal)
            || text.Contains("select ", StringComparison.Ordinal)
            || text.Contains("drop ", StringComparison.Ordinal);
    }

    public static string? AreaChange(bool referencedByPermit, string currentName, string nextName) =>
        referencedByPermit && !string.Equals(currentName, nextName, StringComparison.Ordinal) ? "area-history-preserved" : null;

    public static string? PermitTypeCode(string? value) =>
        PermitModuleComposition.TryType(value, out _) ? null : "permit-type-invalid";

    public static (PermitFieldDefinition Published, PermitFieldDefinition? Draft, IReadOnlyList<PermitFieldChoice> DraftChoices) Revise(
        PermitFieldDefinition current,
        IReadOnlyList<PermitFieldChoice> choices,
        string label,
        bool required,
        int publishedVersion)
    {
        if (current.ConfigurationVersion > publishedVersion)
        {
            current.Label = label;
            current.Required = required;
            return (current, null, choices);
        }

        var draft = new PermitFieldDefinition
        {
            Id = Guid.NewGuid(),
            PermitType = current.PermitType,
            ModuleKind = current.ModuleKind,
            Code = current.Code,
            Label = label,
            HelpText = current.HelpText,
            FieldType = current.FieldType,
            Required = required,
            DisplayOrder = current.DisplayOrder,
            Enabled = current.Enabled,
            ConfigurationVersion = publishedVersion + 1,
        };
        var copied = choices.Select(choice => new PermitFieldChoice
        {
            Id = Guid.NewGuid(),
            FieldDefinitionId = draft.Id,
            Code = choice.Code,
            Label = choice.Label,
            Description = choice.Description,
            DisplayOrder = choice.DisplayOrder,
            Enabled = choice.Enabled,
        }).ToArray();
        return (current, draft, copied);
    }

    public static IReadOnlyList<(string Code, string Modules)> PermitTypes() =>
        Enum.GetValues<PermitType>().Select(type => (type.ToString(), string.Join(", ", PermitModuleComposition.For(type).Select(item => item.Kind.ToString())))).ToArray();
}
