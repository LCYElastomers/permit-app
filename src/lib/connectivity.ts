export type ConnectivityState = "checking" | "online" | "offline" | "server-not-ready";

export type ServerLink = "checking" | "online" | "offline";

export type DatabaseLink = "unknown" | "ready" | "not-ready";

export interface ConnectivitySnapshot {
  state: ConnectivityState;
  server: ServerLink;
  database: DatabaseLink;
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

export const checkingConnectivity: ConnectivitySnapshot = {
  state: "checking",
  server: "checking",
  database: "unknown",
  lastCheck: null,
};

const offlineLink = {
  state: "offline",
  server: "offline",
  database: "unknown",
} as const;

const notReadyLink = {
  state: "server-not-ready",
  server: "online",
  database: "not-ready",
} as const;

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

export function interpretConnectivity(health: ProbeCall, ready: ProbeCall): Omit<ConnectivitySnapshot, "lastCheck"> {
  if (health.outcome === "cancelled" || ready.outcome === "cancelled") return checkingConnectivity;
  if (!processIsAvailable(health)) return offlineLink;
  if (ready.outcome === "ok" && isReadyDocument(ready.body)) {
    return { state: "online", server: "online", database: "ready" };
  }
  return notReadyLink;
}

export function connectivityLabel(state: ConnectivityState): string {
  switch (state) {
    case "checking":
      return "CHECKING";
    case "online":
      return "ONLINE";
    case "offline":
      return "OFFLINE";
    case "server-not-ready":
      return "SERVER NOT READY";
  }
}

export function connectivityLamp(state: ConnectivityState): "ok" | "warn" | "alert" | "idle" {
  switch (state) {
    case "online":
      return "ok";
    case "server-not-ready":
      return "warn";
    case "checking":
      return "idle";
    case "offline":
      return "idle";
  }
}

export function serverLabel(server: ServerLink): string {
  switch (server) {
    case "online":
      return "ONLINE";
    case "offline":
      return "OFFLINE";
    case "checking":
      return "CHECKING";
  }
}

export function databaseLabel(database: DatabaseLink): string {
  switch (database) {
    case "ready":
      return "READY";
    case "not-ready":
      return "NOT READY";
    case "unknown":
      return "—";
  }
}

export function formatCheckTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
