import { qualificationLabel } from "./permitDetailPresentation";

export interface ReadinessItem {
  label: string;
  state: "COMPLETE" | "PENDING" | "INCOMPLETE";
}

export interface LifecyclePrompt {
  title: string;
  detail: string;
  workAuthorized: boolean;
  nextTitle: string;
  nextDetail: string;
  action: "authorize" | "accept" | "activate" | null;
  actionLabel: string | null;
  personnel: string[];
  actingRole: "PERMIT_AUTHORIZER" | "CRAFT_RECEIVER" | null;
  requiredAuthority: string | null;
  blocked: string | null;
  readiness: ReadinessItem[];
  correction: "edit" | "return" | "reauthorize" | "none";
  withdraw: boolean;
  focus: "ppe" | null;
  focusStep: number;
  gaps: string[];
}

const REQUIRED_MODULES: Record<string, string[]> = {
  GENERAL_WORK: ["CORE", "JSA", "HAZARD_ASSESSMENT", "PPE"],
  HOT_WORK: ["CORE", "JSA", "HAZARD_ASSESSMENT", "PPE", "ATMOSPHERIC_MONITORING", "HOT_WORK", "FIRE_WATCH"],
  CONFINED_SPACE: ["CORE", "JSA", "HAZARD_ASSESSMENT", "PPE", "LOTO_ISOLATION", "ATMOSPHERIC_MONITORING", "CONFINED_SPACE", "RESCUE"],
  OPENING_BLINDING: ["CORE", "JSA", "HAZARD_ASSESSMENT", "PPE", "LOTO_ISOLATION", "OPENING_BLINDING"],
  EXCAVATION: ["CORE", "JSA", "HAZARD_ASSESSMENT", "PPE", "EXCAVATION"],
  LIVE_ELECTRICAL: ["CORE", "JSA", "HAZARD_ASSESSMENT", "PPE", "LIVE_ELECTRICAL"],
};

export function requiredModules(permitType: string) {
  return REQUIRED_MODULES[permitType] ?? REQUIRED_MODULES.GENERAL_WORK;
}

export function requiresPpe(permitType: string) {
  return requiredModules(permitType).includes("PPE");
}

export function plantStatusCopy(status: string): { title: string; detail: string; workAuthorized: boolean } {
  if (status === "ACTIVE") return { title: "ACTIVE", detail: "WORK AUTHORIZED", workAuthorized: true };
  if (status === "AUTHORIZED") return { title: "AUTHORIZED", detail: "NOT ACTIVE FOR WORK", workAuthorized: false };
  if (status === "PENDING_REVIEW") return { title: "PENDING REVIEW", detail: "NOT AUTHORIZED FOR WORK", workAuthorized: false };
  if (status === "SUSPENDED") return { title: "SUSPENDED", detail: "WORK NOT AUTHORIZED", workAuthorized: false };
  return { title: status.replaceAll("_", " "), detail: "NOT ACTIVE FOR WORK", workAuthorized: false };
}

