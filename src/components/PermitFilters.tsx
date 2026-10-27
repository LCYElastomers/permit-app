import { useMemo, useState } from "react";
import { usePlantClock } from "../plantClock";
import { plantSnapshot } from "../plantStatus";
import { usePermits } from "../state/PermitStore";
import type { PermitKind } from "../types";
import { kindShort } from "../workflow";

export type PermitFilter = "active" | "pending" | "suspended" | "expiring";

export function PermitStatusFilters({ current }: { current: PermitFilter }) {
  const { permits, go, showActive } = usePermits();
  const clock = usePlantClock();
  const snap = plantSnapshot(permits, clock.hm);
  const items: { id: PermitFilter; label: string; count: number; tone: string; open: () => void }[] = [
    { id: "active", label: "ACTIVE", count: snap.active, tone: "ok", open: () => showActive("all") },
    { id: "pending", label: "PENDING", count: snap.pending, tone: "warn", open: () => go("pending") },
    { id: "suspended", label: "SUSPENDED", count: snap.suspended, tone: "alert", open: () => go("suspended") },
    { id: "expiring", label: "EXPIRING", count: snap.expiring, tone: "warn", open: () => showActive("expiring") },
  ];
  return (
    <div className="permit-filters" role="tablist" aria-label="Permit status">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={current === item.id}
          className={current === item.id ? `permit-filter on tone-${item.tone}` : `permit-filter tone-${item.tone}`}
          onClick={item.open}
        >
          <span>{item.label}</span>
          <span className="count">{item.count}</span>
        </button>
      ))}
    </div>
  );
}

export interface BrowseRow {
  area: string;
  kind: string;
  company: string;
  text: string[];
}

export function usePermitBrowse() {
  const [query, setQuery] = useState("");
  const [area, setArea] = useState("");
  const [kind, setKind] = useState("");
  const [company, setCompany] = useState("");
  const accept = (row: BrowseRow) => {
    if (area && row.area !== area) return false;
    if (kind && row.kind !== kind) return false;
    if (company && row.company !== company) return false;
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return row.text.join(" ").toLowerCase().includes(needle);
  };
  return { query, setQuery, area, setArea, kind, setKind, company, setCompany, accept };
}

export function PermitBrowseBar({
  query,
  area,
  kind,
  company,
  rows,
  onQuery,
  onArea,
  onKind,
  onCompany,
}: {
  query: string;
  area: string;
  kind: string;
  company: string;
  rows: BrowseRow[];
  onQuery: (value: string) => void;
  onArea: (value: string) => void;
  onKind: (value: string) => void;
  onCompany: (value: string) => void;
}) {
  const areas = useMemo(() => unique(rows.map((row) => row.area)), [rows]);
  const kinds = useMemo(() => unique(rows.map((row) => row.kind)), [rows]);
  const companies = useMemo(() => unique(rows.map((row) => row.company)), [rows]);
  return (
    <div className="permit-browse">
      <input
        type="search"
        className="permit-search"
        placeholder="Search permits..."
        aria-label="Search permits"
        value={query}
        onChange={(event) => onQuery(event.target.value)}
      />
      <select aria-label="Area" value={area} onChange={(event) => onArea(event.target.value)}>
        <option value="">Area</option>
        {areas.map((item) => (
          <option key={item} value={item}>{item}</option>
        ))}
      </select>
      <select aria-label="Permit type" value={kind} onChange={(event) => onKind(event.target.value)}>
        <option value="">Permit Type</option>
        {kinds.map((item) => (
          <option key={item} value={item}>{kindShort(item as PermitKind)}</option>
        ))}
      </select>
      <select aria-label="Company" value={company} onChange={(event) => onCompany(event.target.value)}>
        <option value="">Company</option>
        {companies.map((item) => (
          <option key={item} value={item}>{item}</option>
        ))}
      </select>
    </div>
  );
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}
