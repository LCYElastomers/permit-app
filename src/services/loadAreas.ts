import { apiRequest } from "../lib/api/client";
import { parseAreaList, type AreaCatalog, type AreaRecord } from "./areas";

export async function loadAreaCatalog(): Promise<Exclude<AreaCatalog, { status: "loading" }>> {
  try {
    const body = await apiRequest<unknown>("/api/v1/areas");
    const areas = parseAreaList(body);
    if (!areas) {
      logAreaFailure("malformed");
      return { status: "unavailable" };
    }
    return { status: "ready", areas };
  } catch (error) {
    logAreaFailure(error instanceof Error ? error.name : "unknown");
    return { status: "unavailable" };
  }
}

export type { AreaRecord };

function logAreaFailure(detail: string) {
  if (import.meta.env.DEV) console.info("Area reference data unavailable", detail);
}
