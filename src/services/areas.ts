const AREA_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const AREA_NAME_MAX = 120;

export interface AreaRecord {
  id: string;
  name: string;
}

export type AreaCatalog =
  | { status: "loading" }
  | { status: "ready"; areas: AreaRecord[] }
  | { status: "unsynchronized" }
  | { status: "storage-failed" };

export function parseAreaList(value: unknown): AreaRecord[] | null {
  if (!Array.isArray(value)) return null;
  const areas: AreaRecord[] = [];
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const record = item as Record<string, unknown>;
    if (typeof record.id !== "string" || !AREA_ID.test(record.id)) return null;
    if (typeof record.name !== "string") return null;
    const name = record.name.trim();
    if (!name || name.length > AREA_NAME_MAX) return null;
    const id = record.id.toLowerCase();
    if (ids.has(id) || names.has(name)) return null;
    ids.add(id);
    names.add(name);
    areas.push({ id: record.id, name });
  }
  return areas;
}

export function presentAreaCatalog(
  store: "checking" | "available" | "failed",
  areas: AreaRecord[] | null,
  referenceAreasSyncedAt: string | null,
): AreaCatalog {
  if (store === "failed") return { status: "storage-failed" };
  if (store === "checking" || areas === null) return { status: "loading" };
  if (areas.length === 0 && referenceAreasSyncedAt === null) return { status: "unsynchronized" };
  return { status: "ready", areas };
}

export function areaIdForName(areas: AreaRecord[], name: string): string {
  return areas.find((area) => area.name === name)?.id ?? "";
}
