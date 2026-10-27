using System.Text.Json;

namespace PermitControl.Domain;

public static class WithdrawalReasons
{
    public const string ConditionsChanged = "CONDITIONS_CHANGED";
    public const string PermitRequiresCorrection = "PERMIT_REQUIRES_CORRECTION";
    public const string ScopeChanged = "SCOPE_CHANGED";
    public const string EnteredInError = "AUTHORIZATION_ENTERED_IN_ERROR";
    public const string RequiredInformationMissing = "REQUIRED_INFORMATION_MISSING";
    public const string Other = "OTHER";

    private static readonly Dictionary<string, string> Labels = new(StringComparer.Ordinal)
    {
        [ConditionsChanged] = "Conditions Changed",
        [PermitRequiresCorrection] = "Permit Requires Correction",
        [ScopeChanged] = "Scope Changed",
        [EnteredInError] = "Authorization Entered in Error",
        [RequiredInformationMissing] = "Required Information Missing",
        [Other] = "Other",
    };

    public static string? Validate(string? reason, string? comments)
    {
        if (string.IsNullOrWhiteSpace(reason) || !Labels.ContainsKey(reason.Trim())) return "reason-required";
        if (comments is { Length: > 500 }) return "comments-invalid";
        if (string.Equals(reason.Trim(), Other, StringComparison.Ordinal) && string.IsNullOrWhiteSpace(comments)) return "comments-required";
        return null;
    }

    public static string Payload(string reason, string? comments)
    {
        var note = string.IsNullOrWhiteSpace(comments) ? null : comments.Trim();
        return JsonSerializer.Serialize(new Dictionary<string, string?>
        {
            ["reason"] = reason.Trim(),
            ["comments"] = note,
        });
    }

    public static string? Display(PermitEventType type, string? payload)
    {
        if (type != PermitEventType.PERMIT_AUTHORIZATION_WITHDRAWN || string.IsNullOrWhiteSpace(payload)) return null;
        try
        {
            var parsed = JsonSerializer.Deserialize<Dictionary<string, string?>>(payload);
            if (parsed is null || !parsed.TryGetValue("reason", out var reason) || reason is null || !Labels.TryGetValue(reason, out var label)) return null;
            parsed.TryGetValue("comments", out var comments);
            if (reason == Other && !string.IsNullOrWhiteSpace(comments)) return $"{label}: {comments.Trim()}";
            return label;
        }
        catch (JsonException)
        {
            return null;
        }
    }
}
