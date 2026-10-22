using PermitControl.Application;
using PermitControl.Domain;

namespace PermitControl.Infrastructure.Storage;

/// <summary>
/// Skeleton for server filesystem storage. No upload endpoint calls this yet.
/// Bytes are never stored in PostgreSQL.
/// </summary>
public sealed class LocalFileStorage(string? root) : IFileStorage
{
    public StorageProvider Provider => StorageProvider.LOCAL_SERVER;

    public async Task<StoredFile> SaveAsync(FileSaveRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(root))
        {
            throw new InvalidOperationException("PERMIT_FILE_ROOT is not configured.");
        }

        var extension = Path.GetExtension(request.OriginalFilename);
        var storedFilename = $"{request.Id:N}{extension}";
        Directory.CreateDirectory(root);
        var path = Path.Combine(root, storedFilename);
        await File.WriteAllBytesAsync(path, request.Content, cancellationToken);
        return new StoredFile(storedFilename, Provider, storedFilename);
    }
}
