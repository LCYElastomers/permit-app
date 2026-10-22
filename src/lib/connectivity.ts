export type ConnectivityState = "online" | "offline" | "syncing" | "sync-error";

export interface ConnectivitySnapshot {
  state: ConnectivityState;
  lastSynced: string | null;
}

export interface ConnectivitySource {
  current(): ConnectivitySnapshot;
}

export const mockConnectivity: ConnectivitySource = {
  current: () => ({ state: "online", lastSynced: "13:27" }),
};

export function connectivityLabel(state: ConnectivityState): string {
  switch (state) {
    case "online":
      return "ONLINE";
    case "offline":
      return "OFFLINE";
    case "syncing":
      return "SYNCING";
    case "sync-error":
      return "SYNC ERROR";
  }
}

export function connectivityLamp(state: ConnectivityState): "ok" | "warn" | "alert" | "idle" {
  switch (state) {
    case "online":
      return "ok";
    case "syncing":
      return "warn";
    case "sync-error":
      return "alert";
    case "offline":
      return "idle";
  }
}
