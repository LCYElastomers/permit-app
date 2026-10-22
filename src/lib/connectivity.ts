export type PlantLink = "checking" | "unreachable" | "api-online" | "ready";

export interface PlantLinkSnapshot {
  link: PlantLink;
  lastCheck: string | null;
}

export type ProbeCall =
  | { outcome: "ok"; body: unknown }
  | { outcome: "http"; status: number }
  | { outcome: "timeout" }
  | { outcome: "offline" }
  | { outcome: "tls" }
  | { outcome: "malformed" }
  | { outcome: "cancelled" };

export const checkingPlantLink: PlantLinkSnapshot = {
  link: "checking",
  lastCheck: null,
};

export function isHealthDocument(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const body = value as Record<string, unknown>;
  return body.status === "ok" && typeof body.service === "string" && typeof body.databaseConfigured === "boolean";
}

export function isReadyDocument(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  return (value as Record<string, unknown>).status === "ready";
}

export function processIsAvailable(health: ProbeCall): boolean {
  return health.outcome === "ok" && isHealthDocument(health.body);
}

export function interpretConnectivity(health: ProbeCall, ready: ProbeCall): Omit<PlantLinkSnapshot, "lastCheck"> {
  if (health.outcome === "cancelled" || ready.outcome === "cancelled") return checkingPlantLink;
  if (!processIsAvailable(health)) return { link: "unreachable" };
  if (ready.outcome === "ok" && isReadyDocument(ready.body)) return { link: "ready" };
  return { link: "api-online" };
}

// Plant Link readiness is the only sync gate. General internet connectivity is not an input.
export function syncMayStart(link: PlantLink): boolean {
  return link === "ready";
}

export function plantLinkLabel(link: PlantLink): string {
  switch (link) {
    case "checking":
      return "CHECKING";
    case "unreachable":
      return "OFFLINE";
    case "api-online":
      return "NOT READY";
    case "ready":
      return "CONNECTED";
  }
}

export function plantLinkLamp(link: PlantLink): "ok" | "warn" | "idle" {
  switch (link) {
    case "ready":
      return "ok";
    case "api-online":
      return "warn";
    case "checking":
    case "unreachable":
      return "idle";
  }
}

export function formatCheckTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
