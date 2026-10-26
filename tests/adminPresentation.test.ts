import { describe, expect, it } from "vitest";
import {
  adminRoleLine,
  configurationChanges,
  displayOrder,
  fieldTypeLabel,
  fieldsInSection,
  moduleTitle,
  permitTypeProfile,
  ruleSentence,
  sectionForOrder,
  suggestFieldCode,
  versionState,
} from "../src/services/adminPresentation";

describe("administration presentation", () => {
  it("uses human field, module, and permit type names", () => {
    expect(fieldTypeLabel("MULTILINE_TEXT")).toBe("Long Text");
    expect(fieldTypeLabel("SINGLE_SELECT")).toBe("Single Choice");
    expect(moduleTitle("HOT_WORK")).toBe("Hot work");
    expect(permitTypeProfile("CONFINED_SPACE").title).toBe("Confined Space Entry");
    expect(permitTypeProfile("OPENING_BLINDING").title).toBe("Opening / Blinding");
  });

  it("places fields in workflow sections by display order", () => {
    const fields = [
      { code: "TASK", displayOrder: 2 },
      { code: "GAS", displayOrder: 140 },
      { code: "SIGN", displayOrder: 510 },
    ];
    expect(sectionForOrder(2).title).toBe("Scope");
    expect(fieldsInSection(fields, "hazards").map((field) => field.code)).toEqual(["GAS"]);
    expect(displayOrder("controls", 4)).toBe(204);
    expect(displayOrder("scope", 120)).toBe(99);
  });

  it("explains versions and the publish diff", () => {
    expect(versionState(0, []).publishedLabel).toBe("No published configuration yet");
    expect(versionState(4, [4, 5]).workingLabel).toBe("5 - DRAFT");
    expect(configurationChanges(
      [
        { permitType: "HOT_WORK", code: "OLD", configurationVersion: 4 },
        { permitType: "HOT_WORK", code: "OLD", configurationVersion: 5 },
        { permitType: "HOT_WORK", code: "NEW", configurationVersion: 5 },
      ],
      [{ configurationVersion: 5 }, { configurationVersion: 4 }],
      4,
    )).toEqual({ added: 1, updated: 1, changedRules: 1, total: 3 });
  });

  it("renders a rule as a sentence and keeps the code out of the sentence", () => {
    const sentence = ruleSentence(
      { conditionCode: "IGNITION", conditionValue: "YES", action: "REQUIRE_MODULE", actionTarget: "HOT_WORK" },
      [{ code: "IGNITION", label: "Ignition-producing work?" }],
    );
    expect(sentence).toBe('When "Ignition-producing work?" is Yes, require the Hot work module.');
    expect(sentence).not.toContain("REQUIRE_MODULE");
    expect(suggestFieldCode("Ignition-producing work?")).toBe("IGNITION_PRODUCING_WORK");
    expect(adminRoleLine({ permitUserCode: "PCU-0001", roles: ["SUPER_ADMIN"] })).toBe("PCU-0001 · Super Admin");
  });
});
