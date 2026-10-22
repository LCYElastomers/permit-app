namespace PermitControl.Domain;

public enum AreaPreparationKind
{
    Ready,
    Invalid,
    Conflict,
}

public sealed record AreaPreparation(AreaPreparationKind Kind, Guid Id, string Name, string? Error)
{
    public static AreaPreparation Invalid(string error) => new(AreaPreparationKind.Invalid, Guid.Empty, "", error);

    public static AreaPreparation Conflict(string error) => new(AreaPreparationKind.Conflict, Guid.Empty, "", error);

    public static AreaPreparation Ready(Guid id, string name) => new(AreaPreparationKind.Ready, id, name, null);
}

/// <summary>
/// Area name and identity rules. Areas have no enabled flag; the unique name is the current identity.
/// </summary>
public static class AreaRegistration
{
    public const int MaxNameLength = 120;

    public const string NameRequired = "name is required";
    public const string NameTooLong = "name is too long";
    public const string IdInvalid = "id is invalid";
    public const string DuplicateName = "area name already exists";
    public const string DuplicateId = "area id already exists";
    public const string Duplicate = "area name or id already exists";

    public static bool TryNormalize(string? requestedName, out string name, out string? error)
    {
        name = requestedName?.Trim() ?? "";
        if (name.Length == 0)
        {
            error = NameRequired;
            return false;
        }

        if (name.Length > MaxNameLength)
        {
            name = "";
            error = NameTooLong;
            return false;
        }

        error = null;
        return true;
    }

    public static AreaPreparation Decide(
        Guid? requestedId,
        string normalizedName,
        bool suppliedIdExists,
        bool nameExists,
        Func<Guid>? allocateId = null)
    {
        if (requestedId == Guid.Empty)
        {
            return AreaPreparation.Invalid(IdInvalid);
        }

        if (requestedId is Guid && suppliedIdExists)
        {
            return AreaPreparation.Conflict(DuplicateId);
        }

        if (nameExists)
        {
            return AreaPreparation.Conflict(DuplicateName);
        }

        var id = requestedId ?? (allocateId ?? Guid.NewGuid)();
        return AreaPreparation.Ready(id, normalizedName);
    }
}
