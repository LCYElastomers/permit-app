namespace PermitControl.Domain;

/// <summary>
/// Preparation that must be present before a permit revision can be authorized.
/// PPE is required because every current permit type marks the PPE module required.
/// </summary>
public static class PermitPreparation
{
    public static bool RequiresPpe(PermitType type) =>
        PermitModuleComposition.For(type).Any(item => item.Required && item.Kind == PermitModuleKind.PPE);

    public static IReadOnlyList<string> Blocking(PermitType type, string? jobDescription, string? workOrder, int hazardCount, int ppeCount)
    {
        var gaps = new List<string>();
        if (string.IsNullOrWhiteSpace(jobDescription)) gaps.Add("Scope");
        if (string.IsNullOrWhiteSpace(workOrder)) gaps.Add("Work order");
        if (hazardCount < 1) gaps.Add("Hazards");
        if (RequiresPpe(type) && ppeCount < 1) gaps.Add("PPE");
        return gaps;
    }

    public static IReadOnlyList<string> RequiredModules(PermitType type) =>
        PermitModuleComposition.For(type).Where(item => item.Required).Select(item => item.Kind.ToString()).ToArray();
}
