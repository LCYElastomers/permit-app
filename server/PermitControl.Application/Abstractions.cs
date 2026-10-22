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

public sealed class DatabaseNotConfiguredException : InvalidOperationException
{
    public DatabaseNotConfiguredException()
        : base("PostgreSQL is not configured. The API contract is available, but no database is connected.")
    {
    }
}
