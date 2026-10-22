using System.Text.RegularExpressions;
using PermitControl.Application;
using PermitControl.Domain;

namespace PermitControl.Infrastructure.Storage;

/// <summary>
/// Server filesystem storage. Callers pass a storage key. The physical root stays here.
/// </summary>
public sealed partial class LocalFileStorage(string? root) : IFileStorage
{
    public StorageProvider Provider => StorageProvider.LOCAL_SERVER;

    public async Task<StoredFile> SaveAsync(FileSaveRequest request, CancellationToken cancellationToken)
    {
        var key = request.StorageKey ?? $"{request.Id:N}{Path.GetExtension(request.OriginalFilename)}";
        var path = Resolve(key);
        if (File.Exists(path)) throw new FileStorageException("export-already-stored");
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        await using var stream = new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.None);
        await stream.WriteAsync(request.Content, cancellationToken);
        return new StoredFile(Path.GetFileName(path), Provider, key);
    }

    public async Task<byte[]?> ReadAsync(string storageKey, CancellationToken cancellationToken)
    {
        var path = Resolve(storageKey);
        if (!File.Exists(path)) return null;
        return await File.ReadAllBytesAsync(path, cancellationToken);
    }

    private string Resolve(string storageKey)
    {
        if (string.IsNullOrWhiteSpace(root)) throw new FileStorageException("file-storage-not-configured");
        if (!GeneratedKey().IsMatch(storageKey) && !FlatKey().IsMatch(storageKey))
        {
            throw new FileStorageException("storage-key-rejected");
        }

        var relative = storageKey.Replace('/', Path.DirectorySeparatorChar);
        var rootFull = Path.GetFullPath(root);
        var full = Path.GetFullPath(Path.Combine(rootFull, relative));
        var prefix = rootFull.EndsWith(Path.DirectorySeparatorChar) ? rootFull : rootFull + Path.DirectorySeparatorChar;
        if (!full.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)) throw new FileStorageException("storage-key-rejected");
        return full;
    }

    [GeneratedRegex("^exports/generated/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\\.pdf$")]
    private static partial Regex GeneratedKey();

    [GeneratedRegex("^[0-9a-fA-F]{32}(\\.[A-Za-z0-9]{1,8})?$")]
    private static partial Regex FlatKey();
}
