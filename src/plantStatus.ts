import type { Permit, PermitKind } from "./types";
import { expiryState, kindTitle, minutesUntil, parseHm } from "./workflow";

export const TODAY_KEY = "20261021";
export const TODAY_LABEL = "21 Oct 2026";

const KIND_ORDER: PermitKind[] = [
  "confined-space",
  "hot-work",
  "excavation",
  "opening-blinding",
  "live-electrical",
  "general",
];

export interface ControlModule {
  id: string;
  label: string;
  count: (permits: Permit[]) => number;
}

function active(permits: Permit[]): Permit[] {
  return permits.filter((permit) => permit.status === "active");
}

export function hasIsolation(permit: Permit): boolean {
  if (permit.isolation.required.trim().toLowerCase() === "yes") return true;
  return permit.precautions.some((item) => /loto|isolation/i.test(item));
}

export function isolationVerified(permit: Permit): boolean {
  const value = permit.isolation.zeroEnergy.trim();
  return value !== "" && value !== "—" && value !== "-";
}

export function needsAtmosphere(permit: Permit): boolean {
  if (permit.kind === "confined-space") return true;
  if (permit.readings.length > 0) return true;
  return permit.precautions.some((item) => /monitor/i.test(item));
}

export function needsFireWatch(permit: Permit): boolean {
  return permit.kind === "hot-work" || Boolean(permit.fireWatch.trim()) || permit.precautions.some((item) => /fire watch/i.test(item));
}

export function needsRescue(permit: Permit): boolean {
  return permit.kind === "confined-space" || Boolean(permit.attendant.trim()) || permit.precautions.some((item) => /rescue/i.test(item));
}

export const CONTROL_MODULES: ControlModule[] = [
  { id: "loto", label: "LOTO / ISOLATION", count: (permits) => active(permits).filter(hasIsolation).length },
  { id: "atmosphere", label: "ATMOSPHERIC MONITORING", count: (permits) => active(permits).filter(needsAtmosphere).length },
  { id: "fire-watch", label: "FIRE WATCH", count: (permits) => active(permits).filter(needsFireWatch).length },
  { id: "rescue", label: "RESCUE COVERAGE", count: (permits) => active(permits).filter(needsRescue).length },
];

export interface PlantSnapshot {
  active: number;
  pending: number;
  suspended: number;
  expiring: number;
  closedToday: number;
  issuedToday: number;
  contractors: number;
  areas: number;
}

export function plantSnapshot(permits: Permit[], nowHm: string): PlantSnapshot {
  const live = active(permits);
  const contractors = new Set(live.filter((permit) => permit.company !== "LCY").map((permit) => permit.company));
  const areas = new Set(live.map((permit) => permit.area));
  return {
    active: live.length,
    pending: permits.filter((permit) => permit.status === "pending").length,
    suspended: permits.filter((permit) => permit.status === "suspended").length,
    expiring: live.filter((permit) => expiryState(permit.expires, nowHm) !== "ok").length,
    closedToday: permits.filter((permit) => permit.status === "closed" && permit.closed === TODAY_LABEL).length,
    issuedToday: permits.filter((permit) => permit.issuedKey === TODAY_KEY).length,
    contractors: contractors.size,
    areas: areas.size,
  };
}

export function placeOf(permit: Permit): string {
  return permit.equipment || permit.location || "—";
}

export interface AttentionItem {
  id: string;
  tone: "alert" | "warn";
  kicker: string;
  kind: string;
  place: string;
  summary: string;
  meta: string;
}

function waitMinutes(permit: Permit, nowHm: string): number | null {
  const created = permit.history.find((event) => event.label === "CREATED")?.time;
  if (!created) return null;
  const start = parseHm(created);
  const now = parseHm(nowHm);
  if (start === null || now === null) return null;
  return now - start;
}

