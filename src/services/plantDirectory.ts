import { apiRequest } from "../lib/api/client";
import { ApiError } from "../lib/api/errors";
import { kindFromServerPermitType } from "./generalWorkDraft";
import type { Permit, PermitStatus } from "../types";

export interface PlantUser {
  id: string;
  permitUserCode: string;
  displayName: string;
  windowsUsername: string;
  windowsDomain: string | null;
  personnelReference: string;
  personnelCode: string;
  jobTitle: string;
  department: string | null;
  enabled: boolean;
  pinState: string;
  pinChangedAt: string | null;
  failedAttempts: number | null;
  lockedUntil: string | null;
  roles: string[];
  qualifications: { id: string; qualificationType: string; effectiveDate: string | null; expirationDate: string | null; enabled: boolean; notes: string | null }[];
}

export interface PlantSession {
  token: string;
  user: PlantUser;
}

export interface PlantChoice {
  id: string;
  permitUserCode: string;
  displayName: string;
  jobTitle: string;
}

export interface PlantApproval {
  actingRole: string;
  displayName: string;
  permitUserCode: string;
  jobTitle: string | null;
  at: string | null;
}

export interface PlantPermit {
  id: string;
  permitNumber: string;
  permitType: string;
  status: string;
  revision: number;
  jobDescription: string;
  workOrder: string;
  areaName: string | null;
  equipmentTag?: string | null;
  createdBy?: string | null;
  allowSelfAuthorization?: boolean;
  hazards: string[];
  controls: string[];
  ppe: string[];
  modules: string[];
  approvals: PlantApproval[];
  missing: string[];
}

const TOKEN = "permit-control-session";

export function readSessionToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN);
  } catch {
    return null;
  }
}

export function storeSessionToken(token: string | null) {
  try {
    if (token) sessionStorage.setItem(TOKEN, token);
    else sessionStorage.removeItem(TOKEN);
  } catch {
    /* the browser session is unavailable; the acting user is forgotten on reload */
  }
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export async function openWindowsSession(domain: string | null, username: string) {
  return apiRequest<{ kind: "mapped" | "select"; session: PlantSession | null; choices: PlantChoice[] }>("/api/v1/identity/sessions", {
    method: "POST",
    body: JSON.stringify({ windowsDomain: domain, windowsUsername: username }),
  });
}

export async function confirmPlantUser(userId: string, pin: string) {
  return apiRequest<PlantSession>("/api/v1/identity/sessions/confirm", {
    method: "POST",
    body: JSON.stringify({ userId, pin, deviceId: null }),
  });
}

export async function currentPlantUser(token: string) {
  return apiRequest<PlantUser>("/api/v1/identity/session", { headers: authHeaders(token) });
}

export async function enrollPin(token: string, pin: string, confirmPin: string) {
  await apiRequest<unknown>("/api/v1/identity/pin", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ pin, confirmPin, deviceId: null }),
  });
}

export function needsPinEnrollment(pinState: string | null | undefined): boolean {
  return pinState === "NOT_ENROLLED" || pinState === "ENROLLMENT_REQUIRED";
}

export function showCreatePinForm(pinState: string | null | undefined, enrollmentSaved: boolean): boolean {
  return !enrollmentSaved && needsPinEnrollment(pinState);
}

export type PinEnrollmentFinish =
  | { kind: "active"; user: PlantUser }
  | { kind: "saved" }
  | { kind: "failed"; message: string };

export async function completePinEnrollment(
  token: string,
  pin: string,
  confirmPin: string,
  current: (sessionToken: string) => Promise<PlantUser> = currentPlantUser,
): Promise<PinEnrollmentFinish> {
  let saved = false;
  try {
    await enrollPin(token, pin, confirmPin);
    saved = true;
  } catch (error) {
    if (error instanceof ApiError && error.code === "pin-already-enrolled") saved = true;
    else return { kind: "failed", message: pinMessage(error) };
  }

  try {
    return { kind: "active", user: await current(token) };
  } catch {
    return saved ? { kind: "saved" } : { kind: "failed", message: pinMessage(new ApiError(0)) };
  }
}

export async function changePin(token: string, currentPin: string, newPin: string, confirmPin: string) {
  await apiRequest<unknown>("/api/v1/identity/pin/change", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ currentPin, newPin, confirmPin, deviceId: null }),
  });
}

export async function listPlantUsers(token: string, search: string, enabled: "all" | "enabled" | "disabled") {
  const query = new URLSearchParams();
  if (search.trim()) query.set("search", search.trim());
  if (enabled !== "all") query.set("enabled", enabled === "enabled" ? "true" : "false");
  const suffix = query.size ? `?${query}` : "";
  return apiRequest<PlantUser[]>(`/api/v1/users${suffix}`, { headers: authHeaders(token) });
}

export async function savePlantUser(token: string, user: PlantUser) {
  await apiRequest<unknown>(`/api/v1/users/${user.id}`, {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify(editBody(user)),
  });
}

export async function createPlantUser(token: string, user: PlantUser) {
  return apiRequest<PlantUser>("/api/v1/users", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(editBody(user)),
  });
}

export async function setPlantRoles(token: string, userId: string, roles: string[], pin: string) {
  await apiRequest<unknown>(`/api/v1/users/${userId}/roles`, {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify({ roles, pin, deviceId: null }),
  });
}

export async function addPlantQualification(token: string, userId: string, qualification: string) {
  await apiRequest<unknown>(`/api/v1/users/${userId}/qualifications`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ qualification }),
  });
}

export async function plantPinAction(token: string, userId: string, action: "require-change" | "reset-enrollment" | "unlock", pin: string) {
  await apiRequest<unknown>(`/api/v1/users/${userId}/pin/${action}`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ pin, deviceId: null, reason: action }),
  });
}

