using PermitControl.Domain;

namespace PermitControl.Application;

public interface IDatabaseAvailability
{
    bool IsConfigured { get; }
}

public interface IFileStorage
{
    StorageProvider Provider { get; }
    Task<StoredFile> SaveAsync(FileSaveRequest request, CancellationToken cancellationToken);
}

/// <summary>
/// Area reference data. Equipment, contractors, permit templates, and users
/// should each get a catalog of this shape. There is no shared generic repository.
/// </summary>
public interface IAreaCatalog
{
    Task<IReadOnlyList<AreaResponse>> ListAsync(CancellationToken cancellationToken);

    Task<AreaResponse?> GetAsync(Guid id, CancellationToken cancellationToken);

    Task<AreaPreparation> CreateAsync(Guid? id, string? name, CancellationToken cancellationToken);
}

public interface IGeneralWorkSync
{
    Task<GeneralWorkResult> PushAsync(GeneralWorkPush push, CancellationToken cancellationToken);
}

public interface IDatabaseProbe
{
    Task<bool> CanQueryAsync(CancellationToken cancellationToken);
}

public sealed class DatabaseUnavailableException : Exception
{
    public DatabaseUnavailableException()
        : base("The database could not be queried.")
    {
    }
}

public sealed class DatabaseNotConfiguredException : InvalidOperationException
{
    public DatabaseNotConfiguredException()
        : base("PostgreSQL is not configured. The API contract is available, but no database is connected.")
    {
    }
}
