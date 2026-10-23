namespace PermitControl.Domain;

public static class PermitCapabilities
{
    private static readonly HashSet<string> GrantedBySuperAdmin =
    [
        nameof(AppRole.ADMIN),
        nameof(AppRole.REQUESTER),
        nameof(AppRole.PERMIT_AUTHORIZER),
        nameof(AppRole.SHIFT_SUPERVISOR),
        nameof(AppRole.CRAFT_RECEIVER),
        nameof(AppRole.SAFETY),
        nameof(AppRole.VIEWER),
        nameof(AppRole.SUPER_ADMIN),
    ];

    public static bool Has(IEnumerable<string> roles, string capability)
    {
        var held = roles as IReadOnlySet<string> ?? roles.ToHashSet(StringComparer.Ordinal);
        if (held.Contains(nameof(AppRole.SUPER_ADMIN)) && GrantedBySuperAdmin.Contains(capability))
        {
            return true;
        }

        return held.Contains(capability);
    }

    public static bool Known(string role) => Enum.TryParse<AppRole>(role, out var parsed) && Enum.IsDefined(parsed);
}

public static class WindowsAccounts
{
    public static (string? Domain, string Username) Normalize(string? domain, string? username)
    {
        var raw = (username ?? "").Trim();
        var split = raw.Split('\\', 2);
        if (split.Length == 2)
        {
            domain = split[0];
            raw = split[1];
        }

        raw = raw.Trim();
        var user = raw.ToLowerInvariant();
        var normalizedDomain = string.IsNullOrWhiteSpace(domain) ? null : domain.Trim().ToLowerInvariant();
        return (normalizedDomain, user);
    }

    public static bool UsernameMatches(User user, string username) =>
        string.Equals(user.WindowsUsername, username, StringComparison.OrdinalIgnoreCase);

    public static bool DomainMatches(User user, string? domain)
    {
        if (domain is null) return true;
        if (string.IsNullOrWhiteSpace(user.WindowsDomain)) return true;
        return string.Equals(user.WindowsDomain, domain, StringComparison.OrdinalIgnoreCase);
    }
}

public static class UserCodes
{
    public const int Width = 4;
    public const string AllocateSql =
        """
        INSERT INTO user_code_counters ("Id", "LastValue")
        VALUES (1, 1)
        ON CONFLICT ("Id") DO UPDATE
        SET "LastValue" = user_code_counters."LastValue" + 1
        RETURNING "LastValue"
        """;

    public static string Format(int sequence)
    {
        if (sequence < 1) throw new ArgumentOutOfRangeException(nameof(sequence));
        return $"PCU-{sequence.ToString().PadLeft(Width, '0')}";
    }
}

public static class PermitPolicies
{
    public const string AllowSelfAuthorization = "AllowSelfAuthorization";
}
