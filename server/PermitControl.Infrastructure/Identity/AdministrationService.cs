using Microsoft.EntityFrameworkCore;
using PermitControl.Application;
using PermitControl.Domain;
using PermitControl.Infrastructure.Persistence;

namespace PermitControl.Infrastructure.Identity;

public sealed class AdministrationService(PermitDbContext database) : IPlantAdministration
{
    private readonly IPinHasher hasher = Argon2PinHasher.Interactive;

    public async Task<IReadOnlyList<CatalogItemView>> ListAsync(string? token, string catalog, CancellationToken cancellationToken)
    {
        await RequireAsync(token, cancellationToken);
        return catalog switch
        {
            "areas" => await database.Areas.AsNoTracking().OrderBy(item => item.Name).Select(item => new CatalogItemView(item.Id, item.Name, item.Name, null, item.Enabled, 0, null)).ToListAsync(cancellationToken),
            "equipment" => await database.Equipment.AsNoTracking().OrderBy(item => item.Tag).Select(item => new CatalogItemView(item.Id, item.Tag, item.Name, item.EquipmentType, item.Enabled, 0, item.AreaId.ToString())).ToListAsync(cancellationToken),
            "contractors" => await database.Contractors.AsNoTracking().OrderBy(item => item.Name).Select(item => new CatalogItemView(item.Id, item.Name, item.Name, item.ShortName, item.Enabled, 0, null)).ToListAsync(cancellationToken),
            "work-types" => await database.WorkTypes.AsNoTracking().OrderBy(item => item.DisplayOrder).Select(item => new CatalogItemView(item.Id, item.Code, item.Name, item.Description, item.Enabled, item.DisplayOrder, null)).ToListAsync(cancellationToken),
            "hazards" => await database.HazardDefinitions.AsNoTracking().OrderBy(item => item.DisplayOrder).Select(item => new CatalogItemView(item.Id, item.Code, item.Name, item.Description, item.Enabled, item.DisplayOrder, item.ApplicablePermitTypes)).ToListAsync(cancellationToken),
            "controls" => await database.ControlDefinitions.AsNoTracking().OrderBy(item => item.DisplayOrder).Select(item => new CatalogItemView(item.Id, item.Code, item.Name, item.Description, item.Enabled, item.DisplayOrder, item.ApplicablePermitTypes)).ToListAsync(cancellationToken),
            "ppe" => await database.PpeDefinitions.AsNoTracking().OrderBy(item => item.DisplayOrder).Select(item => new CatalogItemView(item.Id, item.Code, item.Name, item.Description, item.Enabled, item.DisplayOrder, null)).ToListAsync(cancellationToken),
            "templates" => await database.PermitTemplates.AsNoTracking().OrderBy(item => item.Name).Select(item => new CatalogItemView(item.Id, item.PermitType, item.Name, item.Description, item.Enabled, item.Version, item.DefaultAreaId.ToString())).ToListAsync(cancellationToken),
            _ => throw new DirectoryRejected("catalog-invalid"),
        };
    }

    public async Task<(string? Error, CatalogItemView? Item)> SaveAsync(string? token, string catalog, CatalogEdit edit, CancellationToken cancellationToken)
    {
        var actor = await RequireAsync(token, cancellationToken);
        if (CatalogRules.Label(edit.Name) is { } labelError) return (labelError, null);
        if (CatalogRules.ContainsExecutable(edit.Detail) || CatalogRules.ContainsExecutable(edit.ParentId)) return ("executable-content-rejected", null);
        await using var transaction = await database.Database.BeginTransactionAsync(cancellationToken);
        var now = Now();
        var (error, item) = catalog switch
        {
            "areas" => await SaveAreaAsync(edit, now, cancellationToken),
            "equipment" => await SaveEquipmentAsync(edit, now, cancellationToken),
            "contractors" => await SaveContractorAsync(edit, now, cancellationToken),
            "work-types" => await SaveCodedAsync(edit, now, "work-type", cancellationToken),
            "hazards" => await SaveCodedAsync(edit, now, "hazard", cancellationToken),
            "controls" => await SaveCodedAsync(edit, now, "control", cancellationToken),
            "ppe" => await SaveCodedAsync(edit, now, "ppe", cancellationToken),
            "templates" => await SaveTemplateAsync(edit, now, cancellationToken),
            _ => ("catalog-invalid", null),
        };
        if (error is null && item is not null)
        {
            var verb = edit.Id is null ? "CREATED" : edit.Enabled ? "UPDATED" : "DISABLED";
            Audit(actor.User.Id, item.Id, catalog, CatalogAuditAction(catalog, verb), edit.Name, null, now);
            await database.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }

        return (error, item);
    }

