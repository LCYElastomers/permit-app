namespace PermitControl.Domain;

public sealed class UserNotificationPreference
{
    public Guid UserId { get; set; }
    public string Channel { get; set; } = "";
    public string Topic { get; set; } = "";
    public bool Enabled { get; set; }
    public User? User { get; set; }
}

public sealed record NotificationPreferenceView(string Channel, string Topic, bool Enabled);

public static class NotificationCatalog
{
    public const string InApp = "IN_APP";
    public const string Sms = "SMS";
    public const string Email = "EMAIL";

    public static readonly string[] Channels = [InApp, Sms, Email];
    public static readonly string[] Topics =
    [
        "AUTHORIZATION_REQUESTED",
        "PERMIT_ASSIGNED",
        "PERMIT_SUSPENDED",
        "PERMIT_RETURNED",
        "PERMIT_EXPIRING",
        "REAUTHORIZATION_REQUIRED",
    ];

    public static bool Known(string channel, string topic) =>
        Channels.Contains(channel) && Topics.Contains(topic);
}

public static class ContactRules
{
    public static string? NormalizeEmail(string? raw, out string email)
    {
        email = "";
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var trimmed = raw.Trim();
        var at = trimmed.LastIndexOf('@');
        if (at <= 0 || at >= trimmed.Length - 1) return "email-invalid";
        var local = trimmed[..at];
        var domain = trimmed[(at + 1)..];
        if (local.Any(char.IsWhiteSpace) || domain.Any(char.IsWhiteSpace) || local.Contains('@')) return "email-invalid";
        if (!domain.Contains('.') || domain.StartsWith('.') || domain.EndsWith('.') || domain.Contains("..", StringComparison.Ordinal)) return "email-invalid";
        email = $"{local}@{domain.ToLowerInvariant()}";
        return email.Length > 200 ? "email-invalid" : null;
    }

    public static string? NormalizePhone(string? raw, out string? e164)
    {
        e164 = null;
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var text = raw.Trim();
        var international = text.StartsWith('+');
        var digits = new string(text.Where(char.IsDigit).ToArray());
        if (digits.Length == 0) return "phone-invalid";
        if (!international && digits.Length == 10) digits = "1" + digits;
        else if (!international && digits.Length == 11 && digits[0] == '1') { }
        else if (!international) return "phone-invalid";
        if (digits.Length is < 8 or > 15 || digits[0] == '0') return "phone-invalid";
        e164 = "+" + digits;
        return null;
    }
}

public static class ProfileContactRules
{
    public static string? Apply(
        User user,
        IList<UserNotificationPreference> preferences,
        string? email,
        string? mobile,
        string? alternate,
        IReadOnlyList<(string Channel, string Topic, bool Enabled)> requested,
        out IReadOnlyList<string> changed)
    {
        changed = [];
        var emailError = ContactRules.NormalizeEmail(email, out var nextEmail);
        if (emailError is not null) return emailError;
        var mobileError = ContactRules.NormalizePhone(mobile, out var nextMobile);
        if (mobileError is not null) return mobileError;
        var alternateError = ContactRules.NormalizePhone(alternate, out var nextAlternate);
        if (alternateError is not null) return alternateError;

        foreach (var item in requested)
        {
            if (!NotificationCatalog.Known(item.Channel, item.Topic)) return "preference-invalid";
        }

        if (requested.Any(item => item.Enabled && item.Channel == NotificationCatalog.Sms) && nextMobile is null) return "mobile-required";
        if (requested.Any(item => item.Enabled && item.Channel == NotificationCatalog.Email) && nextEmail.Length == 0) return "email-required";

        var fields = new List<string>();
        if (!string.Equals(user.Email, nextEmail, StringComparison.Ordinal))
        {
            user.Email = nextEmail;
            fields.Add("Email");
        }

        if (!string.Equals(user.MobilePhone, nextMobile, StringComparison.Ordinal))
        {
            user.MobilePhone = nextMobile;
            user.MobileVerifiedAt = null;
            fields.Add("MobilePhone");
        }

        if (!string.Equals(user.AlternatePhone, nextAlternate, StringComparison.Ordinal))
        {
            user.AlternatePhone = nextAlternate;
            fields.Add("AlternatePhone");
        }

        var next = requested
            .GroupBy(item => $"{item.Channel}|{item.Topic}")
            .Select(group => group.Last())
            .OrderBy(item => item.Channel, StringComparer.Ordinal)
            .ThenBy(item => item.Topic, StringComparer.Ordinal)
            .ToArray();
        var current = preferences
            .OrderBy(item => item.Channel, StringComparer.Ordinal)
            .ThenBy(item => item.Topic, StringComparer.Ordinal)
            .Select(item => $"{item.Channel}|{item.Topic}|{item.Enabled}")
            .ToArray();
        var proposed = next.Select(item => $"{item.Channel}|{item.Topic}|{item.Enabled}").ToArray();
        if (!current.SequenceEqual(proposed))
        {
            preferences.Clear();
            foreach (var item in next)
            {
                preferences.Add(new UserNotificationPreference
                {
                    UserId = user.Id,
                    Channel = item.Channel,
                    Topic = item.Topic,
                    Enabled = item.Enabled,
                });
            }
            fields.Add("NotificationPreferences");
        }

        changed = fields;
        return null;
    }
}
