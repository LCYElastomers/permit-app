import { apiRequest } from "../lib/api/client";
import { probeCall } from "../lib/api/failures";
import type { ProbeCall } from "../lib/connectivity";
import { interpretConnectivity, processIsAvailable, type PlantLinkSnapshot } from "../lib/connectivity";

export async function readProbe(path: string, signal: AbortSignal): Promise<ProbeCall> {
  try {
    const body = await apiRequest<unknown>(path, { signal });
    return { outcome: "ok", body };
  } catch (error) {
    if (signal.aborted) return { outcome: "cancelled" };
    return probeCall(error);
  }
}

export async function checkConnectivity(signal: AbortSignal): Promise<Omit<PlantLinkSnapshot, "lastCheck"> | "cancelled"> {
  const health = await readProbe("/api/v1/health", signal);
  if (health.outcome === "cancelled") return "cancelled";
  if (!processIsAvailable(health)) return { link: "unreachable" };
  const ready = await readProbe("/api/v1/health/ready", signal);
  if (ready.outcome === "cancelled") return "cancelled";
  return interpretConnectivity(health, ready);
}