    public async Task<IReadOnlyList<FieldView>> FieldsAsync(string? token, CancellationToken cancellationToken)
    {
        await RequireAsync(token, cancellationToken);
        var fields = await database.PermitFieldDefinitions.AsNoTracking().OrderBy(item => item.ConfigurationVersion).ThenBy(item => item.DisplayOrder).ToListAsync(cancellationToken);
        var choices = await database.PermitFieldChoices.AsNoTracking().ToListAsync(cancellationToken);
        return fields.Select(field => new FieldView(field.Id, field.PermitType, field.ModuleKind, field.Code, field.Label, field.HelpText, field.FieldType, field.Required, field.DisplayOrder, field.Enabled, field.ConfigurationVersion, choices.Where(choice => choice.FieldDefinitionId == field.Id).Select(choice => new ChoiceView(choice.Id, choice.Code, choice.Label, choice.Enabled, choice.DisplayOrder)).ToArray())).ToArray();
    }

    public async Task<(string? Error, FieldView? Field)> SaveFieldAsync(string? token, FieldEdit edit, CancellationToken cancellationToken)
    {
        var actor = await RequireAsync(token, cancellationToken);
        if (CatalogRules.PermitTypeCode(edit.PermitType) is { } typeError) return (typeError, null);
        if (CatalogRules.Code(edit.Code) is { } codeError) return (codeError, null);
        if (CatalogRules.Label(edit.Label) is { } labelError) return (labelError, null);
        if (CatalogRules.FieldType(edit.FieldType) is { } type) return (type, null);
        if (CatalogRules.ContainsExecutable(edit.HelpText) || CatalogRules.ContainsExecutable(edit.ModuleKind)) return ("executable-content-rejected", null);
        var published = await PublishedAsync(cancellationToken);
        await using var transaction = await database.Database.BeginTransactionAsync(cancellationToken);
        PermitFieldDefinition field;
        if (edit.Id is Guid id)
        {
            var current = await database.PermitFieldDefinitions.FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
            if (current is null) return ("not-found", null);
            var choices = await database.PermitFieldChoices.Where(item => item.FieldDefinitionId == id).ToListAsync(cancellationToken);
            var revised = CatalogRules.Revise(current, choices, edit.Label.Trim(), edit.Required, published);
            field = revised.Draft ?? revised.Published;
            if (revised.Draft is not null)
            {
                database.PermitFieldDefinitions.Add(revised.Draft);
                database.PermitFieldChoices.AddRange(revised.DraftChoices);
            }
        }
        else
        {
            field = new PermitFieldDefinition
            {
                Id = Guid.NewGuid(),
                PermitType = edit.PermitType.Trim().ToUpperInvariant(),
                ModuleKind = string.IsNullOrWhiteSpace(edit.ModuleKind) ? null : edit.ModuleKind.Trim().ToUpperInvariant(),
                Code = edit.Code.Trim().ToUpperInvariant(),
                Label = edit.Label.Trim(),
                HelpText = edit.HelpText?.Trim(),
                FieldType = edit.FieldType.Trim().ToUpperInvariant(),
                Required = edit.Required,
                DisplayOrder = edit.DisplayOrder,
                Enabled = edit.Enabled,
                ConfigurationVersion = published + 1,
            };
            database.PermitFieldDefinitions.Add(field);
        }

        Audit(actor.User.Id, field.Id, "form-field", "UPDATED", field.Label, null, Now());
        await database.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return (null, new FieldView(field.Id, field.PermitType, field.ModuleKind, field.Code, field.Label, field.HelpText, field.FieldType, field.Required, field.DisplayOrder, field.Enabled, field.ConfigurationVersion, []));
    }

