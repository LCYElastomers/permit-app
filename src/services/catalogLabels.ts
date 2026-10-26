/** Presentation names for the field-workflow codes. The stored code is unchanged. */
const LABELS: Record<string, string> = {
  atmospheric: "Atmospheric",
  "stored energy": "Stored Energy",
  "chemical exposure": "Chemical Exposure",
  "fire/hot work": "Fire / Hot Work",
  fall: "Fall",
  engulfment: "Engulfment",
  "excavation/cave-in": "Excavation / Cave-In",
  "underground utilities": "Underground Utilities",
  traffic: "Traffic",
  water: "Water",
  electrical: "Electrical",
  other: "Other",
  JSA: "JSA",
  SOP: "SOP",
  LOTO: "LOTO",
  barricades: "Barricades",
  ventilation: "Ventilation",
  monitoring: "Monitoring",
  "fire watch": "Fire Watch",
  rescue: "Rescue",
  PPE: "PPE",
  "other controls": "Other Controls",
  H2S: "H2S",
  LEL: "LEL",
  O2: "O2",
};

export function catalogLabel(code: string): string {
  return LABELS[code] ?? code;
}