export function attentionItems(permits: Permit[], nowHm: string): AttentionItem[] {
  const items: AttentionItem[] = [];

  for (const permit of permits.filter((item) => item.status === "suspended")) {
    items.push({
      id: permit.id,
      tone: "alert",
      kicker: "SUSPENDED",
      kind: kindTitle(permit.kind),
      place: `${permit.area} / ${placeOf(permit)}`,
      summary: permit.suspension?.reason || permit.work,
      meta: permit.suspension?.time ? `Suspended ${permit.suspension.time}` : "Work not authorized",
    });
  }

  const expiring = active(permits)
    .filter((permit) => expiryState(permit.expires, nowHm) !== "ok")
    .sort((a, b) => (minutesUntil(a.expires, nowHm) ?? 0) - (minutesUntil(b.expires, nowHm) ?? 0));

  for (const permit of expiring) {
    const overdue = expiryState(permit.expires, nowHm) === "overdue";
    const remaining = minutesUntil(permit.expires, nowHm);
    items.push({
      id: permit.id,
      tone: overdue ? "alert" : "warn",
      kicker: overdue ? "EXPIRED" : "EXPIRING SOON",
      kind: kindTitle(permit.kind),
      place: `${permit.area} / ${placeOf(permit)}`,
      summary: permit.work,
      meta: overdue ? "WORK NOT AUTHORIZED" : `${remaining} MIN REMAINING`,
    });
  }

  const pending = permits
    .filter((permit) => permit.status === "pending")
    .slice()
    .sort((a, b) => (waitMinutes(b, nowHm) ?? 0) - (waitMinutes(a, nowHm) ?? 0));

  for (const permit of pending) {
    const waited = waitMinutes(permit, nowHm);
    items.push({
      id: permit.id,
      tone: "warn",
      kicker: "AWAITING AUTHORIZATION",
      kind: kindTitle(permit.kind),
      place: `${permit.area} / ${placeOf(permit)}`,
      summary: permit.work,
      meta: waited !== null && waited >= 0 ? `Pending authorization for ${waited} minutes` : "Pending authorization",
    });
  }

  return items;
}

export interface AreaLoad {
  area: string;
  active: number;
  expiring: number;
  pending: number;
  suspended: number;
}

const AREA_ORDER = ["Unit 1", "Unit 2", "Tank Farm", "Wastewater", "Utilities", "Dock", "Flare", "Warehouse"];

export function areaLoads(permits: Permit[], nowHm: string): AreaLoad[] {
  const names = AREA_ORDER.filter((area) => permits.some((permit) => permit.area === area && permit.status !== "closed" && permit.status !== "expired"));
  return names
    .map((area) => {
      const rows = permits.filter((permit) => permit.area === area);
      const live = rows.filter((permit) => permit.status === "active");
      return {
        area,
        active: live.length,
        expiring: live.filter((permit) => expiryState(permit.expires, nowHm) !== "ok").length,
        pending: rows.filter((permit) => permit.status === "pending").length,
        suspended: rows.filter((permit) => permit.status === "suspended").length,
      };
    })
    .filter((row) => row.active + row.pending + row.suspended > 0);
}

export function exposureByKind(permits: Permit[]): { kind: PermitKind; label: string; count: number }[] {
  const live = active(permits);
  return KIND_ORDER.map((kind) => ({
    kind,
    label: kindTitle(kind),
    count: live.filter((permit) => permit.kind === kind).length,
  }));
}

export interface ControlHealth {
  id: string;
  label: string;
  rows: { label: string; value: number; tone: "ok" | "warn" | "alert" | "idle" }[];
}

function readingAge(permit: Permit, nowHm: string): number | null {
  if (permit.readings.length === 0) return null;
  const latest = permit.readings[permit.readings.length - 1]?.time;
  const then = parseHm(latest ?? "");
  const now = parseHm(nowHm);
  if (then === null || now === null) return null;
  return Math.max(0, now - then);
}

export function controlHealth(permits: Permit[], nowHm: string): ControlHealth[] {
  const live = active(permits);
  const monitored = live.filter(needsAtmosphere);
  let approaching = 0;
  let overdue = 0;
  for (const permit of monitored) {
    const age = readingAge(permit, nowHm);
    if (age === null) continue;
    if (age >= 180) overdue += 1;
    else if (age >= 90) approaching += 1;
  }
  const current = monitored.length - approaching - overdue;

  const watches = live.filter(needsFireWatch);
  const confirmed = watches.filter((permit) => permit.fireWatch.trim()).length;
  const unresolved = watches.length - confirmed;

  const isolated = live.filter(hasIsolation);
  const verified = isolated.filter(isolationVerified).length;
  const exceptions = isolated.length - verified;

  return [
    {
      id: "atmosphere",
      label: "ATMOSPHERIC MONITORING",
      rows: [
        { label: "Required", value: monitored.length, tone: "idle" },
        { label: "Current", value: current, tone: "ok" },
        { label: "Approaching retest", value: approaching, tone: approaching > 0 ? "warn" : "idle" },
        { label: "Overdue", value: overdue, tone: overdue > 0 ? "alert" : "idle" },
      ],
    },
    {
      id: "fire-watch",
      label: "FIRE WATCH",
      rows: [
        { label: "Required", value: watches.length, tone: "idle" },
        { label: "Confirmed", value: confirmed, tone: "ok" },
        { label: "Unresolved", value: unresolved, tone: unresolved > 0 ? "alert" : "idle" },
      ],
    },
    {
      id: "isolation",
      label: "ISOLATION",
      rows: [
        { label: "Permits reference active isolation", value: isolated.length, tone: "idle" },
        { label: "Verified", value: verified, tone: "ok" },
        { label: "Exceptions", value: exceptions, tone: exceptions > 0 ? "alert" : "idle" },
      ],
    },
  ];
}