    public async Task<string?> SaveChoiceAsync(string? token, ChoiceEdit edit, CancellationToken cancellationToken)
    {
        var actor = await RequireAsync(token, cancellationToken);
        if (CatalogRules.Code(edit.Code) is { } codeError) return codeError;
        if (CatalogRules.Label(edit.Label) is { } labelError) return labelError;
        if (CatalogRules.ContainsExecutable(edit.Description)) return "executable-content-rejected";
        var field = await database.PermitFieldDefinitions.FirstOrDefaultAsync(item => item.Id == edit.FieldId, cancellationToken);
        if (field is null) return "not-found";
        if (field.FieldType is not ("SINGLE_SELECT" or "MULTI_SELECT")) return "field-type-invalid";
        var published = await PublishedAsync(cancellationToken);
        if (field.ConfigurationVersion <= published) return "form-version-locked";
        database.PermitFieldChoices.Add(new PermitFieldChoice
        {
            Id = Guid.NewGuid(),
            FieldDefinitionId = field.Id,
            Code = edit.Code.Trim().ToUpperInvariant(),
            Label = edit.Label.Trim(),
            Description = edit.Description?.Trim(),
            DisplayOrder = edit.DisplayOrder,
            Enabled = edit.Enabled,
        });
        Audit(actor.User.Id, field.Id, "field-choice", "UPDATED", edit.Label.Trim(), null, Now());
        await database.SaveChangesAsync(cancellationToken);
        return null;
    }

    public async Task<string?> PublishAsync(string? token, string pin, Guid? deviceId, CancellationToken cancellationToken)
    {
        var actor = await RequireAsync(token, cancellationToken);
        await using var transaction = await database.Database.BeginTransactionAsync(cancellationToken);
        var pinError = await ConfirmPinAsync(actor, pin, deviceId, cancellationToken);
        if (pinError is not null) return pinError;
        var publication = await PublicationAsync(cancellationToken);
        var next = await database.PermitFieldDefinitions.Select(item => (int?)item.ConfigurationVersion).MaxAsync(cancellationToken) ?? publication.PublishedVersion;
        var ruleVersion = await database.PermitRules.Select(item => (int?)item.ConfigurationVersion).MaxAsync(cancellationToken) ?? publication.PublishedVersion;
        publication.PublishedVersion = Math.Max(next, ruleVersion);
        publication.PublishedAt = Now();
        publication.PublishedByUserId = actor.User.Id;
        Audit(actor.User.Id, null, "form-configuration", "FORM_CONFIGURATION_PUBLISHED", $"version {publication.PublishedVersion}", deviceId, publication.PublishedAt.Value);
        await database.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return null;
    }

    public async Task<IReadOnlyList<RuleView>> RulesAsync(string? token, CancellationToken cancellationToken)
    {
        await RequireAsync(token, cancellationToken);
        return await database.PermitRules.AsNoTracking().OrderBy(item => item.ConfigurationVersion).Select(item => new RuleView(item.Id, item.ConfigurationVersion, item.ConditionCode, item.ConditionValue, item.Action, item.ActionTarget, item.Enabled)).ToListAsync(cancellationToken);
    }

    public async Task<string?> SaveRuleAsync(string? token, RuleEdit edit, string pin, Guid? deviceId, CancellationToken cancellationToken)
    {
        var actor = await RequireAsync(token, cancellationToken);
        if (CatalogRules.Rule(edit.Action, edit.ConditionCode, edit.ConditionValue, edit.ActionTarget) is { } error) return error;
        await using var transaction = await database.Database.BeginTransactionAsync(cancellationToken);
        var pinError = await ConfirmPinAsync(actor, pin, deviceId, cancellationToken);
        if (pinError is not null) return pinError;
        var published = await PublishedAsync(cancellationToken);
        var rule = new PermitRule
        {
            Id = Guid.NewGuid(),
            ConfigurationVersion = published + 1,
            ConditionCode = edit.ConditionCode.Trim().ToUpperInvariant(),
            ConditionValue = edit.ConditionValue.Trim(),
            Action = edit.Action.Trim().ToUpperInvariant(),
            ActionTarget = edit.ActionTarget.Trim().ToUpperInvariant(),
            Enabled = edit.Enabled,
        };
        database.PermitRules.Add(rule);
        Audit(actor.User.Id, rule.Id, "permit-rule", "UPDATED", $"{rule.Action} {rule.ActionTarget}", deviceId, Now());
        await database.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return null;
    }

