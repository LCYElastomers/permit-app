import { useMemo } from "react";
import { usePermits } from "../state/PermitStore";
import { PERMIT_TYPES } from "../permitTypes";
import { bySort } from "../services/navigationContext";
import { kindShort } from "../workflow";
import { ScreenHead, StateMark } from "../components/ui";

export function ArchiveScreen() {
  const { permits, openPermit, listMemory, patchListMemory } = usePermits();
  const memory = listMemory("archive");
  const query = memory.query;
  const type = memory.kind;
  const area = memory.area;
  const year = memory.year;
  const status = memory.status;
  const company = memory.company;

  const archived = useMemo(
    () => permits.filter((permit) => permit.status === "closed" || permit.status === "expired"),
    [permits],
  );

  const areas = unique(archived.map((permit) => permit.area));
  const years = unique(archived.map((permit) => String(permit.year))).sort((a, b) => b.localeCompare(a));
  const companies = unique(archived.map((permit) => permit.company));
  const statuses = unique(archived.map((permit) => permit.status));

  const filtered = archived
    .filter((permit) => {
      if (type && permit.kind !== type) return false;
      if (area && permit.area !== area) return false;
      if (year && String(permit.year) !== year) return false;
      if (status && permit.status !== status) return false;
      if (company && permit.company !== company) return false;
      const q = query.trim().toLowerCase();
      if (!q) return true;
      const hay = [
        permit.id,
        permit.equipment,
        permit.location,
        permit.workOrder,
        permit.work,
        permit.jobDescription,
        permit.company,
        permit.area,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    })
    .slice()
    .sort((a, b) => bySort(memory.sort, a, b));

  return (
    <div className="screen fill">
      <ScreenHead kicker="PERMITS" title="Archive" meta={`${filtered.length} OF ${archived.length}`} />
      <div className="filters">
        <label className="filter search">
          <span>Search</span>
          <input
            value={query}
            onChange={(event) => patchListMemory("archive", { query: event.target.value })}
            placeholder="Search permit ID, equipment, work order, scope..."
          />
        </label>
        <label className="filter">
          <span>Permit Type</span>
          <select value={type} onChange={(event) => patchListMemory("archive", { kind: event.target.value })}>
            <option value="">All</option>
            {PERMIT_TYPES.map((type) => (
              <option key={type.id} value={type.id}>
                {type.title}
              </option>
            ))}
          </select>
        </label>
        <label className="filter">
          <span>Area</span>
          <select value={area} onChange={(event) => patchListMemory("archive", { area: event.target.value })}>
            <option value="">All</option>
            {areas.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="filter">
          <span>Year</span>
          <select value={year} onChange={(event) => patchListMemory("archive", { year: event.target.value })}>
            <option value="">All</option>
            {years.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="filter">
          <span>Status</span>
          <select value={status} onChange={(event) => patchListMemory("archive", { status: event.target.value })}>
            <option value="">All</option>
            {statuses.map((item) => (
              <option key={item} value={item}>
                {item === "closed" ? "Closed" : "Expired"}
              </option>
            ))}
          </select>
        </label>
        <label className="filter">
          <span>Company</span>
          <select value={company} onChange={(event) => patchListMemory("archive", { company: event.target.value })}>
            <option value="">All</option>
            {companies.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="table-scroll">
        <table className="reg">
          <thead>
            <tr>
              <th>Permit</th>
              <th>Type</th>
              <th>Area / Equipment</th>
              <th>Work Order</th>
              <th>Scope</th>
              <th>Company</th>
              <th>Issued</th>
              <th>Closed</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="empty-cell">
                  No archive records match.
                </td>
              </tr>
            ) : (
              filtered.map((permit) => (
                <tr
                  key={permit.id}
                  tabIndex={0}
                  onClick={() => openPermit(permit.id, "archive", true)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openPermit(permit.id, "archive", true);
                    }
                  }}
                >
                  <td className="mono">{permit.id}</td>
                  <td>{kindShort(permit.kind)}</td>
                  <td>
                    {permit.area}
                    <span className="muted"> / </span>
                    <span className="mono">{permit.equipment || permit.location}</span>
                  </td>
                  <td className="mono">{permit.workOrder}</td>
                  <td className="clip">{permit.work}</td>
                  <td>{permit.company}</td>
                  <td className="mono">{permit.issued}</td>
                  <td className="mono">{permit.closed}</td>
                  <td>
                    <StateMark status={permit.status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}