export function lifecyclePrompt(input: {
  status: string;
  jobDescription: string;
  workOrder: string;
  hazards: string[];
  controls: string[];
  ppe: string[];
  modules: string[];
  missing: string[];
  approvals: { actingRole: string }[];
  canAuthorize: boolean;
  canAccept: boolean;
  actorId: string | null;
  createdBy: string | null;
  allowSelfAuthorization: boolean;
  permitType?: string;
  canCorrect?: boolean;
}): LifecyclePrompt {
  const status = plantStatusCopy(input.status);
  const permitType = input.permitType ?? "GENERAL_WORK";
  const canCorrect = input.canCorrect ?? true;
  const authorizer = input.approvals.some((item) => item.actingRole === "PERMIT_AUTHORIZER");
  const receiver = input.approvals.some((item) => item.actingRole === "CRAFT_RECEIVER");
  const scope = input.jobDescription.trim().length > 0;
  const order = input.workOrder.trim().length > 0;
  const hazards = input.hazards.length > 0;
  const controls = input.controls.length > 0;
  const ppeReady = !requiresPpe(permitType) || input.ppe.length > 0;
  const modules = input.modules.length > 0;
  const people = input.missing.length === 0;
  const gaps = preparationGapLabels({ scope, order, hazards, ppeReady });
  const readiness: ReadinessItem[] = [
    { label: "Scope", state: scope ? "COMPLETE" : "INCOMPLETE" },
    { label: "Work order", state: order ? "COMPLETE" : "INCOMPLETE" },
    { label: "Hazards", state: hazards ? "COMPLETE" : "INCOMPLETE" },
    { label: "Controls", state: controls ? "COMPLETE" : "INCOMPLETE" },
    { label: "PPE", state: ppeReady ? "COMPLETE" : "INCOMPLETE" },
    { label: "Required modules", state: modules ? "COMPLETE" : "INCOMPLETE" },
    { label: "Required people", state: people ? "COMPLETE" : "INCOMPLETE" },
    { label: "Permit authorization", state: input.status === "AUTHORIZED" || input.status === "ACTIVE" ? "COMPLETE" : input.status === "PENDING_REVIEW" ? "PENDING" : "INCOMPLETE" },
    { label: "Permit authorizer", state: authorizer ? "COMPLETE" : "PENDING" },
    { label: "Craft receiver", state: receiver ? "COMPLETE" : "PENDING" },
  ];
  const preparationBlocked = gaps.length > 0;
  const focus = gaps.includes("PPE") ? "ppe" as const : null;
  const focusStep = preparationSection(gaps[0]);
  const correction: LifecyclePrompt["correction"] =
    input.status === "SUSPENDED" ? "reauthorize"
    : !canCorrect ? "none"
    : input.status === "DRAFT" || input.status === "PENDING_REVIEW" ? "edit"
    : input.status === "AUTHORIZED" ? "return"
    : "none";
  const selfBlocked = !input.allowSelfAuthorization && input.actorId !== null && input.actorId === input.createdBy;
  const personnel = input.missing.map(qualificationLabel);
  let action: LifecyclePrompt["action"] = null;
  let actionLabel: string | null = null;
  let actingRole: LifecyclePrompt["actingRole"] = null;
  let nextTitle = "NO FURTHER ACTION";
  let nextDetail = "This permit has no pending lifecycle action.";
  let requiredAuthority: string | null = null;
  let blocked: string | null = null;

    if (input.status === "DRAFT") {
    nextTitle = "COMPLETE PERMIT";
    nextDetail = "Finish the required permit information.";
  } else if (input.status === "PENDING_REVIEW") {
    nextTitle = "AUTHORIZE PERMIT";
    requiredAuthority = "PERMIT AUTHORIZER";
    if (preparationBlocked) {
      nextTitle = "COMPLETE REQUIRED INFORMATION";
      nextDetail = "Required Permit information is still missing.";
      blocked = gaps.join(", ");
    } else if (!input.canAuthorize) {
      nextTitle = "PERMIT AUTHORIZER REQUIRED";
      nextDetail = "The current Permit Control user does not have authority to authorize this Permit.";
    } else if (selfBlocked) {
      nextTitle = "SELF AUTHORIZATION NOT PERMITTED";
      nextDetail = "This Permit must be authorized by another Permit Authorizer.";
    } else {
      nextDetail = "Permit preparation is complete and ready for authorization.";
      action = "authorize";
      actionLabel = "AUTHORIZE PERMIT";
      actingRole = "PERMIT_AUTHORIZER";
    }
  } else if (input.status === "AUTHORIZED" && preparationBlocked) {
    nextTitle = "COMPLETE REQUIRED INFORMATION";
    nextDetail = "Required information is incomplete. Return this permit for correction before work may be activated.";
    blocked = gaps.join(", ");
  } else if (input.status === "AUTHORIZED" && !receiver) {
    nextTitle = "PERMIT RECEIVER ACCEPTANCE";
    requiredAuthority = "CRAFT RECEIVER";
    if (!input.canAccept) {
      nextDetail = "Permit receiver acceptance required";
      blocked = "Required authority: CRAFT RECEIVER";
    } else {
      nextDetail = "Confirm your Permit Control PIN to accept this permit.";
      action = "accept";
      actionLabel = "ACCEPT PERMIT";
      actingRole = "CRAFT_RECEIVER";
    }
  } else if (input.status === "AUTHORIZED" && receiver) {
    if (!people) {
      nextTitle = "COMPLETE REQUIRED PERSONNEL";
      nextDetail = "Required qualifications are still missing.";
    } else if (input.canAuthorize || input.canAccept) {
      nextTitle = "READY TO ACTIVATE";
      nextDetail = "Confirm your Permit Control PIN to activate this permit.";
      action = "activate";
      actionLabel = "ACTIVATE PERMIT";
      actingRole = input.canAccept ? "CRAFT_RECEIVER" : "PERMIT_AUTHORIZER";
    } else {
      nextTitle = "READY TO ACTIVATE";
      nextDetail = "Activation requires a permit authorizer or craft receiver";
      blocked = "Required authority: PERMIT AUTHORIZER or CRAFT RECEIVER";
    }
  } else if (input.status === "ACTIVE") {
    nextTitle = "WORK AUTHORIZED";
    nextDetail = "Permit is currently active.";
  } else if (input.status === "SUSPENDED") {
    nextTitle = "REVIEW FOR REAUTHORIZATION";
    nextDetail = "Work is not authorized until this Permit is reviewed for reauthorization.";
  }

  const withdraw = input.status === "AUTHORIZED" && input.canAuthorize;
  return { ...status, nextTitle, nextDetail, action, actionLabel, personnel, actingRole, requiredAuthority, blocked, readiness, correction, withdraw, focus, focusStep, gaps };
}

