import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AREA_PICKER_EMPTY, areaPickerMessage, areaSelection, presentAreaCatalog } from "../src/services/areas";
import { pickerIsMounted, visiblePickerOptions } from "../src/services/picker";
import { emptyDraft, canSubmitForReview, preparationGaps, preparationSections } from "../src/workflow";

describe("area picker", () => {
  it("keeps the area id and uses the name only as the label", () => {
    const id = "0b6d1a22-1111-4a1b-9c1d-111111111111";
    expect(areaSelection([{ id, name: "Unit 2" }], id)).toEqual({ areaId: id, area: "Unit 2" });
    expect(areaSelection([{ id, name: "Unit 2" }], "missing")).toEqual({ areaId: "", area: "" });
  });

  it("makes the whole visible field the trigger and removes the sheet when it closes", () => {
    const source = readFileSync("src/components/ui.tsx", "utf8");
    const picker = source.slice(source.indexOf("export function TouchSelect"), source.indexOf("export function Kv"));
    const css = readFileSync("src/index.css", "utf8");
    const permit = readFileSync("src/screens/NewPermit.tsx", "utf8");
    expect(picker).not.toContain("<select");
    expect(picker).not.toContain("pointerType");
    expect(picker).not.toContain("onPointerDown");
    expect(picker).not.toContain("onTouchStart");
    expect(picker).not.toContain("onMouseDown");
    expect(picker.match(/type="button"/g)?.length).toBeGreaterThan(1);
    expect(picker).toContain("picker-trigger");
    expect(picker).toContain('aria-haspopup="listbox"');
    expect(picker).toContain("aria-expanded={open}");
    expect(picker).toContain("createPortal(sheet, document.body)");
    expect(picker).toContain("open && typeof document");
    expect(picker).toContain("Escape");
    expect(picker).toContain("triggerRef.current?.focus()");
    expect(css).not.toContain("pointer-events: none");
    expect(css).toContain(".picker-trigger.is-coarse { min-height: 52px;");
    expect(css).toContain("touch-action: none");
    expect(css).not.toMatch(/\.picker-sheet \{ display: none/);
    expect(permit).toContain('label="Area"');
    expect(permit).toContain("searchable={false}");
    expect(permit).not.toContain("disabled={catalog.status");
    expect(permit).toContain("onChange={(id) => patch(areaSelection(areas, id))}");
  });

  it("keeps cached area ids available while Plant Link is offline", () => {
    const id = "0b6d1a22-1111-4a1b-9c1d-111111111111";
    const cached = [{ id, name: "Tank Farm" }];
    expect(presentAreaCatalog("available", cached, "2026-10-26T15:00:00Z")).toEqual({ status: "ready", areas: cached });
    expect(areaPickerMessage({ status: "ready", areas: cached })).toBe(AREA_PICKER_EMPTY);
    expect(areaPickerMessage({ status: "unsynchronized" })).toBe(AREA_PICKER_EMPTY);
    expect(visiblePickerOptions([{ id, label: "Tank Farm" }, { id: "other", label: "Unit 2" }], "")).toEqual([
      { id, label: "Tank Farm" },
      { id: "other", label: "Unit 2" },
    ]);
    expect(pickerIsMounted(false)).toBe(false);
    expect(pickerIsMounted(true)).toBe(true);
    const draft = { ...emptyDraft(), areaId: id, area: "Tank Farm", step: 0 };
    expect({ ...draft, step: draft.step + 1 }).toMatchObject({ areaId: id, area: "Tank Farm" });
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