    public async Task<IReadOnlyList<PermitTypeView>> PermitTypesAsync(string? token, CancellationToken cancellationToken)
    {
        await RequireAsync(token, cancellationToken);
        return CatalogRules.PermitTypes().Select(item => new PermitTypeView(item.Code, item.Modules)).ToArray();
    }

    public async Task<int> PublishedVersionAsync(string? token, CancellationToken cancellationToken)
    {
        await RequireAsync(token, cancellationToken);
        return await PublishedAsync(cancellationToken);
    }

    private async Task<(string? Error, CatalogItemView? Item)> SaveAreaAsync(CatalogEdit edit, DateTimeOffset now, CancellationToken cancellationToken)
    {
        if (!AreaRegistration.TryNormalize(edit.Name, out var name, out var error)) return (error, null);
        if (edit.Id is Guid id)
        {
            var area = await database.Areas.FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
            if (area is null) return ("not-found", null);
            var referenced = await database.Permits.AnyAsync(item => item.AreaId == id, cancellationToken);
            if (CatalogRules.AreaChange(referenced, area.Name, name) is { } blocked) return (blocked, null);
            if (!string.Equals(area.Name, name, StringComparison.Ordinal) && await database.Areas.AnyAsync(item => item.Name == name && item.Id != id, cancellationToken)) return (AreaRegistration.DuplicateName, null);
            area.Name = name;
            area.Enabled = edit.Enabled;
            area.UpdatedAt = now;
            return (null, new CatalogItemView(area.Id, area.Name, area.Name, null, area.Enabled, 0, null));
        }

        if (await database.Areas.AnyAsync(item => item.Name == name, cancellationToken)) return (AreaRegistration.DuplicateName, null);
        var created = new Area { Id = Guid.NewGuid(), Name = name, Enabled = edit.Enabled, UpdatedAt = now };
        database.Areas.Add(created);
        return (null, new CatalogItemView(created.Id, created.Name, created.Name, null, created.Enabled, 0, null));
    }

    private async Task<(string? Error, CatalogItemView? Item)> SaveEquipmentAsync(CatalogEdit edit, DateTimeOffset now, CancellationToken cancellationToken)
    {
        if (CatalogRules.Code(edit.Code) is { } codeError) return (codeError, null);
        if (!Guid.TryParse(edit.ParentId, out var areaId) || !await database.Areas.AnyAsync(item => item.Id == areaId, cancellationToken)) return ("area-required", null);
        if (edit.Id is Guid id)
        {
            var equipment = await database.Equipment.FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
            if (equipment is null) return ("not-found", null);
            var referenced = await database.Permits.AnyAsync(item => item.EquipmentId == id, cancellationToken);
            if (referenced && !string.Equals(equipment.Tag, edit.Code.Trim(), StringComparison.OrdinalIgnoreCase)) return ("equipment-history-preserved", null);
            equipment.Tag = edit.Code.Trim().ToUpperInvariant();
            equipment.Name = edit.Name.Trim();
            equipment.EquipmentType = edit.Detail?.Trim();
            equipment.Enabled = edit.Enabled;
            equipment.UpdatedAt = now;
            return (null, new CatalogItemView(equipment.Id, equipment.Tag, equipment.Name, equipment.EquipmentType, equipment.Enabled, 0, equipment.AreaId.ToString()));
        }

        var created = new Equipment { Id = Guid.NewGuid(), AreaId = areaId, Tag = edit.Code.Trim().ToUpperInvariant(), Name = edit.Name.Trim(), EquipmentType = edit.Detail?.Trim(), Enabled = edit.Enabled, CreatedAt = now };
        database.Equipment.Add(created);
        return (null, new CatalogItemView(created.Id, created.Tag, created.Name, created.EquipmentType, created.Enabled, 0, created.AreaId.ToString()));
    }