export function preparationSection(gap: string | undefined): number {
  if (gap === "Hazards") return 1;
  if (gap === "Controls") return 2;
  if (gap === "PPE") return 3;
  return 0;
}

export function blockingItemCopy(gap: string): string {
  if (gap === "PPE") return "PPE selection must be completed before this Permit can proceed.";
  if (gap === "Scope") return "Work scope must be completed before this Permit can proceed.";
  if (gap === "Work order") return "A work order must be recorded before this Permit can proceed.";
  if (gap === "Hazards") return "Hazards must be identified before this Permit can proceed.";
  if (gap === "Controls") return "Controls must be recorded before this Permit can proceed.";
  return `${gap} must be completed before this Permit can proceed.`;
}

/** Session gates that sit in front of an otherwise available lifecycle action. */
export function presentLifecycleGate(
  prompt: LifecyclePrompt,
  gate: { plantReady: boolean; pinActive: boolean },
): LifecyclePrompt {
  if (!prompt.action) return prompt;
  if (!gate.plantReady) {
    return {
      ...prompt,
      action: null,
      actionLabel: null,
      actingRole: null,
      nextTitle: "PLANT CONNECTION REQUIRED",
      nextDetail: prompt.action === "authorize"
        ? "Connect to the plant before authorizing this Permit."
        : "Connect to the plant before confirming this Permit.",
      blocked: null,
    };
  }
  if (!gate.pinActive) {
    return {
      ...prompt,
      action: null,
      actionLabel: null,
      actingRole: null,
      nextTitle: "PIN ENROLLMENT REQUIRED",
      nextDetail: "Create your Permit Control PIN before authorizing work.",
      blocked: null,
    };
  }
  return prompt;
}

export type DetailSource = "plant" | "synchronized" | "local" | "sample";

/** Authority comes from the permit record, not from the screen that opened it. */
export function permitDetailSource(permit: {
  sample?: boolean;
  authority?: string;
  serverPermitId?: string | null;
  plantRecord?: unknown;
}): DetailSource {
  if (permit.plantRecord) return "plant";
  if (permit.sample === false && (permit.authority === "authoritative" || Boolean(permit.serverPermitId))) return "synchronized";
  if (permit.sample === false) return "local";
  return "sample";
}

