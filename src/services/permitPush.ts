import { ApiError, ApiTransportError, permitApiBaseUrl } from "../lib/api/client";
import { API_TIMEOUT_MS } from "../lib/api/config";
import { syncMayStart, type PlantLink } from "../lib/connectivity";
import { restoredModuleState, type GeneralWorkWorkingState, type PermitWorkingState } from "./generalWorkDraft";
import { invokeCommand, notifyLocalStoreChanged } from "./localStore";

export interface PushableDraft {
  id: string;
  areaId: string | null;
  areaName: string;
  equipmentTag: string;
  workOrder: string;
  jobDescription: string;
  companyType: string;
  companyName: string;
  requester: string;
  craft: string;
  plannedStart: string | null;
  expiresAt: string | null;
  permitType?: string;
  workingState: GeneralWorkWorkingState | PermitWorkingState;
}

export interface PushablePermitCreate {
  outboxId: string;
  eventId: string;
  occurredAt: string;
  permitRevision: number;
  draft: PushableDraft;
}

export type PushStep = "idle" | "synced" | "deferred" | "attention" | "stopped" | "storage-failed";

const PERMIT_NUMBER = /^PTW-\d{4}-\d{5,}$/;
const ERROR_CODE = /^[a-z0-9-]{1,40}$/;

const FIELD_MODULES: Record<string, string> = {
  heightControls: "WORKING_AT_HEIGHT",
  loto: "LOTO_ISOLATION",
  lockBox: "LOTO_ISOLATION",
  energyIsolation: "LOTO_ISOLATION",
  zeroEnergy: "LOTO_ISOLATION",
  blinds: "LOTO_ISOLATION",
  initialTest: "ATMOSPHERIC_MONITORING",
  retests: "ATMOSPHERIC_MONITORING",
  atmospheric: "ATMOSPHERIC_MONITORING",
  continuous: "ATMOSPHERIC_MONITORING",
  hotWorkEquipment: "HOT_WORK",
  areaPrep: "HOT_WORK",
  combustibleClearance: "HOT_WORK",
  ignitionControls: "HOT_WORK",
  extinguishing: "HOT_WORK",
  fireWatch: "FIRE_WATCH",
  postFireWatch: "FIRE_WATCH",
  vesselId: "CONFINED_SPACE",
  entrant: "CONFINED_SPACE",
  attendant: "CONFINED_SPACE",
  rescue: "RESCUE",
  hotWorkInside: "HOT_WORK",
  depth: "EXCAVATION",
  digLocation: "EXCAVATION",
  competentPerson: "EXCAVATION",
  soil: "EXCAVATION",
  previousService: "OPENING_BLINDING",
  blinded: "OPENING_BLINDING",
  voltage: "LIVE_ELECTRICAL",
  ppe: "PPE",
};

export function generalWorkPushBody(item: PushablePermitCreate) {
  const restored = restoredModuleState(item.draft.workingState);
  const fields = restored.fields ?? {};
  const permitType = item.draft.permitType ?? (item.draft.workingState.version === 2 ? item.draft.workingState.permitType : "GENERAL_WORK");
  const exclusions: Record<string, string> = {};
  for (const key of ["excludeOpening", "excludeContainment", "excludeEntry", "excludeIsolation", "excludeHotWork"]) {
    if (fields[key]) exclusions[key] = fields[key];
  }
  const ppe = fields.ppe?.trim() ? [fields.ppe.trim()] : [];
  return {
    events: [
      {
        id: item.eventId,
        permitId: item.draft.id,
        permitRevision: item.permitRevision,
        eventType: "PERMIT_CREATED",
        occurredAt: item.occurredAt,
        userId: null,
        deviceId: null,
        permit: {
          permitType,
          areaId: item.draft.areaId,
          areaName: item.draft.areaName,
          equipmentTag: item.draft.equipmentTag,
          workOrder: item.draft.workOrder,
          jobDescription: item.draft.jobDescription,
          companyType: item.draft.companyType === "LCY" ? "LCY" : "CONTRACTOR",
          companyName: item.draft.companyName,
          requester: item.draft.requester,
          craft: item.draft.craft,
          plannedStartClock: item.draft.plannedStart,
          plannedExpirationClock: item.draft.expiresAt,
          hazards: restored.hazards,
          controls: restored.controls,
          ppe,
          taskType: fields.taskType ?? "",
          equipmentSystem: fields.equipmentSystem ?? "",
          serviceProcess: fields.serviceProcess ?? "",
          materialInService: fields.materialInService ?? "",
          coordination: fields.coordination ?? "",
          heightControls: fields.heightControls ?? "",
          exclusions,
          moduleFacts: Object.entries(fields)
            .filter(([, value]) => value.trim().length > 0)
            .map(([name, value]) => ({ module: FIELD_MODULES[name] ?? "CORE", name, value })),
        },
      },
    ],
  };
}

