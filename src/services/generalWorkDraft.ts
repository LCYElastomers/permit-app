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

export function generalWorkSaveRequest(
  draft: PermitDraft,
  ids: { id: string; eventId: string; outboxId: string },
): GeneralWorkSaveRequest {
  const creating = !draft.id;
  return {
    id: ids.id,
    eventId: creating ? ids.eventId : EMPTY_EVENT,
    outboxId: creating ? ids.outboxId : EMPTY_EVENT,
    areaId: draft.areaId.trim() ? draft.areaId.trim() : null,
    areaName: draft.area,
    equipmentTag: draft.place,
    workOrder: draft.workOrder,
    jobDescription: draft.description,
    companyType: draft.companyType,
    companyName: draft.company,
    requester: draft.requester,
    craft: draft.craft,
    permitType: serverPermitType(draft.kind),
    plannedStart: draft.plannedStart.trim() ? draft.plannedStart : null,
    expiresAt: draft.plannedEnd.trim() ? draft.plannedEnd : null,
    workingState: {
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
    },
  };
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
  if (state.version === 2) {
    return {
      kind: kindFromServerPermitType(state.permitType),
      step: state.workflowStep,
      hazards: state.moduleState.hazards ?? [],
      controls: state.moduleState.controls ?? [],
      fields: state.moduleState.fields ?? {},
      names: state.moduleState.names ?? {},
      signatures: state.moduleState.signatures ?? {},
    };
  }
  return {
    kind: "general",
    step: state.step,
    hazards: state.hazards ?? [],
    controls: state.controls ?? [],
    fields: state.fields ?? {},
    names: state.names ?? {},
    signatures: state.signatures ?? {},
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
  const request = generalWorkSaveRequest(draft, {
    id: draft.id,
    eventId: crypto.randomUUID(),
    outboxId: crypto.randomUUID(),
  });
  const stored = await invokeCommand<StoredDraft>("queue_permit_revision", {
    draft: {
      ...request,
      permitNumber: draft.permitNumber,
      currentRevision: draft.currentRevision && draft.currentRevision > 0 ? draft.currentRevision : 1,
    },
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
