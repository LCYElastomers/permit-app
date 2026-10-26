import type { PermitDraft } from "../types";
import { invokeCommand, notifyLocalStoreChanged } from "./localStore";

export const WORKING_STATE_VERSION = 2;

const SERVER_TYPES = {
  general: "GENERAL_WORK",
  "hot-work": "HOT_WORK",
  "confined-space": "CONFINED_SPACE",
  "opening-blinding": "OPENING_BLINDING",
  excavation: "EXCAVATION",
  "live-electrical": "LIVE_ELECTRICAL",
} as const;

const KIND_FROM_SERVER: Record<string, PermitDraft["kind"]> = {
  GENERAL_WORK: "general",
  HOT_WORK: "hot-work",
  CONFINED_SPACE: "confined-space",
  OPENING_BLINDING: "opening-blinding",
  EXCAVATION: "excavation",
  LIVE_ELECTRICAL: "live-electrical",
};

export function serverPermitType(kind: PermitDraft["kind"]): string {
  return SERVER_TYPES[kind];
}

export function kindFromServerPermitType(permitType: string): PermitDraft["kind"] {
  return KIND_FROM_SERVER[permitType] ?? "general";
}

export interface GeneralWorkWorkingState {
  version: 1;
  step: number;
  hazards: string[];
  controls: string[];
  fields: Record<string, string>;
  names: Record<string, string>;
  signatures: Record<string, { name: string; time: string }>;
}

export interface PermitWorkingState {
  version: 2;
  permitType: string;
  workflowStep: number;
  moduleState: {
    hazards: string[];
    controls: string[];
    fields: Record<string, string>;
    names: Record<string, string>;
    signatures: Record<string, { name: string; time: string }>;
  };
}

export interface GeneralWorkSaveRequest {
  id: string;
  eventId: string;
  outboxId: string;
  areaId: string | null;
  areaName: string;
  equipmentTag: string;
  workOrder: string;
  jobDescription: string;
  companyType: "LCY" | "Contractor";
  companyName: string;
  requester: string;
  craft: string;
  permitType: string;
  plannedStart: string | null;
  expiresAt: string | null;
  workingState: PermitWorkingState;
  permitNumber?: string | null;
  currentRevision?: number;
}

export interface StoredDraft {
  id: string;
  permitNumber: string | null;
  permitType: string;
  status: string;
  syncState: string;
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
  createdAt: string;
  updatedAt: string;
  currentRevision: number;
  workingState: PermitWorkingState | GeneralWorkWorkingState;
  outboxStatus: string;
}

export type DraftWriter = (request: GeneralWorkSaveRequest) => Promise<StoredDraft>;

const EMPTY_EVENT = "00000000-0000-4000-8000-000000000000";

function text(value: string | null | undefined): string {
  return (value ?? "").trim();
}

export function generalWorkSaveRequest(
  draft: PermitDraft,
  ids: { id: string; eventId: string; outboxId: string },
): GeneralWorkSaveRequest {
  return {
    id: ids.id,
    eventId: ids.eventId,
    outboxId: ids.outboxId,
    areaId: text(draft.areaId) ? text(draft.areaId) : null,
    areaName: draft.area ?? "",
    equipmentTag: draft.place ?? "",
    workOrder: draft.workOrder ?? "",
    jobDescription: draft.description ?? "",
    companyType: draft.companyType,
    companyName: draft.company ?? "",
    requester: draft.requester ?? "",
    craft: draft.craft ?? "",
    permitType: serverPermitType(draft.kind),
    plannedStart: text(draft.plannedStart) ? text(draft.plannedStart) : null,
    expiresAt: text(draft.plannedEnd) ? text(draft.plannedEnd) : null,
    workingState: preservedWorkingState(draft),
  };
}

