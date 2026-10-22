import { apiRequest } from "./client";
import type { CreatePermitRequest, PermitListResponse, PermitSummary } from "./types";

export function listPermits(): Promise<PermitListResponse> {
  return apiRequest<PermitListResponse>("/api/v1/permits");
}

export function getPermit(id: string): Promise<PermitSummary> {
  return apiRequest<PermitSummary>(`/api/v1/permits/${id}`);
}

export function createPermit(request: CreatePermitRequest): Promise<PermitSummary> {
  return apiRequest<PermitSummary>("/api/v1/permits", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export function listArchive(): Promise<PermitListResponse> {
  return apiRequest<PermitListResponse>("/api/v1/archive");
}

export function getArchivePermit(id: string): Promise<PermitSummary> {
  return apiRequest<PermitSummary>(`/api/v1/archive/${id}`);
}
