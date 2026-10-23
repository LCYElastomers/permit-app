using System.Security.Cryptography;
using System.Text;
using Isopoh.Cryptography.Argon2;

namespace PermitControl.Domain;

public static class PinPolicy
{
    public const int Length = 6;
    public static readonly TimeSpan MinimumAge = TimeSpan.FromHours(24);
    public const int HistoryDepth = 3;
    public const int FailedAttemptLimit = 5;
    public static readonly TimeSpan Lockout = TimeSpan.FromMinutes(15);

    private static readonly HashSet<string> Weak =
    [
        "000000", "111111", "222222", "333333", "444444",
        "555555", "666666", "777777", "888888", "999999",
        "123456", "654321",
    ];

    public static string? ValidateFormat(string? pin)
    {
        if (pin is null || pin.Length != Length || pin.Any(character => !char.IsDigit(character)))
        {
            return "pin-format-invalid";
        }

        return Weak.Contains(pin) ? "pin-too-weak" : null;
    }
}

public interface IPinHasher
{
    string Hash(string pin);
    bool Verify(string pin, string encodedHash);
}

/// <summary>
/// Argon2id via Isopoh.Cryptography.Argon2 2.0.0 (MIT). The encoded hash carries a unique
/// salt and the cost parameters. The PIN itself is not stored.
/// </summary>
public sealed class Argon2PinHasher : IPinHasher
{
    public const int MemoryKiB = 8192;
    public const int TimeCost = 2;
    public const int Lanes = 1;

    public static readonly Argon2PinHasher Interactive = new();

    public string Hash(string pin)
    {
        var salt = new byte[16];
        RandomNumberGenerator.Fill(salt);
        var config = Config(pin, salt);
        using var argon = new Argon2(config);
        using var hash = argon.Hash();
        return config.EncodeString(hash.Buffer);
    }

    public bool Verify(string pin, string encodedHash)
    {
        if (string.IsNullOrWhiteSpace(encodedHash) || !encodedHash.StartsWith("$argon2id$", StringComparison.Ordinal))
        {
            return false;
        }

        return Argon2.Verify(encodedHash, Encoding.UTF8.GetBytes(pin));
    }

    private static Argon2Config Config(string pin, byte[] salt) => new()
    {
        Type = Argon2Type.HybridAddressing,
        Version = Argon2Version.Nineteen,
        TimeCost = TimeCost,
        MemoryCost = MemoryKiB,
        Lanes = Lanes,
        Threads = Lanes,
        Password = Encoding.UTF8.GetBytes(pin),
        Salt = salt,
        HashLength = 32,
    };
}

public static class SessionTokens
{
    public static (string Token, string Hash) Create()
    {
        var bytes = new byte[32];
        RandomNumberGenerator.Fill(bytes);
        var token = Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
        return (token, Hash(token));
    }

    public static string Hash(string token)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(token));
        return Convert.ToHexString(hash).ToLowerInvariant();
    }
}