export interface LifecycleFigure {
  label: string;
  value: number;
}

export function lifecycle(permits: Permit[], nowHm: string): LifecycleFigure[] {
  const snap = plantSnapshot(permits, nowHm);
  const reauthorized = permits.filter((permit) => permit.history.some((event) => event.label.includes("REAUTHORIZED"))).length;
  const extended = permits.filter((permit) => permit.history.some((event) => event.label.includes("EXTENDED"))).length;
  const expiredWhileActive = active(permits).filter((permit) => expiryState(permit.expires, nowHm) === "overdue").length;
  return [
    { label: "ISSUED", value: snap.issuedToday },
    { label: "CURRENTLY ACTIVE", value: snap.active },
    { label: "CLOSED", value: snap.closedToday },
    { label: "PENDING", value: snap.pending },
    { label: "SUSPENDED", value: snap.suspended },
    { label: "REAUTHORIZED", value: reauthorized },
    { label: "EXTENDED", value: extended },
    { label: "EXPIRED WHILE ACTIVE", value: expiredWhileActive },
  ];
}

export interface FeedEvent {
  time: string;
  id: string;
  label: string;
  area: string;
  kind: string;
  place: string;
  note: string;
  tone: "neutral" | "alert" | "ok";
  readings?: { o2: string; lel: string; co: string };
}

export function recentActivity(permits: Permit[]): FeedEvent[] {
  const today = permits.filter(
    (permit) =>
      permit.status === "active" ||
      permit.status === "pending" ||
      permit.status === "suspended" ||
      permit.closed === TODAY_LABEL ||
      permit.issuedKey === TODAY_KEY,
  );
  const events: FeedEvent[] = [];
  for (const permit of today) {
    for (const event of permit.history) {
      if (/ATMOSPHERE/i.test(event.label)) continue;
      const suspended = event.label.includes("SUSPENDED");
      events.push({
        time: event.time,
        id: permit.id,
        label: event.label,
        area: permit.area,
        kind: kindTitle(permit.kind),
        place: placeOf(permit),
        note: suspended ? permit.suspension?.reason || "" : "",
        tone: suspended ? "alert" : event.tone,
      });
    }
    for (const reading of permit.readings) {
      events.push({
        time: reading.time,
        id: permit.id,
        label: `ATMOSPHERE TEST — ${reading.result}`,
        area: permit.area,
        kind: kindTitle(permit.kind),
        place: placeOf(permit),
        note: "",
        tone: reading.result === "PASS" ? "ok" : "alert",
        readings: { o2: reading.o2, lel: reading.lel, co: reading.co },
      });
    }
  }
  return events
    .filter((event) => parseHm(event.time) !== null)
    .sort((a, b) => b.time.localeCompare(a.time) || b.id.localeCompare(a.id))
    .slice(0, 8);
}

export interface HourBucket {
  hour: string;
  issued: number;
  active: number;
  closed: number;
}

export function dayActivity(permits: Permit[]): HourBucket[] {
  const buckets = new Map<string, HourBucket>();
  for (let hour = 6; hour <= 15; hour += 1) {
    const label = `${String(hour).padStart(2, "0")}`;
    buckets.set(label, { hour: label, issued: 0, active: 0, closed: 0 });
  }
  for (const permit of permits) {
    if (permit.issuedKey !== TODAY_KEY && permit.closed !== TODAY_LABEL && permit.status !== "active" && permit.status !== "pending" && permit.status !== "suspended") {
      continue;
    }
    for (const event of permit.history) {
      const hour = event.time.slice(0, 2);
      const bucket = buckets.get(hour);
      if (!bucket) continue;
      if (event.label.includes("AUTHORIZED")) bucket.issued += 1;
      else if (event.label === "ACTIVE" || event.label.startsWith("ACTIVE")) bucket.active += 1;
      else if (event.label.includes("CLOSED")) bucket.closed += 1;
    }
  }
  return [...buckets.values()];
}
