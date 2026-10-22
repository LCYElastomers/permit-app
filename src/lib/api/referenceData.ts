import { apiRequest } from "./client";
import type { AreaResponse, ContractorResponse, CreateAreaRequest, EquipmentResponse } from "./types";

export function listAreas(): Promise<AreaResponse[]> {
  return apiRequest<AreaResponse[]>("/api/v1/areas");
}

export function getArea(id: string): Promise<AreaResponse> {
  return apiRequest<AreaResponse>(`/api/v1/areas/${encodeURIComponent(id)}`);
}

export function createArea(request: CreateAreaRequest): Promise<AreaResponse> {
  return apiRequest<AreaResponse>("/api/v1/areas", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export function listEquipment(): Promise<EquipmentResponse[]> {
  return apiRequest<EquipmentResponse[]>("/api/v1/equipment");
}

export function listContractors(): Promise<ContractorResponse[]> {
  return apiRequest<ContractorResponse[]>("/api/v1/contractors");
}
