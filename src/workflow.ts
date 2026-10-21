import type { ListScreen, Permit, PermitDraft, PermitKind, PermitStatus } from "./types";

export const STEPS = [
  { num: "01", label: "SCOPE" },
  { num: "02", label: "HAZARDS" },
  { num: "03", label: "CONTROLS" },
  { num: "04", label: "PERMIT DETAILS" },
  { num: "05", label: "REVIEW" },
  { num: "06", label: "AUTHORIZATION" },
] as const;

export const HAZARDS = [
  "atmospheric",
  "stored energy",
  "chemical exposure",
  "fire/hot work",
  "fall",
  "engulfment",
  "excavation/cave-in",
  "underground utilities",
  "traffic",
  "water",
  "other",
] as const;

export const CONTROLS = [
  "JSA",
  "SOP",
  "LOTO",
  "barricades",
  "ventilation",
  "monitoring",
  "fire watch",
  "rescue",
  "PPE",
  "other controls",
] as const;

export const AREAS = [
  "Unit 1",
  "Unit 2",
  "Tank Farm",
  "Utilities",
  "Wastewater",
  "Dock",
  "Flare",
  "Warehouse",
] as const;

export const CONFINED_FIELDS = [
  ["vesselId", "Space / Vessel ID"],
  ["previousService", "Material previously in service"],
  ["energyIsolation", "Energy isolation"],
  ["lockBox", "Lock box"],
  ["blinds", "Blind locations"],
  ["mechanical", "Mechanical isolation"],
  ["initialTest", "Initial atmosphere test"],
  ["continuous", "Continuous monitoring"],
  ["attendant", "Attendant"],
  ["rescue", "Rescue availability"],
  ["hotWork", "Hot work controls"],
  ["ppe", "PPE"],
] as const;

export const EXCAVATION_FIELDS = [
  ["digLocation", "Excavation location"],
  ["depth", "Expected depth"],
  ["competentPerson", "Competent person"],
  ["locateTicket", "One-call / locate ticket"],
  ["drawings", "Underground drawings"],
  ["undergroundHazards", "Underground hazards"],
  ["protectiveSystem", "Protective system"],
  ["soil", "Soil classification"],
  ["access", "Access / egress"],
  ["barricades", "Barricades"],
  ["traffic", "Traffic control"],
  ["monitoring", "Atmospheric monitoring"],
  ["ppe", "PPE"],
] as const;

export function kindTitle(kind: PermitKind): string {
  return kind === "confined-space" ? "CONFINED SPACE ENTRY" : "EXCAVATION";
}

export function kindShort(kind: PermitKind): string {
  return kind === "confined-space" ? "CONFINED SPACE" : "EXCAVATION";
}

export function statusLabel(status: PermitStatus): string {
  switch (status) {
    case "active":
      return "ACTIVE";
    case "pending":
      return "PENDING REVIEW";
    case "suspended":
      return "SUSPENDED";
    case "closed":
      return "CLOSED";
    case "expired":
      return "EXPIRED";
  }
}

export function statusFromLabel(label: string): PermitStatus {
  switch (label) {
    case "PENDING REVIEW":
      return "pending";
    case "SUSPENDED":
      return "suspended";
    case "CLOSED":
      return "closed";
    case "EXPIRED":
      return "expired";
    default:
      return "active";
  }
}

export function screenLabel(screen: ListScreen): string {
  switch (screen) {
    case "active":
      return "Active Permits";
    case "pending":
      return "Pending Review";
    case "suspended":
      return "Suspended";
    case "new":
      return "New Permit";
    case "drafts":
      return "Drafts";
    case "archive":
      return "Archive";
    case "templates":
      return "Templates";
    case "contractors":
      return "Contractors";
    case "equipment":
      return "Equipment";
  }
}

export function parseHm(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function shiftTime(value: string, minutes: number): string {
  const parsed = parseHm(value);
  if (parsed === null) return value;
  const total = (parsed + minutes + 24 * 60) % (24 * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function expiryState(
  expires: string,
  nowHm: string,
): "ok" | "soon" | "overdue" | "none" {
  const end = parseHm(expires);
  const now = parseHm(nowHm);
  if (end === null || now === null) return "none";
  const diff = end - now;
  if (diff < 0) return "overdue";
  if (diff <= 120) return "soon";
  return "ok";
}

export function assetLine(permit: Pick<Permit, "kind" | "equipment" | "location" | "area">): string {
  const place =
    permit.kind === "excavation"
      ? permit.location || permit.equipment
      : permit.equipment || permit.location;
  return `${place} / ${permit.area}`;
}

export function detailFields(kind: PermitKind): readonly (readonly [string, string])[] {
  return kind === "confined-space" ? CONFINED_FIELDS : EXCAVATION_FIELDS;
}

export interface AuthRole {
  id: string;
  label: string;
  required: boolean;
}

export function authorizationRoles(draft: PermitDraft): AuthRole[] {
  const roles: AuthRole[] = [
    { id: "supervisor", label: "Shift Supervisor", required: true },
    { id: "requester", label: "Requester", required: true },
    { id: "craft", label: "Craft / Permit Receiver", required: true },
  ];
  if (draft.kind === "confined-space") {
    roles.push({ id: "attendant", label: "Attendant", required: true });
    roles.push({ id: "rescue", label: "Rescue", required: true });
  }
  if (draft.kind === "excavation") {
    roles.push({ id: "competent", label: "Competent Person", required: true });
  }
  if (draft.hazards.includes("fire/hot work") || draft.controls.includes("fire watch")) {
    roles.push({ id: "firewatch", label: "Fire Watch", required: true });
  }
  return roles;
}

export function emptyDraft(kind: PermitKind = "confined-space"): PermitDraft {
  return {
    code: "",
    kind,
    step: 0,
    area: "",
    place: "",
    workOrder: "",
    description: "",
    companyType: "Contractor",
    company: "",
    requester: "",
    craft: "",
    plannedStart: "",
    plannedEnd: "",
    hazards: [],
    controls: [],
    fields: {},
    names: {},
    signatures: {},
    updated: "",
  };
}

export function toggleItem(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export function issueBlockers(draft: PermitDraft): string[] {
  const missing: string[] = [];
  if (!draft.area) missing.push("Area");
  if (!draft.place.trim()) missing.push("Equipment / location");
  if (!draft.description.trim()) missing.push("Job description");
  if (!draft.workOrder.trim()) missing.push("Work order");
  if (!draft.company.trim()) missing.push("Company");
  if (!draft.requester.trim()) missing.push("Requester");
  if (!draft.craft.trim()) missing.push("Craft / permit receiver");
  if (!draft.plannedStart) missing.push("Planned start");
  if (!draft.plannedEnd) missing.push("Planned expiration");
  if (draft.hazards.length === 0) missing.push("At least one hazard");
  for (const role of authorizationRoles(draft)) {
    if (role.required && !draft.signatures[role.id]) missing.push(`${role.label} sign-off`);
  }
  return missing;
}

export function titleCase(value: string): string {
  return value.replace(/(^|[\s/])([a-z])/g, (_, lead: string, char: string) => `${lead}${char.toUpperCase()}`);
}
