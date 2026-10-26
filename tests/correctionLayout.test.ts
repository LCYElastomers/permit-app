import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("return for correction layout", () => {
  it("opens a dialog and does not place the confirmation in the permit detail header", () => {
    const panel = readFileSync(new URL("../src/components/AuthorizationPanel.tsx", import.meta.url), "utf8");
    const detail = readFileSync(new URL("../src/screens/PermitDetail.tsx", import.meta.url), "utf8");
    expect(panel).toContain("AdminEditorModal");
    expect(panel).toContain("Return permit for correction");
    expect(panel).toContain("This Permit has already been authorized.");
    expect(panel).toContain("openCorrection(updated, shown.focusStep)");
    expect(panel).not.toContain('className="confirm"');
    expect(detail).toContain("<AuthorizationPanel");
    expect(detail).not.toContain("Return for correction");
  });
});
