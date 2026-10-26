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
  actingRole: "PERMIT_AUTHORIZER" | "CRAFT_RECEIVER" | null;
  requiredAuthority: string | null;
  blocked: string | null;
  readiness: ReadinessItem[];
}

export function plantStatusCopy(status: string): { title: string; detail: string; workAuthorized: boolean } {
  if (status === "ACTIVE") return { title: "ACTIVE", detail: "WORK AUTHORIZED", workAuthorized: true };
  if (status === "AUTHORIZED") return { title: "AUTHORIZED", detail: "NOT ACTIVE FOR WORK", workAuthorized: false };
  if (status === "PENDING_REVIEW") return { title: "PENDING REVIEW", detail: "NOT AUTHORIZED FOR WORK", workAuthorized: false };
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
}): LifecyclePrompt {
  const status = plantStatusCopy(input.status);
  const authorizer = input.approvals.some((item) => item.actingRole === "PERMIT_AUTHORIZER");
  const receiver = input.approvals.some((item) => item.actingRole === "CRAFT_RECEIVER");
  const scope = input.jobDescription.trim().length > 0;
  const order = input.workOrder.trim().length > 0;
  const hazards = input.hazards.length > 0;
  const controls = input.controls.length > 0;
  const ppe = input.ppe.length > 0;
  const modules = input.modules.length > 0;
  const people = input.missing.length === 0;
  const readiness: ReadinessItem[] = [
    { label: "Scope", state: scope ? "COMPLETE" : "INCOMPLETE" },
    { label: "Work order", state: order ? "COMPLETE" : "INCOMPLETE" },
    { label: "Hazards", state: hazards ? "COMPLETE" : "INCOMPLETE" },
    { label: "Controls", state: controls ? "COMPLETE" : "INCOMPLETE" },
    { label: "PPE", state: ppe ? "COMPLETE" : "INCOMPLETE" },
    { label: "Required modules", state: modules ? "COMPLETE" : "INCOMPLETE" },
    { label: "Required people", state: people ? "COMPLETE" : "INCOMPLETE" },
    { label: "Permit authorizer", state: authorizer ? "COMPLETE" : "PENDING" },
    { label: "Craft receiver", state: receiver ? "COMPLETE" : "PENDING" },
  ];
  const preparationBlocked = !scope || !order || !hazards;
  const selfBlocked = !input.allowSelfAuthorization && input.actorId !== null && input.actorId === input.createdBy;
  let action: LifecyclePrompt["action"] = null;
  let actingRole: LifecyclePrompt["actingRole"] = null;
  let nextTitle = "No further action";
  let nextDetail = "This permit has no pending lifecycle action.";
  let requiredAuthority: string | null = null;
  let blocked: string | null = null;

  if (input.status === "PENDING_REVIEW") {
    nextTitle = "AUTHORIZE PERMIT";
    requiredAuthority = "PERMIT AUTHORIZER";
    if (!input.canAuthorize) {
      nextDetail = "Permit authorization required";
      blocked = "Required authority: PERMIT AUTHORIZER";
    } else if (preparationBlocked) {
      nextDetail = "Permit preparation is incomplete";
      blocked = "Scope, work order, and hazards must be complete before authorization.";
    } else if (selfBlocked) {
      nextDetail = "Self-authorization is not allowed";
      blocked = "You cannot authorize a permit you created or submitted.";
    } else {
      nextDetail = "Confirm your Permit Control PIN to authorize this permit.";
      action = "authorize";
      actingRole = "PERMIT_AUTHORIZER";
    }
  } else if (input.status === "AUTHORIZED" && !receiver) {
    nextTitle = "CRAFT / PERMIT RECEIVER ACCEPTANCE";
    requiredAuthority = "CRAFT RECEIVER";
    if (!input.canAccept) {
      nextDetail = "Craft / permit receiver acceptance required";
      blocked = "Required authority: CRAFT RECEIVER";
    } else {
      nextDetail = "Confirm your Permit Control PIN to accept this permit.";
      action = "accept";
      actingRole = "CRAFT_RECEIVER";
    }
  } else if (input.status === "AUTHORIZED" && receiver) {
    nextTitle = "READY TO ACTIVATE";
    if (!people) {
      nextDetail = "Required qualifications are still missing";
      blocked = input.missing.join(", ");
    } else if (input.canAuthorize || input.canAccept) {
      nextDetail = "Confirm your Permit Control PIN to activate this permit.";
      action = "activate";
      actingRole = input.canAccept ? "CRAFT_RECEIVER" : "PERMIT_AUTHORIZER";
    } else {
      nextDetail = "Activation requires a permit authorizer or craft receiver";
      blocked = "Required authority: PERMIT AUTHORIZER or CRAFT RECEIVER";
    }
  } else if (input.status === "ACTIVE") {
    nextTitle = "WORK AUTHORIZED";
    nextDetail = "This permit is active.";
  }

  return { ...status, nextTitle, nextDetail, action, actingRole, requiredAuthority, blocked, readiness };
}

export function safeDiagnostic(entries: { label: string; value: string }[]): { label: string; value: string }[] {
  return entries.filter((entry) => !secret(entry.label) && !secret(entry.value));
}

function secret(value: string): boolean {
  const text = value.toLowerCase();
  return text.includes("password") || text.includes("connection string") || text.includes("private key") || text.includes("pinhash") || text.includes("bearer ") || text.includes("tokenhash");
}
