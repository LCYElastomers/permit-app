using PermitControl.Domain;

namespace PermitControl.Domain.Tests;

public sealed class AreaRegistrationTests
{
    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("\t")]
    public void Whitespace_only_names_are_rejected(string? requested)
    {
        var accepted = AreaRegistration.TryNormalize(requested, out _, out var error);

        Assert.False(accepted);
        Assert.Equal(AreaRegistration.NameRequired, error);
    }

    [Fact]
    public void Leading_and_trailing_whitespace_is_removed()
    {
        var accepted = AreaRegistration.TryNormalize("  Unit 1  ", out var name, out var error);

        Assert.True(accepted);
        Assert.Null(error);
        Assert.Equal("Unit 1", name);
    }

    [Fact]
    public void Name_at_the_column_limit_is_accepted()
    {
        var requested = new string('A', AreaRegistration.MaxNameLength);

        var accepted = AreaRegistration.TryNormalize(requested, out var name, out _);

        Assert.True(accepted);
        Assert.Equal(AreaRegistration.MaxNameLength, name.Length);
    }

    [Fact]
    public void Name_past_the_column_limit_is_rejected()
    {
        var requested = new string('A', AreaRegistration.MaxNameLength + 1);

        var accepted = AreaRegistration.TryNormalize(requested, out _, out var error);

        Assert.False(accepted);
        Assert.Equal(AreaRegistration.NameTooLong, error);
    }

    [Fact]
    public void Empty_id_is_invalid()
    {
        var result = AreaRegistration.Decide(Guid.Empty, "Unit 1", suppliedIdExists: false, nameExists: false);

        Assert.Equal(AreaPreparationKind.Invalid, result.Kind);
        Assert.Equal(AreaRegistration.IdInvalid, result.Error);
    }

    [Fact]
    public void Supplied_id_is_kept_when_the_name_is_free()
    {
        var id = Guid.Parse("6f1c1c3e-8b2a-4c1d-9a0e-1b2c3d4e5f60");

        var result = AreaRegistration.Decide(id, "Unit 1", suppliedIdExists: false, nameExists: false);

        Assert.Equal(AreaPreparationKind.Ready, result.Kind);
        Assert.Equal(id, result.Id);
        Assert.Equal("Unit 1", result.Name);
    }

    [Fact]
    public void Missing_id_uses_the_supplied_allocator()
    {
        var id = Guid.Parse("0b6d1a22-1111-4a1b-9c1d-111111111111");

        var result = AreaRegistration.Decide(null, "Tank Farm", suppliedIdExists: false, nameExists: false, () => id);

        Assert.Equal(AreaPreparationKind.Ready, result.Kind);
        Assert.Equal(id, result.Id);
    }

    [Fact]
    public void Duplicate_name_is_a_conflict()
    {
        var result = AreaRegistration.Decide(null, "Unit 1", suppliedIdExists: false, nameExists: true, () => Guid.NewGuid());

        Assert.Equal(AreaPreparationKind.Conflict, result.Kind);
        Assert.Equal(AreaRegistration.DuplicateName, result.Error);
    }

    [Fact]
    public void Duplicate_supplied_id_is_a_conflict()
    {
        var result = AreaRegistration.Decide(Guid.NewGuid(), "Unit 2", suppliedIdExists: true, nameExists: false);

        Assert.Equal(AreaPreparationKind.Conflict, result.Kind);
        Assert.Equal(AreaRegistration.DuplicateId, result.Error);
    }

    [Fact]
    public void Duplicate_id_is_reported_before_a_duplicate_name()
    {
        var result = AreaRegistration.Decide(Guid.NewGuid(), "Unit 1", suppliedIdExists: true, nameExists: true);

        Assert.Equal(AreaRegistration.DuplicateId, result.Error);
    }
}
