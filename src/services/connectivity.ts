import { apiRequest } from "../lib/api/client";
import { probeCall } from "../lib/api/failures";
import type { ProbeCall } from "../lib/connectivity";
import { interpretConnectivity, processIsAvailable, type PlantLinkSnapshot } from "../lib/connectivity";

export async function readProbe(path: string, signal: AbortSignal): Promise<ProbeCall> {
  const kind = path.endsWith("/ready") ? "readiness result" : "health result";
  try {
    const body = await apiRequest<unknown>(path, { signal, cache: "no-store" });
    console.info("plant link", kind, "ok");
    return { outcome: "ok", body };
  } catch (error) {
    if (signal.aborted) {
      console.info("plant link", kind, "cancelled");
      return { outcome: "cancelled" };
    }
    const result = probeCall(error);
    console.info("plant link", kind, result.outcome === "http" ? `http ${result.status}` : result.outcome);
    return result;
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
