import { describe, expect, it } from "vitest";
import { catalogLabel } from "../src/services/catalogLabels";
import { CONTROLS, HAZARDS } from "../src/workflow";

describe("catalog labels", () => {
  it("uses explicit title case and keeps acronyms", () => {
    expect(catalogLabel("atmospheric")).toBe("Atmospheric");
    expect(catalogLabel("stored energy")).toBe("Stored Energy");
    expect(catalogLabel("chemical exposure")).toBe("Chemical Exposure");
    expect(catalogLabel("fire/hot work")).toBe("Fire / Hot Work");
    expect(catalogLabel("underground utilities")).toBe("Underground Utilities");
    expect(catalogLabel("excavation/cave-in")).toBe("Excavation / Cave-In");
    expect(catalogLabel("JSA")).toBe("JSA");
    expect(catalogLabel("SOP")).toBe("SOP");
    expect(catalogLabel("LOTO")).toBe("LOTO");
    expect(catalogLabel("PPE")).toBe("PPE");
    expect(catalogLabel("H2S")).toBe("H2S");
    expect(catalogLabel("LEL")).toBe("LEL");
    expect(catalogLabel("O2")).toBe("O2");
    expect(catalogLabel("Hard hat")).toBe("Hard hat");
  });

  it("covers every field-workflow hazard and control code", () => {
    expect(HAZARDS.map(catalogLabel)).toEqual([
      "Atmospheric",
      "Stored Energy",
      "Chemical Exposure",
      "Fire / Hot Work",
      "Fall",
      "Engulfment",
      "Excavation / Cave-In",
      "Underground Utilities",
      "Traffic",
      "Water",
      "Electrical",
      "Other",
    ]);
    expect(CONTROLS.map(catalogLabel)).toEqual([
      "JSA",
      "SOP",
      "LOTO",
      "Barricades",
      "Ventilation",
      "Monitoring",
      "Fire Watch",
      "Rescue",
      "PPE",
      "Other Controls",
    ]);
  });
});