export function correctionSaveRequest(
  draft: PermitDraft,
  ids: { eventId: string; outboxId: string },
): GeneralWorkSaveRequest & { permitNumber: string | null; currentRevision: number } {
  return {
    ...generalWorkSaveRequest(draft, { id: draft.id, eventId: ids.eventId, outboxId: ids.outboxId }),
    permitNumber: draft.permitNumber,
    currentRevision: draft.currentRevision && draft.currentRevision > 0 ? draft.currentRevision : 1,
  };
}

function preservedWorkingState(draft: PermitDraft): PermitWorkingState {
  const next: PermitWorkingState = {
    version: 2,
    permitType: serverPermitType(draft.kind),
    workflowStep: draft.step,
    moduleState: {
      hazards: draft.hazards,
      controls: draft.controls,
      fields: draft.fields,
      names: draft.names,
      signatures: draft.signatures,
    },
  };
  const original = draft.sourceWorkingState;
  if (!original || original.version === 2) {
    const prior = original?.version === 2 ? original : undefined;
    const priorModule = prior && typeof prior.moduleState === "object" && prior.moduleState ? prior.moduleState as PermitWorkingState["moduleState"] : undefined;
    return {
      ...(prior ?? {}),
      ...next,
      moduleState: {
        ...(priorModule ?? {}),
        hazards: next.moduleState.hazards,
        controls: next.moduleState.controls,
        fields: { ...stringRecord(priorModule?.fields), ...next.moduleState.fields },
        names: { ...stringRecord(priorModule?.names), ...next.moduleState.names },
        signatures: { ...signatureRecord(priorModule?.signatures), ...next.moduleState.signatures },
      },
    };
  }
  if (original.version === 1) {
    const { version: _version, step: _step, hazards: _hazards, controls: _controls, fields, names, signatures, ...rest } = original;
    return {
      ...rest,
      ...next,
      moduleState: {
        ...next.moduleState,
        fields: { ...stringRecord(fields), ...next.moduleState.fields },
        names: { ...stringRecord(names), ...next.moduleState.names },
        signatures: { ...signatureRecord(signatures), ...next.moduleState.signatures },
      },
    };
  }
  return next;
}

function stringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const record: Record<string, string> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (typeof item === "string") record[key] = item;
    else if (typeof item === "number" || typeof item === "boolean") record[key] = String(item);
    else if (Array.isArray(item)) record[key] = item.filter((entry) => typeof entry === "string").join(", ");
    else if (item && typeof item === "object") {
      const labeled = item as { id?: unknown; label?: unknown };
      if (typeof labeled.label === "string") record[key] = labeled.label;
      else if (typeof labeled.id === "string") record[key] = labeled.id;
    }
  }
  return record;
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === "string" && item.trim()) return [item];
    if (typeof item === "number" || typeof item === "boolean") return [String(item)];
    if (item && typeof item === "object") {
      const labeled = item as { id?: unknown; label?: unknown };
      if (typeof labeled.id === "string") return [labeled.id];
      if (typeof labeled.label === "string") return [labeled.label];
    }
    return [];
  });
}

function signatureRecord(value: unknown): Record<string, { name: string; time: string }> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const record: Record<string, { name: string; time: string }> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (!item || typeof item !== "object") continue;
    const signature = item as { name?: unknown; time?: unknown };
    if (typeof signature.name !== "string") continue;
    record[key] = { name: signature.name, time: typeof signature.time === "string" ? signature.time : "" };
  }
  return record;
}

export function workingStatePreserved(state: { version?: unknown; permitType?: unknown } | null | undefined): boolean {
  if (state?.version === 1) return false;
  return !(
    state?.version === 2
    && typeof state.permitType === "string"
    && state.permitType in KIND_FROM_SERVER
  );
}

