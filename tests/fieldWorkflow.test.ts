import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { areaSelection } from "../src/services/areas";
import { emptyDraft, canSubmitForReview, preparationGaps, preparationSections } from "../src/workflow";

describe("area picker", () => {
  it("keeps the area id and uses the name only as the label", () => {
    const id = "0b6d1a22-1111-4a1b-9c1d-111111111111";
    expect(areaSelection([{ id, name: "Unit 2" }], id)).toEqual({ areaId: id, area: "Unit 2" });
    expect(areaSelection([{ id, name: "Unit 2" }], "missing")).toEqual({ areaId: "", area: "" });
  });

  it("makes the visible picker a button on every layout, including desktop", () => {
    const source = readFileSync("src/components/ui.tsx", "utf8");
    const picker = source.slice(source.indexOf("export function TouchSelect"), source.indexOf("export function Kv"));
    const css = readFileSync("src/index.css", "utf8");
    expect(picker).not.toContain("<select");
    expect(picker).toContain('type="button"');
    expect(picker).toContain("picker-trigger");
    expect(picker).toContain('aria-haspopup="listbox"');
    expect(picker).toContain("Escape");
    expect(picker).toContain("any-pointer: coarse");
    expect(css).toContain("pointer-events: none");
    expect(css).toContain(".picker-trigger.is-coarse { min-height: 52px;");
    expect(css).toContain(".picker-sheet");
    expect(css).toContain("display: flex;");
  });
});

describe("offline submit for review", () => {
  it("allows a complete permit and blocks an incomplete one without asking about Plant Link", () => {
    const incomplete = emptyDraft();
    expect(canSubmitForReview(incomplete)).toBe(false);
    expect(preparationGaps(incomplete)).toContain("Area");
    expect(preparationSections(incomplete).find((section) => section.label === "Scope")?.complete).toBe(false);

    const ready = {
      ...emptyDraft(),
      area: "Unit 2",
      place: "P-210",
      description: "Weld the spool",
      workOrder: "WO-1",
      company: "LCY",
      requester: "Elena Voss",
      craft: "Jordan Peck",
      plannedStart: "15:00",
      plannedEnd: "19:00",
      hazards: ["heat"],
      controls: ["PPE"],
      fields: { ppe: "Hard hat" },
    };
    expect(canSubmitForReview(ready)).toBe(true);
    expect(preparationGaps(ready)).toEqual([]);
    expect(preparationSections(ready).every((section) => section.complete)).toBe(true);
    expect(canSubmitForReview({ ...ready, lifecycleStatus: "PENDING_REVIEW" })).toBe(false);

    const screen = readFileSync("src/screens/NewPermit.tsx", "utf8");
    expect(screen).toContain("disabled={!canSubmitForReview(form) || saving}");
    expect(screen).not.toMatch(/disabled=\{[^}\n]*link/);
  });
});
