using PermitControl.Domain;

namespace PermitControl.Application;

public interface IPlantAdministration
{
    Task<IReadOnlyList<CatalogItemView>> ListAsync(string? token, string catalog, CancellationToken cancellationToken);
    Task<(string? Error, CatalogItemView? Item)> SaveAsync(string? token, string catalog, CatalogEdit edit, CancellationToken cancellationToken);
    Task<IReadOnlyList<FieldView>> FieldsAsync(string? token, CancellationToken cancellationToken);
    Task<(string? Error, FieldView? Field)> SaveFieldAsync(string? token, FieldEdit edit, CancellationToken cancellationToken);
    Task<string?> SaveChoiceAsync(string? token, ChoiceEdit edit, CancellationToken cancellationToken);
    Task<string?> PublishAsync(string? token, string pin, Guid? deviceId, CancellationToken cancellationToken);
    Task<IReadOnlyList<RuleView>> RulesAsync(string? token, CancellationToken cancellationToken);
    Task<string?> SaveRuleAsync(string? token, RuleEdit edit, string pin, Guid? deviceId, CancellationToken cancellationToken);
    Task<IReadOnlyList<PermitTypeView>> PermitTypesAsync(string? token, CancellationToken cancellationToken);
    Task<int> PublishedVersionAsync(string? token, CancellationToken cancellationToken);
}

public sealed record CatalogItemView(Guid Id, string Code, string Name, string? Detail, bool Enabled, int DisplayOrder, string? ParentId);
public sealed record CatalogEdit(Guid? Id, string Code, string Name, string? Detail, bool Enabled, int DisplayOrder, string? ParentId);
public sealed record FieldView(Guid Id, string PermitType, string? ModuleKind, string Code, string Label, string? HelpText, string FieldType, bool Required, int DisplayOrder, bool Enabled, int ConfigurationVersion, IReadOnlyList<ChoiceView> Choices);
public sealed record ChoiceView(Guid Id, string Code, string Label, bool Enabled, int DisplayOrder);
public sealed record FieldEdit(Guid? Id, string PermitType, string? ModuleKind, string Code, string Label, string? HelpText, string FieldType, bool Required, int DisplayOrder, bool Enabled);
public sealed record ChoiceEdit(Guid? Id, Guid FieldId, string Code, string Label, string? Description, int DisplayOrder, bool Enabled);
public sealed record RuleView(Guid Id, int ConfigurationVersion, string ConditionCode, string ConditionValue, string Action, string ActionTarget, bool Enabled);
public sealed record RuleEdit(Guid? Id, string ConditionCode, string ConditionValue, string Action, string ActionTarget, bool Enabled);
public sealed record PermitTypeView(string Code, string Modules);
