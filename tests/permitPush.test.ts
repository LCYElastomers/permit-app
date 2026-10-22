import { describe, expect, it, vi } from "vitest";
import type { PlantLink } from "../src/lib/connectivity";
import { syncMayStart } from "../src/lib/connectivity";
import { ApiTransportError } from "../src/lib/api/errors";
import { persistGeneralWorkDraft } from "../src/services/generalWorkDraft";
import {
  pushGeneralWorkCreates,
  readAcknowledgement,
  type PushablePermitCreate,
} from "../src/services/permitPush";
import { SyncCoordinator } from "../src/services/syncCoordinator";
import { emptyDraft } from "../src/workflow";

const item: PushablePermitCreate = {
  outboxId: "66666666-6666-4666-8666-111111111111",
  eventId: "55555555-5555-4555-8555-111111111111",
  occurredAt: "2026-10-22T17:00:00Z",
  permitRevision: 1,
  draft: {
    id: "44444444-4444-4444-8444-111111111111",
    areaId: "0b6d1a22-1111-4a1b-9c1d-111111111111",
    areaName: "Unit 2",
    equipmentTag: "P-210",
    workOrder: "WO-104700",
    jobDescription: "Gauge glass inspection",
    companyType: "Contractor",
    companyName: "Gulf Industrial Services",
    requester: "Elena Voss",
    craft: "Jordan Peck",
    plannedStart: "15:00",
    expiresAt: "19:00",
    workingState: {
      version: 1,
      step: 2,
      hazards: ["slip/trip"],
      controls: ["barricade"],
      fields: { taskType: "Inspection", ppe: "Gloves", excludeOpening: "excluded" },
      names: {},
      signatures: { requester: { name: "Elena Voss", time: "15:10" } },
    },
  },
};

function ack(permitNumber = "PTW-2026-00142") {
  return {
    status: 200,
    body: {
      acknowledgements: [
        {
          eventId: item.eventId,
          permitId: item.draft.id,
          permitNumber,
          permitRevision: 1,
          result: "accepted",
        },
      ],
    },
  };
}

