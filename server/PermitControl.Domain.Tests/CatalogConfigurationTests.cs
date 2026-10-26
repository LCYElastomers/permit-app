using PermitControl.Domain;

namespace PermitControl.Domain.Tests;

public sealed class CatalogConfigurationTests
{
    [Fact]
    public void Administration_requires_admin_capability()
    {
        Assert.Equal("capability-required", CatalogRules.Access(["REQUESTER", "PERMIT_AUTHORIZER"]));
        Assert.Null(CatalogRules.Access(["ADMIN"]));
        Assert.Null(CatalogRules.Access(["SUPER_ADMIN"]));
    }

    [Fact]
    public void Referenced_area_name_stays_in_place()
    {
        Assert.Equal("area-history-preserved", CatalogRules.AreaChange(true, "Unit 1", "Unit 2"));
        Assert.Null(CatalogRules.AreaChange(true, "Unit 1", "Unit 1"));
        Assert.Null(CatalogRules.AreaChange(false, "Unit 1", "Unit 2"));
    }

    [Fact]
    public void Field_and_choice_values_reject_executable_content()
    {
        Assert.Equal("field-type-invalid", CatalogRules.FieldType("SCRIPT"));
        Assert.Null(CatalogRules.FieldType("SINGLE_SELECT"));
        Assert.Equal("executable-content-rejected", CatalogRules.Label("<script>alert(1)</script>"));
        Assert.Equal("executable-content-rejected", CatalogRules.Rule("REQUIRE_MODULE", "FIELD_X", "YES; drop table", "HOT_WORK"));
        Assert.Null(CatalogRules.Rule("REQUIRE_MODULE", "FIELD_X", "YES", "HOT_WORK"));
    }

    [Fact]
    public void Revising_a_published_field_keeps_the_historical_label()
    {
        var published = new PermitFieldDefinition
        {
            Id = Guid.NewGuid(),
            PermitType = "GENERAL_WORK",
            Code = "SCOPE",
            Label = "Original scope",
            FieldType = "TEXT",
            ConfigurationVersion = 1,
        };
        var choice = new PermitFieldChoice { Id = Guid.NewGuid(), FieldDefinitionId = published.Id, Code = "YES", Label = "Yes" };
        var revised = CatalogRules.Revise(published, [choice], "Current scope", true, 1);
        Assert.Equal("Original scope", published.Label);
        Assert.NotNull(revised.Draft);
        Assert.Equal("Current scope", revised.Draft.Label);
        Assert.Equal(2, revised.Draft.ConfigurationVersion);
        Assert.NotEqual(published.Id, revised.Draft.Id);
        Assert.Equal("Yes", Assert.Single(revised.DraftChoices).Label);
        Assert.Equal(published.Id, choice.FieldDefinitionId);
    }

    [Fact]
    public void Permit_type_catalog_keeps_the_six_system_codes()
    {
        var codes = CatalogRules.PermitTypes().Select(item => item.Code).ToArray();
        Assert.Equal(["GENERAL_WORK", "HOT_WORK", "CONFINED_SPACE", "OPENING_BLINDING", "EXCAVATION", "LIVE_ELECTRICAL"], codes);
    }
}
