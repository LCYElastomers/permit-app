import { apiRequest } from "../lib/api/client";
import { syncMayStart, type PlantLink } from "../lib/connectivity";
import { AreaCatalogRejected, localStorageUnavailable, replaceReferenceAreas } from "./localStore";
import { parseAreaList, type AreaRecord } from "./areas";

export type AreaRefreshResult = "updated" | "kept" | "storage-failed";

export async function refreshAreaCatalog(input: {
  link: PlantLink;
  signal: AbortSignal;
  load?: (signal: AbortSignal) => Promise<unknown>;
  replace?: (areas: AreaRecord[]) => Promise<void>;
}): Promise<AreaRefreshResult> {
  if (!syncMayStart(input.link) || input.signal.aborted) return "kept";
  const load = input.load ?? loadAreaPayload;
  const replace = input.replace ?? replaceReferenceAreas;
  let body: unknown;
  try {
    body = await load(input.signal);
  } catch {
    return "kept";
  }
  if (input.signal.aborted) return "kept";
  const areas = parseAreaList(body);
  if (!areas || input.signal.aborted) return "kept";
  try {
    await replace(areas);
  } catch (error) {
    if (error instanceof AreaCatalogRejected) return "kept";
    if (!localStorageUnavailable(error)) return "kept";
    return "storage-failed";
  }
  return "updated";
}

function loadAreaPayload(signal: AbortSignal): Promise<unknown> {
  return apiRequest<unknown>("/api/v1/areas", { signal });
}