describe("permit synchronization", () => {
  it("starts only when plant link is ready", () => {
    const blocked: PlantLink[] = ["unreachable", "api-online", "checking"];
    for (const link of blocked) expect(syncMayStart(link)).toBe(false);
    expect(syncMayStart("ready")).toBe(true);
    const coordinator = new SyncCoordinator(async () => undefined);
    coordinator.onStoreReady();
    expect(coordinator.onOutboxCreated()).toEqual({ started: false, reason: "plant-link" });
    coordinator.onPlantLink("api-online");
    expect(coordinator.onOutboxCreated()).toEqual({ started: false, reason: "plant-link" });
    coordinator.onPlantLink("ready");
  });

  it("finishes the local save before a network synchronization starts", async () => {
    const order: string[] = [];
    await persistGeneralWorkDraft(emptyDraft(), async () => {
      order.push("saved");
      return {
        id: item.draft.id,
        permitNumber: null,
        permitType: "GENERAL_WORK",
        status: "DRAFT",
        syncState: "PENDING",
        areaId: null,
        areaName: "",
        equipmentTag: "",
        workOrder: "",
        jobDescription: "",
        companyType: "Contractor",
        companyName: "",
        requester: "",
        craft: "",
        plannedStart: null,
        expiresAt: null,
        createdAt: item.occurredAt,
        updatedAt: item.occurredAt,
        currentRevision: 1,
        workingState: item.draft.workingState,
        outboxStatus: "PENDING",
      };
    });
    expect(order).toEqual(["saved"]);
    let release = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const pending = pushGeneralWorkCreates({
      link: () => "ready",
      signal: new AbortController().signal,
      list: async () => {
        await gate;
        order.push("sync");
        return [];
      },
    });
    await Promise.resolve();
    expect(order).toEqual(["saved"]);
    release();
    await pending;
    expect(order).toEqual(["saved", "sync"]);
  });

  it("keeps the outbox pending when the network fails and acknowledges one success", async () => {
    const pending = [item];
    const numbers: string[] = [];
    const stamps: string[] = [];
    const failed = await pushGeneralWorkCreates({
      link: () => "ready",
      signal: new AbortController().signal,
      list: async () => pending,
      send: async () => {
        throw new ApiTransportError("offline");
      },
      defer: async () => {
        stamps.push("backoff");
      },
      acknowledge: async () => {
        numbers.push("should-not");
      },
    });
    expect(failed).toBe("deferred");
    expect(numbers).toEqual([]);
    expect(stamps).toEqual(["backoff"]);
    expect(pending).toHaveLength(1);

    const synced = await pushGeneralWorkCreates({
      link: () => "ready",
      signal: new AbortController().signal,
      list: async () => pending,
      send: async () => ack(),
      acknowledge: async (_row, permitNumber) => {
        numbers.push(permitNumber);
        stamps.push("permit-sync");
        pending.shift();
      },
    });
    expect(synced).toBe("synced");
    expect(numbers).toEqual(["PTW-2026-00142"]);
    expect(stamps).toContain("permit-sync");
  });

  it("treats a duplicate acknowledgement as the same permit number", async () => {
    const numbers: string[] = [];
    const result = await pushGeneralWorkCreates({
      link: () => "ready",
      signal: new AbortController().signal,
      list: async () => [item],
      send: async () => ({
        status: 200,
        body: {
          acknowledgements: [
            {
              eventId: item.eventId,
              permitId: item.draft.id,
              permitNumber: "PTW-2026-00142",
              permitRevision: 1,
              result: "duplicate",
            },
          ],
        },
      }),
      acknowledge: async (_row, permitNumber) => {
        numbers.push(permitNumber);
      },
    });
    expect(result).toBe("synced");
    expect(numbers).toEqual(["PTW-2026-00142"]);
    expect(readAcknowledgement(ack().body, { eventId: item.eventId, permitId: item.draft.id })?.permitNumber).toBe("PTW-2026-00142");
  });

  it("stops without acknowledging when the link drops and marks a conflict for attention", async () => {
    let link: PlantLink = "ready";
    const acks: string[] = [];
    const stopped = await pushGeneralWorkCreates({
      link: () => link,
      signal: new AbortController().signal,
      list: async () => [item],
      send: async () => {
        link = "unreachable";
        throw new ApiTransportError("offline");
      },
      acknowledge: async () => {
        acks.push("ack");
      },
      defer: async () => undefined,
    });
    expect(stopped).toBe("deferred");
    expect(acks).toEqual([]);

    const codes: string[] = [];
    const attention = await pushGeneralWorkCreates({
      link: () => "ready",
      signal: new AbortController().signal,
      list: async () => [item],
      send: async () => ({ status: 409, body: { error: "permit-already-created" } }),
      attention: async (_id, code) => {
        codes.push(code);
      },
    });
    expect(attention).toBe("attention");
    expect(codes).toEqual(["permit-already-created"]);
  });

  it("leaves an unsupported outbox row off the push list", async () => {
    const sent: unknown[] = [];
    const result = await pushGeneralWorkCreates({
      link: () => "ready",
      signal: new AbortController().signal,
      list: async () => [],
      send: async (body) => {
        sent.push(body);
        return ack();
      },
    });
    expect(result).toBe("idle");
    expect(sent).toEqual([]);
  });

  it("does not put the device working-state wrapper or a signature in the push body", async () => {
    const bodies: string[] = [];
    await pushGeneralWorkCreates({
      link: () => "ready",
      signal: new AbortController().signal,
      list: async () => [item],
      send: async (body) => {
        bodies.push(JSON.stringify(body));
        return ack();
      },
      acknowledge: async () => undefined,
    });
    expect(bodies[0]).toContain("GENERAL_WORK");
    expect(bodies[0]).toContain("P-210");
    expect(bodies[0]).not.toContain("workingState");
    expect(bodies[0]).not.toContain("signatures");
    expect(bodies[0]).not.toContain("\"step\"");
  });
});

describe("coordinator gate", () => {
  it("does not run a cycle while plant link is unreachable", async () => {
    const ran = vi.fn();
    const coordinator = new SyncCoordinator(async () => {
      ran();
    });
    coordinator.onStoreReady();
    coordinator.onPlantLink("unreachable");
    coordinator.onOutboxCreated();
    await Promise.resolve();
    expect(ran).not.toHaveBeenCalled();
  });
});
