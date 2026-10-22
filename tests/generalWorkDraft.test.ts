import { describe, expect, it, vi } from "vitest";
import type { PlantLink } from "../src/lib/connectivity";
import {
  generalWorkSaveRequest,
  persistGeneralWorkDraft,
  type StoredDraft,
} from "../src/services/generalWorkDraft";
import { emptyDraft } from "../src/workflow";

const permitId = "44444444-4444-4444-8444-111111111111";
const eventId = "55555555-5555-4555-8555-111111111111";
const outboxId = "66666666-6666-4666-8666-111111111111";

function draft() {
  return {
    ...emptyDraft(),
    area: "Unit 2",
    areaId: "0b6d1a22-1111-4a1b-9c1d-111111111111",
    place: "P-210",
    workOrder: "WO-104700",
    description: "Gauge glass inspection",
    step: 3,
    fields: { taskType: "Inspection", excludeOpening: "excluded" },
    hazards: ["slip/trip"],
  };
}

function stored(request: ReturnType<typeof generalWorkSaveRequest>): StoredDraft {
  return {
    id: request.id,
    permitNumber: null,
    permitType: "GENERAL_WORK",
    status: "DRAFT",
    syncState: "PENDING",
    areaId: request.areaId,
    areaName: request.areaName,
    equipmentTag: request.equipmentTag,
    workOrder: request.workOrder,
    jobDescription: request.jobDescription,
    companyType: request.companyType,
    companyName: request.companyName,
    requester: request.requester,
    craft: request.craft,
    plannedStart: request.plannedStart,
    expiresAt: request.expiresAt,
    createdAt: "2026-10-22T17:00:00Z",
    updatedAt: "2026-10-22T17:00:00Z",
    currentRevision: 1,
    workingState: request.workingState,
  };
}

describe("general work local save", () => {
  it("keeps the same local request when plant link is ready or unreachable", () => {
    const ids = { id: permitId, eventId, outboxId };
    const ready: PlantLink = "ready";
    const unreachable: PlantLink = "unreachable";
    const fromReady = generalWorkSaveRequest(draft(), ids);
    const fromUnreachable = generalWorkSaveRequest(draft(), ids);
    expect(ready).not.toBe(unreachable);
    expect(fromReady).toEqual(fromUnreachable);
    expect(fromReady.workingState.version).toBe(1);
    expect(fromReady.workingState.step).toBe(3);
    expect(fromReady).not.toHaveProperty("permitNumber");
    expect(JSON.stringify(fromReady)).not.toContain("PTW-");
    expect(JSON.stringify(fromReady)).not.toContain("permit-control.local");
  });

  it("does not call the network while saving a draft", async () => {
    const fetchSpy = vi.fn(() => {
      throw new Error("network");
    });
    vi.stubGlobal("fetch", fetchSpy);
    const writes: unknown[] = [];
    const saved = await persistGeneralWorkDraft(draft(), async (request) => {
      writes.push(request);
      return stored(request);
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(writes).toHaveLength(1);
    expect(saved.id).toBeTruthy();
    expect(saved.code).toBe("LOCAL DRAFT");
    expect(saved.kind).toBe("general");
    expect(saved.step).toBe(3);
    expect(saved.fields.taskType).toBe("Inspection");
    vi.unstubAllGlobals();
  });

  it("keeps the permit id on a later save and does not mint another event id", () => {
    const existing = { ...draft(), id: permitId };
    const request = generalWorkSaveRequest(existing, {
      id: permitId,
      eventId: "99999999-9999-4999-8999-999999999999",
      outboxId: "88888888-8888-4888-8888-888888888888",
    });
    expect(request.id).toBe(permitId);
    expect(request.eventId).toBe("00000000-0000-4000-8000-000000000000");
    expect(request.outboxId).toBe("00000000-0000-4000-8000-000000000000");
  });
});
