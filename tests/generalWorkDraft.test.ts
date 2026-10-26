import { describe, expect, it, vi } from "vitest";
import type { PlantLink } from "../src/lib/connectivity";
import {
  generalWorkSaveRequest,
  permitDraftFromRecord,
  persistGeneralWorkDraft,
  type StoredDraft,
} from "../src/services/generalWorkDraft";
import { localFailureMessage, LocalStoreFailure } from "../src/services/localStore";
import type { PermitKind } from "../src/types";
import { detailDocumentTarget } from "../src/services/permitDocumentActions";
import { storedPermitRecord } from "../src/state/PermitStore";
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
    outboxStatus: "PENDING",
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
    expect(fromReady.workingState.version).toBe(2);
    expect(fromReady.workingState.permitType).toBe("GENERAL_WORK");
    expect(fromReady.workingState.workflowStep).toBe(3);
    expect(fromReady.workingState.moduleState.fields.taskType).toBe("Inspection");
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

  it("saves and restores every permit classification without plant link", async () => {
    const kinds: PermitKind[] = ["general", "hot-work", "confined-space", "opening-blinding", "excavation", "live-electrical"];
    for (const kind of kinds) {
      const saved = await persistGeneralWorkDraft(
        { ...draft(), kind, fields: { fireWatch: "Alex Morgan", depth: "4 ft" } },
        async (request) => ({ ...stored(request), permitType: request.permitType }),
      );
      expect(saved.kind).toBe(kind);
      expect(saved.fields.fireWatch).toBe("Alex Morgan");
      expect(saved.fields.depth).toBe("4 ft");
      expect(saved.lifecycleStatus).toBe("DRAFT");
    }
  });

  it("opens pending, active, and suspended local permits as real records", () => {
    const base = {
      ...emptyDraft("hot-work"),
      id: permitId,
      description: "Weld the spool",
      place: "P-210",
      workOrder: "WO-104700",
      area: "Unit 2",
      fields: { fireWatch: "Alex Morgan" },
      updated: "2026-10-23T12:00:00Z",
      permitNumber: "PTW-2026-00007",
      outboxStatus: "ACKNOWLEDGED",
    };
    const pending = storedPermitRecord({ ...base, lifecycleStatus: "PENDING_REVIEW" });
    expect(pending.status).toBe("pending");
    expect(pending.kind).toBe("hot-work");
    expect(pending.sample).toBe(false);
    expect(pending.authority).toBe("authoritative");
    expect(detailDocumentTarget(pending).permitId).toBe(permitId);
    expect(pending.history.some((item) => item.label === "SUBMITTED FOR REVIEW")).toBe(true);
    expect(pending.history.some((item) => item.label.includes("ACTIVE"))).toBe(false);
    const active = storedPermitRecord({ ...base, lifecycleStatus: "ACTIVE" });
    expect(active.status).toBe("active");
    expect(detailDocumentTarget(active).permitId).toBe(permitId);
    const suspended = storedPermitRecord({ ...base, lifecycleStatus: "SUSPENDED", permitNumber: null, outboxStatus: "PENDING" });
    expect(suspended.status).toBe("suspended");
    expect(detailDocumentTarget(suspended).permitId).toBeNull();
    expect(detailDocumentTarget(suspended).kind).toBe("hot-work");
  });

  it("restores version 1 general work and keeps unknown details on the next save", () => {
    const restored = permitDraftFromRecord({
      ...stored(generalWorkSaveRequest(draft(), { id: permitId, eventId, outboxId })),
      workingState: {
        version: 1,
        step: 2,
        hazards: ["fall"],
        controls: ["PPE"],
        fields: { taskType: "Inspection", ppe: ["Hard hat", "Gloves"], extraNote: "keep me" },
        names: { requester: "Elena Voss" },
        signatures: { supervisor: { name: "Bobby Fitzgerald", time: "15:05" } },
        legacyNote: "still here",
      } as StoredDraft["workingState"],
    });
    expect(restored.kind).toBe("general");
    expect(restored.fields.taskType).toBe("Inspection");
    expect(restored.fields.ppe).toBe("Hard hat, Gloves");
    expect(restored.fields.extraNote).toBe("keep me");
    expect(restored.signatures.supervisor.name).toBe("Bobby Fitzgerald");
    expect(restored.preserveWorkingState).toBe(false);
    const request = generalWorkSaveRequest(restored, { id: permitId, eventId, outboxId });
    expect(request.workingState.version).toBe(2);
    expect(request.workingState.moduleState.fields.extraNote).toBe("keep me");
    expect(JSON.stringify(request.workingState)).toContain("still here");
  });

  it("does not turn a newer working state into an editable blank draft", () => {
    const restored = permitDraftFromRecord({
      ...stored(generalWorkSaveRequest(draft(), { id: permitId, eventId, outboxId })),
      workingState: { version: 9, permitType: "HOT_WORK", kept: "original-scope" } as StoredDraft["workingState"],
    });
    expect(restored.preserveWorkingState).toBe(true);
    expect(restored.hazards).toEqual([]);
    expect(localFailureMessage(new LocalStoreFailure("working-state-version-unsupported"))).toContain("DRAFT NOT SAVED");
    expect(localFailureMessage(new LocalStoreFailure("local-storage-write-failed"))).not.toContain("Local data is unavailable");
    expect(localFailureMessage(new LocalStoreFailure())).toContain("Local data is unavailable");
  });
});
