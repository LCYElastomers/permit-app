import { invoke } from "@tauri-apps/api/core";
import type { AreaRecord } from "./areas";

export type LocalSyncState = "IDLE" | "PENDING" | "SYNCING" | "BACKOFF" | "REQUIRES_ATTENTION";

export interface LocalStatus {
  pendingCount: number;
  syncState: LocalSyncState;
  lastPlantContactAt: string | null;
  lastReferenceSyncAt: string | null;
  lastPermitSyncAt: string | null;
  lastAttemptedSyncAt: string | null;
  referenceAreasSyncedAt: string | null;
  schemaVersion: number;
}

export type LocalView =
  | { status: "checking" }
  | { status: "failed" }
  | ({ status: "available" } & LocalStatus);

export const LOCAL_STORE_FAILURE = {
  code: "local-storage-unavailable",
  summary: "Local permit data is unavailable.",
} as const;

const LOCAL_FAILURES: Record<string, string> = {
  "local-storage-unavailable": "Local permit data is unavailable.",
  "local-store-unavailable": "Local permit data is unavailable.",
  "local-storage-write-failed": "Permit Control could not save this change on the device.",
  "working-state-invalid": "Permit Control could not read this permit's saved details.",
  "working-state-version-unsupported": "This permit uses a newer saved format. The original record was not changed.",
  "permit-validation-failed": "This permit is not ready to submit.",
  "local-transaction-failed": "Permit Control could not save this change on the device.",
  "tauri-command-failed": "Permit Control could not complete this local command.",
};

export class LocalStoreFailure extends Error {
  readonly code: string;

  constructor(code: string = LOCAL_STORE_FAILURE.code) {
    super(LOCAL_FAILURES[code] ?? LOCAL_FAILURES["tauri-command-failed"]);
    this.name = "LocalStoreFailure";
    this.code = code;
  }
}

export function localStorageUnavailable(error: unknown): boolean {
  return error instanceof LocalStoreFailure && (error.code === "local-storage-unavailable" || error.code === "local-store-unavailable");
}

export function localFailureMessage(error: unknown): string {
  const code = error instanceof LocalStoreFailure ? error.code : "tauri-command-failed";
  if (code === "local-storage-unavailable" || code === "local-store-unavailable") {
    return "This draft could not be saved on this device. Local data is unavailable. The form is still here.";
  }
  if (code === "permit-validation-failed") {
    return "PERMIT NOT READY. Complete the preparation items listed below. Local data is available.";
  }
  if (code === "working-state-version-unsupported" || code === "working-state-invalid") {
    return "DRAFT NOT SAVED. Your current form entries remain available. The original saved permit was not changed.";
  }
  return "DRAFT NOT SAVED. Your current form entries remain available. Permit Control could not save this change on the device.";
}

export class AreaCatalogRejected extends Error {
  readonly code = "invalid-area-catalog";

  constructor() {
    super("Area reference data was rejected.");
    this.name = "AreaCatalogRejected";
  }
}

interface StoredArea {
  id: string;
  name: string;
  serverUpdatedAt: string | null;
  localUpdatedAt: string;
}

export function tauriAvailable(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function readLocalStatus(): Promise<LocalStatus> {
  return invokeCommand<LocalStatus>("local_status");
}

export async function listCachedAreas(): Promise<AreaRecord[]> {
  const rows = await invokeCommand<StoredArea[]>("list_reference_areas");
  return rows.map((row) => ({ id: row.id, name: row.name }));
}

export interface CatalogCacheRow {
  id: string;
  code: string;
  name: string;
  enabled: boolean;
  payload: string;
}

export async function replaceReferenceCatalog(catalog: string, rows: CatalogCacheRow[]): Promise<void> {
  await invokeCommand("replace_reference_catalog", { catalog, rows });
}

export async function replaceReferenceAreas(areas: AreaRecord[]): Promise<void> {
  await invokeCommand("replace_reference_areas", {
    areas: areas.map((area) => ({ id: area.id, name: area.name, serverUpdatedAt: null })),
  });
}

export async function noteSyncCycle(phase: "start" | "stopped"): Promise<LocalStatus> {
  return invokeCommand<LocalStatus>("note_sync_cycle", { phase });
}

export async function notePlantContact(): Promise<LocalStatus> {
  return invokeCommand<LocalStatus>("note_plant_contact");
}

export type LocalStoreChange = "draft-saved" | "status";

const localStoreListeners = new Set<(reason: LocalStoreChange) => void>();

export function onLocalStoreChanged(listener: (reason: LocalStoreChange) => void): () => void {
  localStoreListeners.add(listener);
  return () => localStoreListeners.delete(listener);
}

export function notifyLocalStoreChanged(reason: LocalStoreChange = "status"): void {
  for (const listener of localStoreListeners) listener(reason);
}

export async function invokeCommand<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!tauriAvailable()) throw new LocalStoreFailure();
  try {
    return await invoke<T>(command, args);
  } catch (error) {
    if (error instanceof LocalStoreFailure || error instanceof AreaCatalogRejected) throw error;
    if (isCommandCode(error, "invalid-area-catalog")) throw new AreaCatalogRejected();
    const reported = commandText(error);
    const code = reported in LOCAL_FAILURES ? reported : "tauri-command-failed";
    console.error("local persistence", { operation: command, category: code, code: reported || "unclassified" });
    throw new LocalStoreFailure(code);
  }
}

function commandText(error: unknown): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  return "";
}

function isCommandCode(error: unknown, code: string): boolean {
  if (error === code) return true;
  if (!error || typeof error !== "object" || !("message" in error)) return false;
  return (error as { message: unknown }).message === code;
}