export async function setPlantEnabled(token: string, userId: string, enabled: boolean, pin: string) {
  await apiRequest<unknown>(`/api/v1/users/${userId}/enabled`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ enabled, pin, deviceId: null }),
  });
}

export async function listPlantPermits(status?: string) {
  const suffix = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiRequest<PlantPermit[]>(`/api/v1/permits${suffix}`);
}

export async function getPlantPermit(id: string) {
  return apiRequest<PlantPermit>(`/api/v1/permits/${id}`);
}

export async function submitPlantPermit(token: string, id: string) {
  await apiRequest<unknown>(`/api/v1/permits/${id}/submit`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ deviceId: null }),
  });
}

export async function actOnPlantPermit(token: string, id: string, action: "authorize" | "accept" | "activate", pin: string, revision: number, actingRole?: string) {
  await apiRequest<unknown>(`/api/v1/permits/${id}/${action}`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ pin, revision, actingRole: actingRole ?? null, deviceId: null }),
  });
}

export function pinMessage(error: unknown): string {
  const code = error instanceof ApiError ? error.code : "";
  switch (code) {
    case "pin-minimum-age":
      return "Your Permit Control PIN cannot be changed again yet.";
    case "pin-locked":
      return "PIN verification is temporarily locked. Try again later or contact a Permit Control administrator.";
    case "pin-not-accepted":
      return "The PIN was not accepted.";
    case "pin-too-weak":
      return "That PIN is not allowed.";
    case "pin-format-invalid":
      return "A Permit Control PIN is exactly 6 digits.";
    case "pin-confirmation-mismatch":
      return "The PIN confirmation does not match.";
    case "pin-reuse-not-allowed":
      return "That PIN was used recently. Choose a different PIN.";
    case "pin-change-required":
      return "Change your Permit Control PIN before this action.";
    case "pin-not-enrolled":
      return "Create your Permit Control PIN before this action.";
    case "self-authorization-denied":
      return "You cannot authorize a permit you created or submitted.";
    case "specialty-incomplete":
      return "A required qualification is still missing.";
    case "capability-required":
      return "Your Permit Control roles do not allow this action.";
    case "permit-incomplete":
      return "The permit is missing required preparation.";
    case "lifecycle-conflict":
      return "This permit is not in the right status for that action.";
    case "area-history-preserved":
      return "This area is already used by a permit. Its name stays with that history. You can disable it.";
    case "equipment-history-preserved":
    case "contractor-history-preserved":
      return "This catalog item is already used by a permit. Disable it instead of renaming the historical identity.";
    case "executable-content-rejected":
      return "That value cannot be stored. Administration accepts labels and controlled choices only.";
    case "form-version-locked":
      return "That field belongs to a published form version. Save it as the next version.";
    default:
      return "Permit Control could not complete that action.";
  }
}

export function notifyPlantPermitsChanged() {
  window.dispatchEvent(new Event("plant-permits-changed"));
}

export function onPlantPermitsChanged(listener: () => void): () => void {
  window.addEventListener("plant-permits-changed", listener);
  return () => window.removeEventListener("plant-permits-changed", listener);
}

export function canPerform(user: PlantUser | null, role: string): boolean {
  if (!user) return false;
  if (user.roles.includes("SUPER_ADMIN")) return true;
  return user.roles.includes(role);
}

export function permitFromPlant(record: PlantPermit): Permit {
  const status: PermitStatus = record.status === "ACTIVE" ? "active" : record.status === "SUSPENDED" ? "suspended" : record.status === "CLOSED" || record.status === "CANCELLED" ? "closed" : "pending";
  return {
    id: record.permitNumber || record.id,
    kind: kindFromServerPermitType(record.permitType),
    status,
    sample: false,
    authority: "authoritative",
    serverPermitId: record.id,
    revision: String(record.revision).padStart(2, "0"),
    area: record.areaName ?? "",
    equipment: record.equipmentTag ?? "",
    location: "",
    work: record.jobDescription,
    jobDescription: record.jobDescription,
    workOrder: record.workOrder,
    company: "",
    companyType: "",
    requester: record.approvals.find((item) => item.actingRole === "REQUESTER")?.displayName ?? "",
    requesterGroup: "",
    craft: record.approvals.find((item) => item.actingRole === "CRAFT_RECEIVER")?.displayName ?? "",
    shiftSupervisor: "",
    attendant: "",
    entrants: [],
    fireWatch: "",
    started: "",
    expires: "",
    issued: "",
    closed: "",
    issuedKey: "",
    year: 2026,
    isolation: { required: "—", plan: "—", lockBox: "—", zeroEnergy: "—", blinds: "—" },
    readings: [],
    hazards: record.hazards,
    ppe: record.ppe,
    precautions: record.controls,
    attachments: [],
    history: record.approvals.map((item) => ({ time: item.at ?? "", label: `${item.actingRole} ${item.displayName} ${item.permitUserCode}`, tone: "neutral" as const })),
    suspension: null,
    signoffs: [],
    conditions: record.modules.map((module) => ({ label: "Module", value: module.replaceAll("_", " ") })),
    plantRecord: {
      status: record.status,
      revision: record.revision,
      missing: record.missing,
      createdBy: record.createdBy ?? null,
      allowSelfAuthorization: record.allowSelfAuthorization ?? false,
      approvals: record.approvals,
    },
  };
}

function editBody(user: PlantUser) {
  return {
    displayName: user.displayName,
    windowsDomain: user.windowsDomain,
    windowsUsername: user.windowsUsername,
    personnelReference: user.personnelReference,
    personnelCode: user.personnelCode,
    jobTitle: user.jobTitle,
    department: user.department,
    enabled: user.enabled,
    roles: user.roles,
  };
}
