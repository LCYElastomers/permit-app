export type ApiPermitType =
  | "GENERAL_WORK"
  | "HOT_WORK"
  | "CONFINED_SPACE"
  | "OPENING_BLINDING"
  | "EXCAVATION"
  | "LIVE_ELECTRICAL";

export type ApiPermitStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "AUTHORIZED"
  | "ACTIVE"
  | "SUSPENDED"
  | "CLOSED"
  | "CANCELLED"
  | "EXPIRED"
  | "SUPERSEDED";

export interface HealthResponse {
  status: string;
  service: string;
  databaseConfigured: boolean;
}

export interface PermitSummary {
  id: string;
  permitNumber: string;
  permitType: ApiPermitType;
  status: ApiPermitStatus;
  areaId: string;
  equipmentId: string | null;
  workOrder: string;
  jobDescription: string;
  plannedStart: string;
  expiresAt: string;
  closedAt: string | null;
}

export interface PermitListResponse {
  items: PermitSummary[];
}

export interface AreaResponse {
  id: string;
  name: string;
}

export interface EquipmentResponse {
  id: string;
  areaId: string;
  tag: string;
  name: string;
}

export interface ContractorResponse {
  id: string;
  name: string;
}

export interface CreatePermitRequest {
  id: string;
  permitNumber: string;
  permitType: ApiPermitType;
  areaId: string;
  equipmentId: string | null;
  workOrder: string;
  jobDescription: string;
  companyType: "LCY" | "CONTRACTOR";
  contractorId: string | null;
  createdBy: string;
  plannedStart: string;
  expiresAt: string;
}

export interface SyncEventRequest {
  id: string;
  permitId: string;
  permitRevision: number;
  eventType: string;
  occurredAt: string;
  userId: string | null;
  deviceId: string | null;
  payload: string | null;
}
