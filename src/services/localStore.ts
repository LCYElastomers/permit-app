import { invoke } from "@tauri-apps/api/core";
import type { AreaRecord } from "./areas";

export type LocalSyncState = "IDLE" | "PENDING" | "SYNCING" | "BACKOFF" | "REQUIRES_ATTENTION";

export interface LocalStatus {
  pendingCount: number;
  syncState: LocalSyncState;
  lastSuccessfulSyncAt: string | null;
  lastAttemptedSyncAt: string | null;
  referenceAreasSyncedAt: string | null;
}

export type LocalView =
  | { status: "checking" }
  | { status: "failed" }
  | ({ status: "available" } & LocalStatus);

export const LOCAL_STORE_FAILURE = {
  code: "local-store-unavailable",
  summary: "Local permit data is unavailable.",
} as const;

export class LocalStoreFailure extends Error {
  readonly code = LOCAL_STORE_FAILURE.code;

  constructor() {
    super(LOCAL_STORE_FAILURE.summary);
    this.name = "LocalStoreFailure";
  }
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

export async function replaceReferenceAreas(areas: AreaRecord[]): Promise<void> {
  await invokeCommand("replace_reference_areas", {
    areas: areas.map((area) => ({ id: area.id, name: area.name, serverUpdatedAt: null })),
  });
}

export async function noteSyncCycle(phase: "start" | "succeeded" | "stopped"): Promise<LocalStatus> {
  return invokeCommand<LocalStatus>("note_sync_cycle", { phase });
}

async function invokeCommand<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!tauriAvailable()) throw new LocalStoreFailure();
  try {
    return await invoke<T>(command, args);
  } catch (error) {
    if (error instanceof LocalStoreFailure || error instanceof AreaCatalogRejected) throw error;
    if (isCommandCode(error, "invalid-area-catalog")) throw new AreaCatalogRejected();
    throw new LocalStoreFailure();
  }
}

function isCommandCode(error: unknown, code: string): boolean {
  if (error === code) return true;
  if (!error || typeof error !== "object" || !("message" in error)) return false;
  return (error as { message: unknown }).message === code;
}
