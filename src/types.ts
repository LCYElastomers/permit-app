export type PermitKind =
  | "general"
  | "hot-work"
  | "confined-space"
  | "opening-blinding"
  | "excavation"
  | "live-electrical";

export type PermitStatus =
  | "active"
  | "pending"
  | "suspended"
  | "closed"
  | "expired";

export type Screen =
  | "command"
  | "active"
  | "pending"
  | "suspended"
  | "new"
  | "drafts"
  | "archive"
  | "templates"
  | "contractors"
  | "equipment"
  | "detail";

export type ListScreen = Exclude<Screen, "detail">;

export interface GasReading {
  time: string;
  o2: string;
  lel: string;
  co: string;
  result: "PASS" | "FAIL";
}

export interface TimelineEvent {
  time: string;
  label: string;
  tone: "neutral" | "alert" | "ok";
}

export interface Signoff {
  role: string;
  name: string;
  state: "signed" | "outstanding";
  time: string;
}

export interface Attachment {
  name: string;
  note: string;
}

export interface Condition {
  label: string;
  value: string;
}

export interface Permit {
  id: string;
  kind: PermitKind;
  status: PermitStatus;
  revision: string;
  area: string;
  areaId?: string;
  equipment: string;
  location: string;
  work: string;
  jobDescription: string;
  workOrder: string;
  company: string;
  companyType: string;
  requester: string;
  requesterGroup: string;
  craft: string;
  shiftSupervisor: string;
  attendant: string;
  entrants: string[];
  fireWatch: string;
  started: string;
  expires: string;
  issued: string;
  closed: string;
  issuedKey: string;
  year: number;
  isolation: {
    required: string;
    plan: string;
    lockBox: string;
    zeroEnergy: string;
    blinds: string;
  };
  readings: GasReading[];
  hazards: string[];
  ppe: string[];
  precautions: string[];
  attachments: Attachment[];
  history: TimelineEvent[];
  suspension: {
    time: string;
    reason: string;
    by: string;
    previous: string;
  } | null;
  signoffs: Signoff[];
  conditions: Condition[];
}

export interface PermitDraft {
  id: string;
  code: string;
  kind: PermitKind;
  step: number;
  area: string;
  areaId: string;
  place: string;
  workOrder: string;
  description: string;
  companyType: "LCY" | "Contractor";
  company: string;
  requester: string;
  craft: string;
  plannedStart: string;
  plannedEnd: string;
  hazards: string[];
  controls: string[];
  fields: Record<string, string>;
  names: Record<string, string>;
  signatures: Record<string, { name: string; time: string }>;
  updated: string;
}

export interface PermitTemplate {
  id: string;
  name: string;
  kind: PermitKind;
  revision: string;
  owner: string;
  updated: string;
  summary: string;
  hazards: string[];
  controls: string[];
}

export interface Contractor {
  id: string;
  name: string;
  service: string;
  contact: string;
  phone: string;
  insurance: string;
  orientation: string;
  status: "approved" | "hold";
}

export interface Asset {
  id: string;
  name: string;
  area: string;
  service: string;
  isolation: string;
  status: "in-service" | "isolated" | "out-of-service";
}
