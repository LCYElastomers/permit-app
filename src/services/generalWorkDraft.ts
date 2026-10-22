import type { PermitDraft } from "../types";
import { invokeCommand, notifyLocalStoreChanged } from "./localStore";

export const WORKING_STATE_VERSION = 1;

export class GeneralWorkOnly extends Error {
  readonly code = "general-work-only";

  constructor() {
    super("Only General Work can be saved on this device.");
    this.name = "GeneralWorkOnly";
  }
}

export interface GeneralWorkWorkingState {
  version: typeof WORKING_STATE_VERSION;
  step: number;
  hazards: string[];
  controls: string[];
  fields: Record<string, string>;
  names: Record<string, string>;
  signatures: Record<string, { name: string; time: string }>;
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
  plannedStart: string | null;
  expiresAt: string | null;
  workingState: GeneralWorkWorkingState;
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
  workingState: GeneralWorkWorkingState;
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
    plannedStart: draft.plannedStart.trim() ? draft.plannedStart : null,
    expiresAt: draft.plannedEnd.trim() ? draft.plannedEnd : null,
    workingState: {
      version: WORKING_STATE_VERSION,
      step: draft.step,
      hazards: draft.hazards,
      controls: draft.controls,
      fields: draft.fields,
      names: draft.names,
      signatures: draft.signatures,
    },
  };
}

export function permitDraftFromRecord(record: StoredDraft): PermitDraft {
  const state = record.workingState;
  return {
    id: record.id,
    code: "LOCAL DRAFT",
    kind: "general",
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
  };
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

export async function persistGeneralWorkDraft(
  draft: PermitDraft,
  writer: DraftWriter = saveThroughTauri,
): Promise<PermitDraft> {
  if (draft.kind !== "general") throw new GeneralWorkOnly();
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