    private async Task<(string? Error, CatalogItemView? Item)> SaveContractorAsync(CatalogEdit edit, DateTimeOffset now, CancellationToken cancellationToken)
    {
        if (edit.Id is Guid id)
        {
            var contractor = await database.Contractors.FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
            if (contractor is null) return ("not-found", null);
            var referenced = await database.Permits.AnyAsync(item => item.ContractorId == id, cancellationToken);
            if (referenced && !string.Equals(contractor.Name, edit.Name.Trim(), StringComparison.Ordinal)) return ("contractor-history-preserved", null);
            contractor.Name = edit.Name.Trim();
            contractor.ShortName = edit.Detail?.Trim();
            contractor.Enabled = edit.Enabled;
            contractor.UpdatedAt = now;
            return (null, new CatalogItemView(contractor.Id, contractor.Name, contractor.Name, contractor.ShortName, contractor.Enabled, 0, null));
        }

        var created = new Contractor { Id = Guid.NewGuid(), Name = edit.Name.Trim(), ShortName = edit.Detail?.Trim(), Enabled = edit.Enabled, CreatedAt = now };
        database.Contractors.Add(created);
        return (null, new CatalogItemView(created.Id, created.Name, created.Name, created.ShortName, created.Enabled, 0, null));
    }

    private async Task<(string? Error, CatalogItemView? Item)> SaveCodedAsync(CatalogEdit edit, DateTimeOffset now, string kind, CancellationToken cancellationToken)
    {
        if (CatalogRules.Code(edit.Code) is { } codeError) return (codeError, null);
        var code = edit.Code.Trim().ToUpperInvariant();
        if (kind == "work-type") return await SaveWorkTypeAsync(edit, code, now, cancellationToken);
        if (kind == "hazard") return await SaveHazardAsync(edit, code, now, cancellationToken);
        if (kind == "control") return await SaveControlAsync(edit, code, now, cancellationToken);
        return await SavePpeAsync(edit, code, now, cancellationToken);
    }

    private async Task<(string? Error, CatalogItemView? Item)> SaveWorkTypeAsync(CatalogEdit edit, string code, DateTimeOffset now, CancellationToken cancellationToken)
    {
        if (edit.Id is Guid id)
        {
            var item = await database.WorkTypes.FirstOrDefaultAsync(row => row.Id == id, cancellationToken) ?? throw new DirectoryRejected("not-found");
            item.Name = edit.Name.Trim();
            item.Description = edit.Detail?.Trim();
            item.Enabled = edit.Enabled;
            item.DisplayOrder = edit.DisplayOrder;
            item.UpdatedAt = now;
            return (null, new CatalogItemView(item.Id, item.Code, item.Name, item.Description, item.Enabled, item.DisplayOrder, null));
        }

        if (await database.WorkTypes.AnyAsync(row => row.Code == code, cancellationToken)) return ("code-invalid", null);
        var created = new WorkType { Id = Guid.NewGuid(), Code = code, Name = edit.Name.Trim(), Description = edit.Detail?.Trim(), Enabled = edit.Enabled, DisplayOrder = edit.DisplayOrder, CreatedAt = now };
        database.WorkTypes.Add(created);
        return (null, new CatalogItemView(created.Id, created.Code, created.Name, created.Description, created.Enabled, created.DisplayOrder, null));
    }

