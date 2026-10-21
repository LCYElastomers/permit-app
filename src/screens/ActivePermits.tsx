import { useState } from "react";
import { usePlantClock } from "../plantClock";
import { usePermits } from "../state/PermitStore";
import type { Permit } from "../types";
import { expiryState, kindShort } from "../workflow";
import { Kv, ScreenHead, StateMark } from "../components/ui";

export function ActivePermits() {
  const { permits, openPermit, go } = usePermits();
  const clock = usePlantClock();
  const [mode, setMode] = useState<"all" | "expiring">("all");

  const active = permits
    .filter((permit) => permit.status === "active")
    .slice()
    .sort((a, b) => b.started.localeCompare(a.started));
  const pending = permits.filter((permit) => permit.status === "pending").length;
  const suspended = permits.filter((permit) => permit.status === "suspended").length;
  const expiring = active.filter((permit) => expiryState(permit.expires, clock.hm) !== "ok").length;
  const shown = mode === "expiring" ? active.filter((permit) => expiryState(permit.expires, clock.hm) !== "ok") : active;

  return (
    <div className="screen">
      <div className="sticky-head">
        <ScreenHead kicker="OPERATIONS" title="Active Permits" meta={`SHIFT B · ${shown.length} SHOWN`} />
        <div className="metrics">
          <button type="button" className={mode === "all" ? "metric on" : "metric"} onClick={() => setMode("all")}>
            <span className="metric-value">{active.length}</span>
            <span className="metric-label">Active</span>
          </button>
          <button type="button" className="metric" onClick={() => go("pending")}>
            <span className="metric-value">{pending}</span>
            <span className="metric-label">Pending Review</span>
          </button>
          <button type="button" className="metric" onClick={() => go("suspended")}>
            <span className="metric-value">{suspended}</span>
            <span className="metric-label">Suspended</span>
          </button>
          <button
            type="button"
            className={mode === "expiring" ? "metric on" : "metric"}
            onClick={() => setMode("expiring")}
          >
            <span className="metric-value">{expiring}</span>
            <span className="metric-label">Expiring Soon</span>
          </button>
        </div>
      </div>
      {shown.length === 0 ? (
        <p className="empty">No active permits in this view.</p>
      ) : (
        shown.map((permit) => (
          <PermitRow
            key={permit.id}
            permit={permit}
            expiry={expiryState(permit.expires, clock.hm)}
            onOpen={() => openPermit(permit.id, "active")}
          />
        ))
      )}
    </div>
  );
}

function PermitRow({
  permit,
  expiry,
  onOpen,
}: {
  permit: Permit;
  expiry: "ok" | "soon" | "overdue" | "none";
  onOpen: () => void;
}) {
  const placeLabel = permit.kind === "excavation" ? "Location" : "Equipment";
  const place = permit.kind === "excavation" ? permit.location || permit.equipment : permit.equipment || permit.location;
  const rail = expiry === "overdue" ? "is-overdue" : expiry === "soon" ? "is-soon" : "";

  return (
    <button type="button" className={`permit-row ${rail}`.trim()} onClick={onOpen}>
      <div className="row-top">
        <span className="pid mono">{permit.id}</span>
        <span className="kind">{kindShort(permit.kind)}</span>
        <span className="row-status">
          {expiry === "soon" ? <span className="soon-tag">EXPIRING</span> : null}
          {expiry === "overdue" ? <span className="soon-tag overdue">OVERDUE</span> : null}
          <StateMark status={permit.status} />
        </span>
      </div>
      <div className="row-work">{permit.work}</div>
      <div className="row-fields">
        <Kv label="Area" value={permit.area} />
        <Kv label={placeLabel} value={place} mono />
        <Kv label="Work Order" value={permit.workOrder} mono />
        <Kv label="Company" value={permit.company} />
        <Kv label="Requester" value={permit.requesterGroup || permit.requester} />
        <Kv label="Started" value={permit.started} mono />
        <Kv label="Expires" value={permit.expires} mono />
      </div>
    </button>
  );
}