export function restoredModuleState(state: StoredDraft["workingState"]): {
  kind: PermitDraft["kind"];
  step: number;
  hazards: string[];
  controls: string[];
  fields: Record<string, string>;
  names: Record<string, string>;
  signatures: Record<string, { name: string; time: string }>;
} {
  if (workingStatePreserved(state)) {
    return { kind: "general", step: 0, hazards: [], controls: [], fields: {}, names: {}, signatures: {} };
  }
  if (state.version === 2) {
    return {
      kind: kindFromServerPermitType(state.permitType),
      step: state.workflowStep,
      hazards: stringList(state.moduleState?.hazards),
      controls: stringList(state.moduleState?.controls),
      fields: stringRecord(state.moduleState?.fields),
      names: stringRecord(state.moduleState?.names),
      signatures: signatureRecord(state.moduleState?.signatures),
    };
  }
  return {
    kind: "general",
    step: typeof state.step === "number" ? state.step : 0,
    hazards: stringList(state.hazards),
    controls: stringList(state.controls),
    fields: stringRecord(state.fields),
    names: stringRecord(state.names),
    signatures: signatureRecord(state.signatures),
  };
}

export function permitDraftFromRecord(record: StoredDraft): PermitDraft {
  const state = restoredModuleState(record.workingState);
  return {
    id: record.id,
    code: "LOCAL DRAFT",
    kind: state.kind,
    step: state.step,
    area: record.areaName,
    areaId: record.areaId ?? "",
    place: record.equipmentTag,
    workOrder: record.workOrder,
    description: record.jobDescription,
    companyType: record.companyType === "LCY" ? "LCY" : "Contractor",
    company: record.companyName,
    requester: record.requester,
    craft: record.craft,
    plannedStart: record.plannedStart ?? "",
    plannedEnd: record.expiresAt ?? "",
    hazards: state.hazards,
    controls: state.controls,
    fields: state.fields,
    names: state.names,
    signatures: state.signatures,
    updated: record.updatedAt,
    permitNumber: record.permitNumber,
    outboxStatus: record.outboxStatus,
    lifecycleStatus: record.status,
    currentRevision: record.currentRevision,
    sourceWorkingState: record.workingState as unknown as PermitDraft["sourceWorkingState"],
    preserveWorkingState: workingStatePreserved(record.workingState),
  };
}

const USER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function submitLocalPermit(id: string, userId?: string | null): Promise<PermitDraft> {
  const stored = await invokeCommand<StoredDraft>("submit_permit_for_review", {
    permitId: id,
    eventId: crypto.randomUUID(),
    outboxId: crypto.randomUUID(),
    userId: userId && USER_ID.test(userId) ? userId : null,
  });
  notifyLocalStoreChanged("draft-saved");
  return permitDraftFromRecord(stored);
}

export function localDraftLabel(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

export function localSavedLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export async function listLocalDrafts(): Promise<PermitDraft[]> {
  const rows = await invokeCommand<StoredDraft[]>("list_local_drafts");
  return rows.map(permitDraftFromRecord);
}

async function saveThroughTauri(request: GeneralWorkSaveRequest): Promise<StoredDraft> {
  return invokeCommand<StoredDraft>("save_general_work_draft", { draft: request });
}

export async function persistPermitCorrection(draft: PermitDraft): Promise<PermitDraft> {
  const request = correctionSaveRequest(draft, {
    eventId: crypto.randomUUID(),
    outboxId: crypto.randomUUID(),
  });
  const stored = await invokeCommand<StoredDraft>("queue_permit_revision", {
    draft: request,
  });
  notifyLocalStoreChanged("draft-saved");
  return permitDraftFromRecord(stored);
}

export async function persistGeneralWorkDraft(
  draft: PermitDraft,
  writer: DraftWriter = saveThroughTauri,
): Promise<PermitDraft> {
  const creating = !draft.id;
  const request = generalWorkSaveRequest(draft, {
    id: draft.id || crypto.randomUUID(),
    eventId: creating ? crypto.randomUUID() : EMPTY_EVENT,
    outboxId: creating ? crypto.randomUUID() : EMPTY_EVENT,
  });
  const stored = await writer(request);
  const saved = permitDraftFromRecord(stored);
  notifyLocalStoreChanged("draft-saved");
  return saved;
}