export function detailStatusCopy(permit: {
  status: string;
  sample?: boolean;
  authority?: string;
  serverPermitId?: string | null;
  lifecycleStatus?: string;
  plantRecord?: { status: string } | null;
}): { title: string; detail: string; active: boolean } {
  if (permit.plantRecord) {
    const copy = plantStatusCopy(permit.plantRecord.status);
    return { title: copy.title, detail: copy.detail, active: copy.workAuthorized };
  }
  if (permit.sample === false && permit.authority !== "authoritative" && !permit.serverPermitId) {
    return { title: "LOCAL DRAFT", detail: "SAVED LOCALLY · PENDING SYNC", active: false };
  }
  if (permit.lifecycleStatus) {
    const copy = plantStatusCopy(permit.lifecycleStatus);
    return { title: copy.title, detail: copy.detail, active: copy.workAuthorized };
  }
  if (permit.status === "active") return { title: "ACTIVE", detail: "WORK AUTHORIZED", active: true };
  if (permit.status === "suspended") return { title: "SUSPENDED", detail: "WORK NOT AUTHORIZED", active: false };
  if (permit.status === "closed") return { title: "CLOSED", detail: "NOT ACTIVE FOR WORK", active: false };
  if (permit.status === "expired") return { title: "EXPIRED", detail: "WORK NOT AUTHORIZED", active: false };
  return { title: "PENDING REVIEW", detail: "NOT AUTHORIZED FOR WORK", active: false };
}

export function stationDetailPrompt(input: {
  source: Exclude<DetailSource, "plant">;
  status: string;
  plantReady: boolean;
  editable: boolean;
  resolveFailed?: boolean;
}): {
  nextTitle: string;
  nextDetail: string;
  edit: boolean;
  suspend: boolean;
  extend: boolean;
  close: boolean;
  reinstate: boolean;
} {
  const none = { edit: false, suspend: false, extend: false, close: false, reinstate: false };
  if (input.source === "synchronized" && !input.plantReady) {
    return {
      ...none,
      edit: input.editable,
      nextTitle: "PLANT CONNECTION REQUIRED",
      nextDetail: "Connect to the plant before authorizing this Permit.",
    };
  }
  if (input.source === "synchronized") {
    return {
      ...none,
      edit: input.editable,
      nextTitle: input.resolveFailed ? "PLANT RECORD UNAVAILABLE" : "READING PLANT RECORD",
      nextDetail: input.resolveFailed
        ? "This Permit is synchronized, but the plant record could not be read."
        : "The plant record for this Permit is being read.",
    };
  }
  if (input.source === "local") {
    return {
      ...none,
      edit: input.editable,
      nextTitle: "COMPLETE PERMIT",
      nextDetail: "This Permit is saved on this device and is not yet a plant record.",
    };
  }
  if (input.status === "active") {
    return {
      ...none,
      suspend: true,
      extend: true,
      close: true,
      nextTitle: "WORK AUTHORIZED",
      nextDetail: "Permit is currently active.",
    };
  }
  if (input.status === "suspended") {
    return {
      ...none,
      reinstate: true,
      nextTitle: "REVIEW FOR REAUTHORIZATION",
      nextDetail: "Work is not authorized until this Permit is reviewed for reauthorization.",
    };
  }
  return {
    ...none,
    nextTitle: "NO FURTHER ACTION",
    nextDetail: "Station samples are not plant records.",
  };
}

function preparationGapLabels(input: { scope: boolean; order: boolean; hazards: boolean; ppeReady: boolean }) {
  const gaps: string[] = [];
  if (!input.scope) gaps.push("Scope");
  if (!input.order) gaps.push("Work order");
  if (!input.hazards) gaps.push("Hazards");
  if (!input.ppeReady) gaps.push("PPE");
  return gaps;
}

export function safeDiagnostic(entries: { label: string; value: string }[]): { label: string; value: string }[] {
  return entries.filter((entry) => !secret(entry.label) && !secret(entry.value));
}

function secret(value: string): boolean {
  const text = value.toLowerCase();
  return text.includes("password") || text.includes("connection string") || text.includes("private key") || text.includes("pinhash") || text.includes("bearer ") || text.includes("tokenhash");
}
