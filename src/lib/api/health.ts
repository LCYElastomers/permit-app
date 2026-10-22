import { apiRequest } from "./client";
import type { HealthResponse, ReadinessResponse } from "./types";

export function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  return apiRequest<HealthResponse>("/api/v1/health", { signal });
}

export function getReadiness(signal?: AbortSignal): Promise<ReadinessResponse> {
  return apiRequest<ReadinessResponse>("/api/v1/health/ready", { signal });
}
