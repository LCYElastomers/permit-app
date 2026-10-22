import { apiRequest } from "./client";
import type { AreaResponse, ContractorResponse, EquipmentResponse } from "./types";

export function listAreas(): Promise<AreaResponse[]> {
  return apiRequest<AreaResponse[]>("/api/v1/areas");
}

export function listEquipment(): Promise<EquipmentResponse[]> {
  return apiRequest<EquipmentResponse[]>("/api/v1/equipment");
}

export function listContractors(): Promise<ContractorResponse[]> {
  return apiRequest<ContractorResponse[]>("/api/v1/contractors");
}
