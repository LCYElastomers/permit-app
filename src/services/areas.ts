const AREA_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface AreaRecord {
  id: string;
  name: string;
}

export type AreaCatalog =
  | { status: "loading" }
  | { status: "ready"; areas: AreaRecord[] }
  | { status: "unavailable" };

export function parseAreaList(value: unknown): AreaRecord[] | null {
  if (!Array.isArray(value)) return null;
  const areas: AreaRecord[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const record = item as Record<string, unknown>;
    if (typeof record.id !== "string" || !AREA_ID.test(record.id)) return null;
    if (typeof record.name !== "string") return null;
    const name = record.name.trim();
    if (!name) return null;
    areas.push({ id: record.id, name });
  }
  return areas;
}

export function areaIdForName(areas: AreaRecord[], name: string): string {
  return areas.find((area) => area.name === name)?.id ?? "";
}
