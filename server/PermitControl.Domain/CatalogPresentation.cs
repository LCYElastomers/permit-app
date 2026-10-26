namespace PermitControl.Domain;

/// <summary>
/// Display names for field-workflow codes. Stored catalog codes and already-written labels stay intact.
/// </summary>
public static class CatalogPresentation
{
    private static readonly Dictionary<string, string> Labels = new(StringComparer.Ordinal)
    {
        ["atmospheric"] = "Atmospheric",
        ["stored energy"] = "Stored Energy",
        ["chemical exposure"] = "Chemical Exposure",
        ["fire/hot work"] = "Fire / Hot Work",
        ["fall"] = "Fall",
        ["engulfment"] = "Engulfment",
        ["excavation/cave-in"] = "Excavation / Cave-In",
        ["underground utilities"] = "Underground Utilities",
        ["traffic"] = "Traffic",
        ["water"] = "Water",
        ["electrical"] = "Electrical",
        ["other"] = "Other",
        ["JSA"] = "JSA",
        ["SOP"] = "SOP",
        ["LOTO"] = "LOTO",
        ["barricades"] = "Barricades",
        ["ventilation"] = "Ventilation",
        ["monitoring"] = "Monitoring",
        ["fire watch"] = "Fire Watch",
        ["rescue"] = "Rescue",
        ["PPE"] = "PPE",
        ["ppe"] = "PPE",
        ["other controls"] = "Other Controls",
        ["H2S"] = "H2S",
        ["LEL"] = "LEL",
        ["O2"] = "O2",
    };

    public static string Label(string? value)
    {
        var trimmed = value?.Trim() ?? "";
        return Labels.TryGetValue(trimmed, out var label) ? label : trimmed;
    }
}
