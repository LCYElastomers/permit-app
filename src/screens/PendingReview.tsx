import { usePermits } from "../state/PermitStore";
import { permitType } from "../permitTypes";
import { kindShort, kindTitle } from "../workflow";
import { Kv, ScreenHead, StateMark } from "../components/ui";
import { PlantRefresh, stationSamplePermits, useAuthoritativePermits } from "../services/plantLists";

const PENDING_STATUSES = ["PENDING_REVIEW", "AUTHORIZED"];

export function PendingReview() {
  const { permits, drafts, openPermit, openStoredPermit, openPlantPermit } = usePermits();
  const { plant, refresh, ready } = useAuthoritativePermits(PENDING_STATUSES);
  const plantNumbers = new Set(plant.map((permit) => permit.id));
  const real = drafts.filter((draft) => draft.lifecycleStatus === "PENDING_REVIEW" && !(draft.permitNumber && plantNumbers.has(draft.permitNumber)));
  const pending = stationSamplePermits(permits, "pending")
    .slice()
    .sort((a, b) => b.id.localeCompare(a.id));

  return (
    <div className="screen">
      <ScreenHead
        kicker="OPERATIONS"
        title="Pending Review"
        meta={`${plant.length} PLANT RECORDS · ${real.length} ON THIS DEVICE · ${pending.length} STATION SAMPLES`}
      />
      <PlantRefresh ready={ready} onRefresh={() => void refresh()} />
      {plant.map((permit) => (
        <button key={permit.serverPermitId} type="button" className="permit-row" onClick={() => openPlantPermit(permit, "pending")}>
          <div className="row-top">
            <span className="pid mono">{permit.id}</span>
            <span className="kind">{kindTitle(permit.kind)}</span>
            <span className="row-status"><span className="screen-meta">{permit.plantRecord?.status === "AUTHORIZED" ? "AUTHORIZED · NOT ACTIVE FOR WORK" : "PENDING REVIEW"}</span></span>
          </div>
          <div className="row-work">{permit.work}</div>
        </button>
      ))}
      {real.map((draft) => (
        <button key={draft.id} type="button" className="permit-row" onClick={() => openStoredPermit(draft.id, "pending")}>
          <div className="row-top">
            <span className="pid mono">{draft.permitNumber ?? "LOCAL"}</span>
            <span className="kind">{kindTitle(draft.kind)}</span>
            <span className="row-status"><span className="screen-meta">PENDING REVIEW</span></span>
          </div>
          <div className="row-work">{draft.description || "Job description not entered"}</div>
        </button>
      ))}
      {plant.length === 0 && real.length === 0 && pending.length === 0 ? (
        <p className="empty">No permits are waiting for review.</p>
      ) : null}
      {pending.length > 0 ? <p className="empty tight">Station samples below are not plant records.</p> : null}
      {pending.length === 0 ? null : (
        pending.map((permit) => {
          const outstanding = permit.signoffs.filter((signoff) => signoff.state === "outstanding");
          const signed = permit.signoffs.filter((signoff) => signoff.state === "signed");
          const place =
            permitType(permit.kind).place === "location" ? permit.location || permit.equipment : permit.equipment || permit.location;
          return (
            <button
              key={permit.id}
              type="button"
              className="permit-row is-pending"
              onClick={() => openPermit(permit.id, "pending")}
            >
              <div className="row-top">
                <span className="pid mono">{permit.id}</span>
                <span className="kind">{kindShort(permit.kind)}</span>
                <span className="row-status">
                  <span className="soon-tag">
                    {outstanding.length} OUTSTANDING
                  </span>
                  <StateMark status={permit.status} />
                </span>
              </div>
              <div className="row-work">{permit.work}</div>
              <div className="row-fields">
                <div className="row-band">
                  <Kv label="Area" value={permit.area} />
                  <Kv label={permitType(permit.kind).place === "location" ? "Location" : "Equipment"} value={place} mono />
                  <Kv label="Work Order" value={permit.workOrder} mono />
                </div>
                <div className="row-band">
                  <Kv label="Company" value={permit.company} />
                  <Kv label="Requester" value={permit.requester || permit.requesterGroup} />
                  <Kv label="Signed" value={`${signed.length} of ${permit.signoffs.length}`} />
                </div>
              </div>
              <div className="sig-row">
                {permit.signoffs.map((signoff) => (
                  <span key={signoff.role} className={signoff.state === "signed" ? "sig ok" : "sig wait"}>
                    {signoff.role}
                    {signoff.state === "signed" ? ` ${signoff.time}` : " — OUTSTANDING"}
                  </span>
                ))}
              </div>
            </button>
          );
        })
      )}
    </div>
  );
}