    private async Task<(string? Error, CatalogItemView? Item)> SaveHazardAsync(CatalogEdit edit, string code, DateTimeOffset now, CancellationToken cancellationToken)
    {
        if (edit.Id is Guid id)
        {
            var item = await database.HazardDefinitions.FirstOrDefaultAsync(row => row.Id == id, cancellationToken) ?? throw new DirectoryRejected("not-found");
            item.Name = edit.Name.Trim();
            item.Description = edit.Detail?.Trim();
            item.ApplicablePermitTypes = edit.ParentId;
            item.Enabled = edit.Enabled;
            item.DisplayOrder = edit.DisplayOrder;
            item.UpdatedAt = now;
            return (null, new CatalogItemView(item.Id, item.Code, item.Name, item.Description, item.Enabled, item.DisplayOrder, item.ApplicablePermitTypes));
        }

        var created = new HazardDefinition { Id = Guid.NewGuid(), Code = code, Name = edit.Name.Trim(), Description = edit.Detail?.Trim(), ApplicablePermitTypes = edit.ParentId, Enabled = edit.Enabled, DisplayOrder = edit.DisplayOrder, CreatedAt = now };
        database.HazardDefinitions.Add(created);
        return (null, new CatalogItemView(created.Id, created.Code, created.Name, created.Description, created.Enabled, created.DisplayOrder, created.ApplicablePermitTypes));
    }

    private async Task<(string? Error, CatalogItemView? Item)> SaveControlAsync(CatalogEdit edit, string code, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var created = new ControlDefinition { Id = Guid.NewGuid(), Code = code, Name = edit.Name.Trim(), Description = edit.Detail?.Trim(), ApplicablePermitTypes = edit.ParentId, Enabled = edit.Enabled, DisplayOrder = edit.DisplayOrder, CreatedAt = now };
        if (edit.Id is Guid id)
        {
            var item = await database.ControlDefinitions.FirstOrDefaultAsync(row => row.Id == id, cancellationToken) ?? throw new DirectoryRejected("not-found");
            item.Name = created.Name;
            item.Description = created.Description;
            item.ApplicablePermitTypes = created.ApplicablePermitTypes;
            item.Enabled = created.Enabled;
            item.DisplayOrder = created.DisplayOrder;
            item.UpdatedAt = now;
            return (null, new CatalogItemView(item.Id, item.Code, item.Name, item.Description, item.Enabled, item.DisplayOrder, item.ApplicablePermitTypes));
        }

        database.ControlDefinitions.Add(created);
        return (null, new CatalogItemView(created.Id, created.Code, created.Name, created.Description, created.Enabled, created.DisplayOrder, created.ApplicablePermitTypes));
    }

    private async Task<(string? Error, CatalogItemView? Item)> SavePpeAsync(CatalogEdit edit, string code, DateTimeOffset now, CancellationToken cancellationToken)
    {
        if (edit.Id is Guid id)
        {
            var item = await database.PpeDefinitions.FirstOrDefaultAsync(row => row.Id == id, cancellationToken) ?? throw new DirectoryRejected("not-found");
            item.Name = edit.Name.Trim();
            item.Description = edit.Detail?.Trim();
            item.Enabled = edit.Enabled;
            item.DisplayOrder = edit.DisplayOrder;
            item.UpdatedAt = now;
            return (null, new CatalogItemView(item.Id, item.Code, item.Name, item.Description, item.Enabled, item.DisplayOrder, null));
        }

        var created = new PpeDefinition { Id = Guid.NewGuid(), Code = code, Name = edit.Name.Trim(), Description = edit.Detail?.Trim(), Enabled = edit.Enabled, DisplayOrder = edit.DisplayOrder, CreatedAt = now };
        database.PpeDefinitions.Add(created);
        return (null, new CatalogItemView(created.Id, created.Code, created.Name, created.Description, created.Enabled, created.DisplayOrder, null));
    }

    private async Task<(string? Error, CatalogItemView? Item)> SaveTemplateAsync(CatalogEdit edit, DateTimeOffset now, CancellationToken cancellationToken)
    {
        if (CatalogRules.PermitTypeCode(edit.Code) is { } typeError) return (typeError, null);
        if (edit.Id is Guid id)
        {
            var item = await database.PermitTemplates.FirstOrDefaultAsync(row => row.Id == id, cancellationToken) ?? throw new DirectoryRejected("not-found");
            item.Name = edit.Name.Trim();
            item.Description = edit.Detail?.Trim();
            item.Enabled = edit.Enabled;
            item.Version += 1;
            item.UpdatedAt = now;
            return (null, new CatalogItemView(item.Id, item.PermitType, item.Name, item.Description, item.Enabled, item.Version, item.DefaultAreaId?.ToString()));
        }

        var created = new PermitTemplate { Id = Guid.NewGuid(), Name = edit.Name.Trim(), Description = edit.Detail?.Trim(), PermitType = edit.Code.Trim().ToUpperInvariant(), Enabled = edit.Enabled, Version = 1, CreatedAt = now };
        database.PermitTemplates.Add(created);
        return (null, new CatalogItemView(created.Id, created.PermitType, created.Name, created.Description, created.Enabled, created.Version, null));
    }

