import { apiRequest } from "./client";
import type { SyncEventRequest } from "./types";

export function pushSync(events: SyncEventRequest[]): Promise<{ error: string }> {
  return apiRequest<{ error: string }>("/api/v1/sync/push", {
    method: "POST",
    body: JSON.stringify({ events }),
  });
}

export function pullSync(since: string): Promise<{ since: string; events: SyncEventRequest[] }> {
  return apiRequest<{ since: string; events: SyncEventRequest[] }>(`/api/v1/sync/pull?since=${encodeURIComponent(since)}`);
}
