import { usePlantClock } from "../plantClock";
import { usePermits } from "../state/PermitStore";
import type { Permit } from "../types";
import { permitType } from "../permitTypes";
import { expiryLabel, expiryState, kindShort, kindTitle } from "../workflow";
import { Kv, ScreenHead } from "../components/ui";
import { PlantRefresh, stationSamplePermits, useAuthoritativePermits } from "../services/plantLists";

export function ActivePermits() {
  const { permits, drafts, openPermit, openStoredPermit, openPlantPermit, go, showActive, listArea, activeView } = usePermits();
  const { plant, refresh, ready } = useAuthoritativePermits(["ACTIVE"]);
  const plantNumbers = new Set(plant.map((permit) => permit.id));
  const real = drafts.filter((draft) => draft.lifecycleStatus === "ACTIVE" && !(draft.permitNumber && plantNumbers.has(draft.permitNumber)));
  const clock = usePlantClock();

  const active = stationSamplePermits(permits, "active")
    .filter((permit) => (listArea ? permit.area === listArea : true))
    .slice()
    .sort((a, b) => b.started.localeCompare(a.started));
  const pending = permits.filter((permit) => permit.status === "pending").length;
  const suspended = permits.filter((permit) => permit.status === "suspended").length;
  const expiring = permits.filter(
    (permit) => permit.status === "active" && expiryState(permit.expires, clock.hm) !== "ok" && (listArea ? permit.area === listArea : true),
  ).length;
  const shown = activeView === "expiring" ? active.filter((permit) => expiryState(permit.expires, clock.hm) !== "ok") : active;

  return (
    <div className="screen">
      <div className="sticky-head">
        <ScreenHead
          kicker="OPERATIONS"
          title="Active Permits"
          meta={listArea ? `${listArea.toUpperCase()} · ${shown.length} SHOWN` : `SHIFT B · ${shown.length} SHOWN`}
        />
        <PlantRefresh ready={ready} onRefresh={() => void refresh()} />
        {listArea ? (
          <div className="list-filter">
            <span>
              Area <strong>{listArea}</strong>
            </span>
            <button type="button" className="btn btn-ghost" onClick={() => showActive("all")}>
              Clear
            </button>
          </div>
        ) : null}
        <div className="metrics">
          <button type="button" className={activeView === "all" ? "metric on" : "metric"} onClick={() => showActive("all", listArea)}>
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
            className={activeView === "expiring" ? "metric on" : "metric"}
            onClick={() => showActive("expiring", listArea)}
          >
            <span className="metric-value">{expiring}</span>
            <span className="metric-label">Expiring Soon</span>
          </button>
        </div>
      </div>
      {plant.map((permit) => (
        <button key={permit.serverPermitId} type="button" className="permit-row" onClick={() => openPlantPermit(permit, "active")}>
          <div className="row-top">
            <span className="pid mono">{permit.id}</span>
            <span className="kind">{kindTitle(permit.kind)}</span>
            <span className="row-status"><span className="screen-meta">ACTIVE · WORK AUTHORIZED</span></span>
          </div>
          <div className="row-work">{permit.work}</div>
        </button>
      ))}
      {real.map((draft) => (
        <button key={draft.id} type="button" className="permit-row" onClick={() => openStoredPermit(draft.id, "active")}>
          <div className="row-top">
            <span className="pid mono">{draft.permitNumber ?? "LOCAL"}</span>
            <span className="kind">{kindTitle(draft.kind)}</span>
            <span className="row-status"><span className="screen-meta">ACTIVE</span></span>
          </div>
          <div className="row-work">{draft.description || "Job description not entered"}</div>
        </button>
      ))}
      {plant.length === 0 && real.length === 0 && shown.length === 0 ? (
        <p className="empty">No active permits in this view.</p>
      ) : null}
      {shown.length === 0 ? null : (
        shown.map((permit) => (
          <PermitRow
            key={permit.id}
            permit={permit}
            expiry={expiryState(permit.expires, clock.hm)}
            remaining={expiryLabel(permit.expires, clock.hm)}
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
  remaining,
  onOpen,
}: {
  permit: Permit;
  expiry: "ok" | "soon" | "overdue" | "none";
  remaining: string | null;
  onOpen: () => void;
}) {
  const prefersLocation = permitType(permit.kind).place === "location" || !permit.equipment;
  const placeLabel = prefersLocation ? "Location" : "Equipment";
  const place = prefersLocation ? permit.location || permit.equipment : permit.equipment;
  const rail = expiry === "overdue" ? "is-overdue" : expiry === "soon" ? "is-soon" : "";

  return (
    <button type="button" className={`permit-row ${rail}`.trim()} onClick={onOpen}>
      <div className="row-top">
        <span className="pid mono">{permit.id}</span>
        <span className="kind">{kindShort(permit.kind)}</span>
        <span className="row-status">
          {expiry === "soon" && remaining ? (
            <span className="expiry-flag">
              <strong>{remaining}</strong>
              <span>EXPIRING</span>
            </span>
          ) : null}
          {expiry === "overdue" ? (
            <span className="expiry-flag overdue">
              <strong>EXPIRED</strong>
              <span>WORK NOT AUTHORIZED</span>
            </span>
          ) : null}
        </span>
      </div>
      <div className="row-work">{permit.work}</div>
      <div className="row-fields">
        <div className="row-band">
          <Kv label="Area" value={permit.area} />
          <Kv label={placeLabel} value={place} mono />
          <Kv label="Work Order" value={permit.workOrder} mono />
        </div>
        <div className="row-band">
          <Kv label="Company" value={permit.company} />
          <Kv label="Requester" value={permit.requesterGroup || permit.requester} />
        </div>
        <div className="row-band row-window">
          <Kv label="Started" value={permit.started} mono />
          <Kv label="Expires" value={permit.expires} mono />
        </div>
      </div>
    </button>
  );
}