    private async Task<string?> ConfirmPinAsync(Actor actor, string pin, Guid? deviceId, CancellationToken cancellationToken)
    {
        var verified = PinCommands.Verify(actor.Credential, pin, Now(), hasher, deviceId);
        if (verified.Audit is not null) database.CredentialAudits.Add(verified.Audit);
        if (verified.Error is not null || actor.Credential.State != PinCredentialState.ACTIVE)
        {
            await database.SaveChangesAsync(cancellationToken);
            await database.Database.CommitTransactionAsync(cancellationToken);
            return verified.Error ?? "pin-not-enrolled";
        }

        return null;
    }

    private async Task<int> PublishedAsync(CancellationToken cancellationToken) => (await PublicationAsync(cancellationToken)).PublishedVersion;

    private async Task<FormPublication> PublicationAsync(CancellationToken cancellationToken)
    {
        var publication = await database.FormPublications.FirstOrDefaultAsync(item => item.Id == 1, cancellationToken);
        if (publication is not null) return publication;
        publication = new FormPublication { Id = 1, PublishedVersion = 0 };
        database.FormPublications.Add(publication);
        return publication;
    }

    private static string CatalogAuditAction(string catalog, string verb) => catalog switch
    {
        "areas" => $"AREA_{verb}",
        "equipment" => $"EQUIPMENT_{verb}",
        "contractors" => $"CONTRACTOR_{verb}",
        "work-types" => $"WORK_TYPE_{verb}",
        "templates" => $"TEMPLATE_{verb}",
        "hazards" => $"HAZARD_{verb}",
        "controls" => $"CONTROL_{verb}",
        "ppe" => $"PPE_{verb}",
        _ => verb,
    };

    private void Audit(Guid actorId, Guid? entityId, string entityType, string action, string summary, Guid? deviceId, DateTimeOffset now) =>
        database.ConfigurationAudits.Add(new ConfigurationAudit
        {
            Id = Guid.NewGuid(),
            PerformedByUserId = actorId,
            OccurredAt = now,
            EntityType = entityType,
            EntityId = entityId,
            Action = action.Length > 40 ? action[..40] : action,
            Summary = summary.Length > 200 ? summary[..200] : summary,
            DeviceId = deviceId,
        });

    private async Task<Actor> RequireAsync(string? token, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(token)) throw new DirectoryRejected("session-required");
        var hash = SessionTokens.Hash(token.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase) ? token[7..].Trim() : token.Trim());
        var now = Now();
        var session = await database.UserSessions.AsNoTracking().FirstOrDefaultAsync(item => item.TokenHash == hash && item.RevokedAt == null && item.ExpiresAt > now, cancellationToken);
        if (session is null) throw new DirectoryRejected("session-required");
        var user = await database.Users.FirstOrDefaultAsync(item => item.Id == session.UserId && item.Enabled, cancellationToken);
        if (user is null) throw new DirectoryRejected("session-required");
        var roles = await database.UserRoles.Where(item => item.UserId == user.Id).Join(database.Roles, membership => membership.RoleId, role => role.Id, (_, role) => role.Name).ToListAsync(cancellationToken);
        if (CatalogRules.Access(roles) is not null) throw new DirectoryRejected("capability-required");
        var credential = await database.UserCredentials.FirstAsync(item => item.UserId == user.Id, cancellationToken);
        return new Actor(user, credential);
    }

    private static DateTimeOffset Now() => DateTimeOffset.UtcNow;

    private sealed record Actor(User User, UserCredential Credential);
}
