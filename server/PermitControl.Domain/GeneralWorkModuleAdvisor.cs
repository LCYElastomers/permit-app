namespace PermitControl.Domain;

public sealed record ScopeSignal(
    bool ProcessOpening,
    bool ContainmentBreak,
    bool ConfinedSpaceEntry,
    bool EnergyIsolation,
    bool HotWork);

public sealed record ModuleRecommendation(PermitType PermitType, string Reason);

/// <summary>
/// Recommendation only. This does not block a permit and is not a safety policy.
/// </summary>
public interface IPermitModuleAdvisor
{
    IReadOnlyList<ModuleRecommendation> Recommend(PermitType selected, ScopeSignal scope);
}

public sealed class GeneralWorkModuleAdvisor : IPermitModuleAdvisor
{
    public IReadOnlyList<ModuleRecommendation> Recommend(PermitType selected, ScopeSignal scope)
    {
        if (selected != PermitType.GENERAL_WORK)
        {
            return [];
        }

        var recommendations = new List<ModuleRecommendation>();
        if (scope.ProcessOpening || scope.ContainmentBreak || scope.EnergyIsolation)
        {
            recommendations.Add(new ModuleRecommendation(
                PermitType.OPENING_BLINDING,
                "Scope includes opening, containment break, or energy isolation."));
        }

        if (scope.ConfinedSpaceEntry)
        {
            recommendations.Add(new ModuleRecommendation(
                PermitType.CONFINED_SPACE,
                "Scope includes confined-space entry."));
        }

        if (scope.HotWork)
        {
            recommendations.Add(new ModuleRecommendation(
                PermitType.HOT_WORK,
                "Scope includes hot work."));
        }

        return recommendations;
    }
}