export function readAcknowledgement(
  body: unknown,
  expected: { eventId: string; permitId: string },
): { permitNumber: string; result: "accepted" | "duplicate" } | null {
  if (!body || typeof body !== "object" || !("acknowledgements" in body)) return null;
  const rows = (body as { acknowledgements: unknown }).acknowledgements;
  if (!Array.isArray(rows) || rows.length !== 1) return null;
  const row = rows[0];
  if (!row || typeof row !== "object") return null;
  const ack = row as { eventId?: unknown; permitId?: unknown; permitNumber?: unknown; result?: unknown };
  if (ack.eventId !== expected.eventId || ack.permitId !== expected.permitId) return null;
  if (ack.result !== "accepted" && ack.result !== "duplicate") return null;
  if (typeof ack.permitNumber !== "string" || !PERMIT_NUMBER.test(ack.permitNumber)) return null;
  return { permitNumber: ack.permitNumber, result: ack.result };
}

export function rejectionCode(body: unknown): string {
  if (!body || typeof body !== "object" || !("error" in body)) return "rejected";
  const value = (body as { error: unknown }).error;
  return typeof value === "string" && ERROR_CODE.test(value) ? value : "rejected";
}

export async function pushGeneralWorkCreates(input: {
  link: () => PlantLink;
  signal: AbortSignal;
  list?: () => Promise<PushablePermitCreate[]>;
  send?: (body: unknown, signal: AbortSignal) => Promise<{ status: number; body: unknown }>;
  acknowledge?: (item: PushablePermitCreate, permitNumber: string) => Promise<void>;
  attention?: (outboxId: string, code: string) => Promise<void>;
  defer?: (outboxId: string) => Promise<void>;
}): Promise<PushStep> {
  if (!syncMayStart(input.link()) || input.signal.aborted) return "stopped";
  const list = input.list ?? listPushablePermitCreates;
  const send = input.send ?? postPermitPush;
  const acknowledge = input.acknowledge ?? acknowledgePermitCreated;
  const attention = input.attention ?? markOutboxAttention;
  const defer = input.defer ?? notePushDeferred;
  let items: PushablePermitCreate[];
  try {
    items = await list();
  } catch {
    return "storage-failed";
  }
  if (items.length === 0) return "idle";
  let synced = false;
  let needsAttention = false;
  for (const item of items) {
    if (!syncMayStart(input.link()) || input.signal.aborted) return synced ? "synced" : "stopped";
    let response: { status: number; body: unknown };
    try {
      response = await send(generalWorkPushBody(item), input.signal);
    } catch (error) {
      if (input.signal.aborted) return synced ? "synced" : "stopped";
      if (isTransient(error)) {
        try {
          await defer(item.outboxId);
        } catch {
          return "storage-failed";
        }
        return "deferred";
      }
      return "storage-failed";
    }
    if (response.status === 400 || response.status === 409) {
      try {
        await attention(item.outboxId, rejectionCode(response.body));
      } catch {
        return "storage-failed";
      }
      needsAttention = true;
      continue;
    }
    if (response.status === 502 || response.status === 503 || response.status === 504) {
      try {
        await defer(item.outboxId);
      } catch {
        return "storage-failed";
      }
      return "deferred";
    }
    const ack = response.status === 200 ? readAcknowledgement(response.body, { eventId: item.eventId, permitId: item.draft.id }) : null;
    if (!ack) {
      try {
        await defer(item.outboxId);
      } catch {
        return "storage-failed";
      }
      return "deferred";
    }
    try {
      await acknowledge(item, ack.permitNumber);
      synced = true;
    } catch {
      return "storage-failed";
    }
  }
  if (synced) return "synced";
  if (needsAttention) return "attention";
  return "idle";
}

function isTransient(error: unknown): boolean {
  return error instanceof ApiTransportError || (error instanceof ApiError && [502, 503, 504].includes(error.status));
}

async function listPushablePermitCreates(): Promise<PushablePermitCreate[]> {
  return invokeCommand<PushablePermitCreate[]>("list_pushable_permit_creates");
}

async function postPermitPush(body: unknown, signal: AbortSignal): Promise<{ status: number; body: unknown }> {
  const timeout = AbortSignal.timeout(API_TIMEOUT_MS);
  const combined = AbortSignal.any([signal, timeout]);
  let response: Response;
  try {
    response = await fetch(`${permitApiBaseUrl}/api/v1/sync/push`, {
      method: "POST",
      body: JSON.stringify(body),
      signal: combined,
      headers: { Accept: "application/json", "Content-Type": "application/json" },
    });
  } catch (error) {
    if (signal.aborted) throw error;
    if (error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new ApiTransportError("timeout");
    }
    throw new ApiTransportError("offline");
  }
  const payload = await response.json().catch(() => ({}));
  if (response.ok || response.status === 400 || response.status === 409 || response.status === 502 || response.status === 503 || response.status === 504) {
    return { status: response.status, body: payload };
  }
  throw new ApiError(response.status);
}

async function acknowledgePermitCreated(item: PushablePermitCreate, permitNumber: string): Promise<void> {
  await invokeCommand("acknowledge_permit_created", {
    outboxId: item.outboxId,
    eventId: item.eventId,
    permitId: item.draft.id,
    permitNumber,
  });
  notifyLocalStoreChanged();
}

async function markOutboxAttention(outboxId: string, errorCode: string): Promise<void> {
  await invokeCommand("mark_outbox_attention", { outboxId, errorCode });
  notifyLocalStoreChanged();
}

async function notePushDeferred(outboxId: string): Promise<void> {
  await invokeCommand("note_push_deferred", { outboxId });
  notifyLocalStoreChanged();
}
