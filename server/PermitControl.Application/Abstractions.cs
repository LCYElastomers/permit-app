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
    Task<byte[]?> ReadAsync(string storageKey, CancellationToken cancellationToken);
}

public interface IPermitPdfRenderer
{
    byte[] Render(PermitDocument document);
}

public interface IPermitPdfExport
{
    Task<PermitPdfPrepared> CreateAsync(Guid permitId, PermitExportType exportType, CancellationToken cancellationToken);
    Task<PermitPdfFile?> OpenAsync(Guid exportId, CancellationToken cancellationToken);
}

public sealed class PermitPdfFile
{
    public required byte[] Content { get; init; }
    public required string Filename { get; init; }
    public string MimeType { get; init; } = "application/pdf";
}

public sealed class FileStorageException : Exception
{
    public FileStorageException(string code)
        : base(code)
    {
        Code = code;
    }

    public string Code { get; }
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
