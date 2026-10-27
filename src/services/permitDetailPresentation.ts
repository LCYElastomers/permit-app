/** Presentation for Permit Detail. Stored timestamps and identity codes stay unchanged. */

const QUALIFICATIONS: Record<string, string> = {
  GAS_TESTER: "Gas Tester",
  FIRE_WATCH: "Fire Watch",
  ATTENDANT: "Attendant",
  AUTHORIZED_ENTRANT: "Authorized Entrant",
  COMPETENT_PERSON: "Competent Person",
  QUALIFIED_ELECTRICAL_WORKER: "Qualified Electrical Worker",
  SAFETY_WATCH: "Safety Watch",
};

const HISTORY_ACTIONS: Record<string, string> = {
  SUBMITTED: "Submitted for review",
  PERMIT_SUBMITTED: "Submitted for review",
  AUTHORIZED: "Permit authorized",
  PERMIT_AUTHORIZED: "Permit authorized",
  ACCEPTED: "Permit accepted",
  PERMIT_ACCEPTED: "Permit accepted",
  ACTIVATED: "Permit activated",
  PERMIT_ACTIVATED: "Permit activated",
  PERMIT_RETURNED_FOR_CORRECTION: "Returned for correction",
  RETURNED_FOR_CORRECTION: "Returned for correction",
  SUSPENDED: "Permit suspended",
  PERMIT_SUSPENDED: "Permit suspended",
  REAUTHORIZED: "Permit reauthorized",
  PERMIT_REAUTHORIZED: "Permit reauthorized",
};

export interface ApprovalFact {
  actingRole: string;
  displayName: string;
  permitUserCode: string;
  at: string | null;
  decision?: string | null;
  revision?: number | null;
  userId?: string | null;
}

export interface HistoryFact {
  revision: number | null;
  action: string;
  person: string;
  at: string | null;
  permitUserCode: string | null;
  userId: string | null;
}

export function qualificationLabel(code: string): string {
  if (QUALIFICATIONS[code]) return QUALIFICATIONS[code];
  return code
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

/** Device-local reading of an authoritative UTC timestamp. No plant timezone is configured. */
export function permitWhen(value: string | null | undefined): string {
  if (!value) return "";
  if (!value.includes("T")) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function approvalActionLabel(decision: string | null | undefined, actingRole: string): string {
  const known = HISTORY_ACTIONS[(decision ?? "").toUpperCase()];
  if (known) return known;
  if (actingRole === "PERMIT_AUTHORIZER") return "Permit authorized";
  if (actingRole === "CRAFT_RECEIVER") return "Permit accepted";
  return qualificationLabel(actingRole);
}

export function rolePresentation(actingRole: string): { role: string; verb: string } {
  if (actingRole === "PERMIT_AUTHORIZER") return { role: "Permit Authorizer", verb: "Authorized" };
  if (actingRole === "CRAFT_RECEIVER") return { role: "Permit Receiver", verb: "Accepted" };
  return { role: qualificationLabel(actingRole), verb: "Confirmed" };
}

export function summaryLine(actingRole: string, name: string, at: string | null): string {
  const presented = rolePresentation(actingRole);
  const when = permitWhen(at);
  return when ? `${presented.role}: ${name} | ${presented.verb}: ${when}` : `${presented.role}: ${name}`;
}

export function currentAuthorization(approvals: ApprovalFact[], revision: number): ApprovalFact[] {
  const hasRevision = approvals.some((item) => (item.revision ?? 0) > 0);
  const pool = hasRevision ? approvals.filter((item) => item.revision === revision) : approvals;
  const preferred = ["PERMIT_AUTHORIZER", "CRAFT_RECEIVER"];
  const roles = [...preferred, ...pool.map((item) => item.actingRole)].filter((role, index, all) => all.indexOf(role) === index);
  return roles
    .map((role) =>
      [...pool]
        .filter((item) => item.actingRole === role && item.decision !== "RETURNED_FOR_CORRECTION")
        .sort((left, right) => (right.at ?? "").localeCompare(left.at ?? ""))[0] ?? null,
    )
    .filter((item): item is ApprovalFact => item !== null);
}

export function authorizationHistory(approvals: ApprovalFact[], recorded?: HistoryFact[] | null): HistoryFact[] {
  const source = recorded && recorded.length > 0
    ? recorded
    : approvals.map((item) => ({
        revision: item.revision ?? null,
        action: approvalActionLabel(item.decision, item.actingRole),
        person: item.displayName,
        at: item.at,
        permitUserCode: item.permitUserCode || null,
        userId: item.userId ?? null,
      }));
  return [...source].sort((left, right) => (right.revision ?? 0) - (left.revision ?? 0) || (right.at ?? "").localeCompare(left.at ?? ""));
}

export function revisionLabel(revision: number | null): string {
  if (revision === null || revision <= 0) return "";
  return `REV ${String(revision).padStart(2, "0")}`;
}
