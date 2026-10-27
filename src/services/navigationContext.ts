import type { ListScreen } from "../types";

export type PermitWorkspaceStatus = "active" | "pending" | "suspended" | "expiring";

export type MemoryKey = PermitWorkspaceStatus | "drafts" | "archive";

export type OriginKey = MemoryKey | "command" | "equipment" | "contractors" | "templates" | "permits";

export interface ListMemory {
  query: string;
  area: string;
  kind: string;
  company: string;
  year: string;
  status: string;
  sort: string;
  scroll: number;
}

export interface NavigationOrigin {
  key: OriginKey;
  route: ListScreen;
  permitStatus: PermitWorkspaceStatus | null;
  memory: ListMemory;
  captured: boolean;
}

export interface BackPresentation {
  label: string;
  shortLabel: string;
  trail: string[];
  route: ListScreen;
  permitStatus: PermitWorkspaceStatus | null;
}

export function blankMemory(sort = ""): ListMemory {
  return { query: "", area: "", kind: "", company: "", year: "", status: "", sort, scroll: 0 };
}

export function defaultSort(key: string): string {
  if (key === "pending" || key === "suspended") return "id-desc";
  if (key === "archive") return "issued-desc";
  if (key === "drafts") return "updated-desc";
  return "started-desc";
}

export function initialMemories(): Record<MemoryKey, ListMemory> {
  const keys: MemoryKey[] = ["active", "pending", "suspended", "expiring", "drafts", "archive"];
  return Object.fromEntries(keys.map((key) => [key, blankMemory(defaultSort(key))])) as Record<MemoryKey, ListMemory>;
}

export function applyMemory(memory: ListMemory, patch: Partial<ListMemory>): ListMemory {
  return { ...memory, ...patch };
}

export function bySort(sort: string, left: { id: string; started?: string; issuedKey?: string }, right: { id: string; started?: string; issuedKey?: string }): number {
  if (sort === "id-desc") return right.id.localeCompare(left.id);
  if (sort === "issued-desc") return (right.issuedKey ?? "").localeCompare(left.issuedKey ?? "") || right.id.localeCompare(left.id);
  return (right.started ?? "").localeCompare(left.started ?? "") || right.id.localeCompare(left.id);
}

export function resolveNavigationOrigin(
  from: ListScreen | "expiring",
  memories: Partial<Record<MemoryKey, ListMemory>>,
  scroll: number,
): NavigationOrigin {
  const permitStatus: PermitWorkspaceStatus | null =
    from === "active" || from === "pending" || from === "suspended" || from === "expiring" ? from : null;
  const route: ListScreen = from === "expiring" ? "active" : from;
  const named = from === "expiring" ? null : namedOrigin(from);
  const key: OriginKey = permitStatus ?? named ?? "permits";
  const stored = isMemoryKey(key) ? memories[key] ?? blankMemory(defaultSort(key)) : blankMemory();
  return {
    key,
    route,
    permitStatus,
    memory: { ...stored, scroll },
    captured: key !== "permits",
  };
}

export function backPresentation(origin: NavigationOrigin | null, compact: boolean): BackPresentation {
  if (!origin?.captured) {
    return { label: "BACK TO PERMITS", shortLabel: "PERMITS", trail: ["Permits"], route: "active", permitStatus: null };
  }
  const named = destinationCopy(origin);
  return {
    label: compact ? named.shortLabel : `BACK TO ${named.shortLabel}`,
    shortLabel: named.shortLabel,
    trail: named.trail,
    route: origin.route,
    permitStatus: origin.permitStatus,
  };
}

export function stillListed(origin: PermitWorkspaceStatus, status: string): boolean {
  const value = status.toUpperCase();
  if (origin === "pending") return value === "PENDING" || value === "PENDING_REVIEW" || value === "AUTHORIZED";
  if (origin === "suspended") return value === "SUSPENDED";
  if (origin === "active" || origin === "expiring") return value === "ACTIVE";
  return true;
}

export function statusMoveNotice(origin: NavigationOrigin | null, status: string): { message: string; label: string } | null {
  if (!origin?.captured || !origin.permitStatus || stillListed(origin.permitStatus, status)) return null;
  if (status.toUpperCase() === "ACTIVE") return { message: "Permit moved to Active.", label: "VIEW ACTIVE PERMITS" };
  return null;
}

export function administrationReturn(input: {
  section: string;
  typeCode: string | null;
  formSection: string | null;
}): { label: string; target: "home" | "types" | "forms" } | null {
  if (input.section === "home") return null;
  if (input.section === "types" && input.typeCode) return { label: "Permit Types", target: "types" };
  if (input.section === "forms" && input.formSection) return { label: "Workflow sections", target: "forms" };
  if (input.section === "forms") return { label: "Permit Types", target: "types" };
  if (input.section === "types") return { label: "Administration", target: "home" };
  return { label: "Administration", target: "home" };
}

function destinationCopy(origin: NavigationOrigin): { shortLabel: string; trail: string[] } {
  switch (origin.key) {
    case "active":
      return { shortLabel: "ACTIVE PERMITS", trail: ["Permits", "Active"] };
    case "pending":
      return { shortLabel: "PENDING PERMITS", trail: ["Permits", "Pending Review"] };
    case "suspended":
      return { shortLabel: "SUSPENDED PERMITS", trail: ["Permits", "Suspended"] };
    case "expiring":
      return { shortLabel: "EXPIRING PERMITS", trail: ["Permits", "Expiring"] };
    case "drafts":
      return { shortLabel: "DRAFTS", trail: ["Drafts"] };
    case "archive":
      return { shortLabel: "ARCHIVE", trail: ["Archive"] };
    case "command":
      return { shortLabel: "COMMAND CENTER", trail: ["Command Center"] };
    case "equipment":
      return { shortLabel: "EQUIPMENT", trail: ["Equipment"] };
    case "contractors":
      return { shortLabel: "CONTRACTORS", trail: ["Contractors"] };
    case "templates":
      return { shortLabel: "TEMPLATES", trail: ["Templates"] };
    default:
      return { shortLabel: "PERMITS", trail: ["Permits"] };
  }
}

function isMemoryKey(key: OriginKey): key is MemoryKey {
  return key === "active" || key === "pending" || key === "suspended" || key === "expiring" || key === "drafts" || key === "archive";
}

function namedOrigin(from: ListScreen): OriginKey | null {
  if (from === "drafts" || from === "archive" || from === "command" || from === "equipment" || from === "contractors" || from === "templates") return from;
  return null;
}
