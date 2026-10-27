import { usePermits } from "../state/PermitStore";
import { permitType } from "../permitTypes";
import { kindShort, kindTitle } from "../workflow";
import { Kv, ScreenHead, StateMark } from "../components/ui";
import { PermitBrowseBar, PermitStatusFilters, usePermitBrowse, type BrowseRow } from "../components/PermitFilters";
import { bySort } from "../services/navigationContext";
import { PlantRefresh, stationSamplePermits, useAuthoritativePermits } from "../services/plantLists";

const PENDING_STATUSES = ["PENDING_REVIEW", "AUTHORIZED"];

export function PendingReview() {
  const { permits, drafts, openPermit, openStoredPermit, openPlantPermit } = usePermits();
  const browse = usePermitBrowse("pending");
  const { plant, refresh, ready } = useAuthoritativePermits(PENDING_STATUSES);
  const plantNumbers = new Set(plant.map((permit) => permit.id));
  const real = drafts.filter((draft) => draft.lifecycleStatus === "PENDING_REVIEW" && !(draft.permitNumber && plantNumbers.has(draft.permitNumber)));
  const pending = stationSamplePermits(permits, "pending")
    .slice()
    .sort((a, b) => bySort(browse.sort, a, b));
  const plantShown = plant.filter((permit) => browse.accept(rowOf(permit.id, permit.kind, permit.area, permit.company, [permit.work, permit.workOrder, permit.equipment])));
  const realShown = real.filter((draft) => browse.accept(rowOf(draft.permitNumber ?? "", draft.kind, draft.area, "", [draft.description, draft.place, draft.workOrder])));
  const pendingShown = pending.filter((permit) => browse.accept(rowOf(permit.id, permit.kind, permit.area, permit.company, [permit.work, permit.jobDescription, permit.workOrder, permit.equipment, permit.location])));
  const browseRows: BrowseRow[] = [
    ...plant.map((permit) => rowOf(permit.id, permit.kind, permit.area, permit.company, [permit.work, permit.workOrder, permit.equipment])),
    ...real.map((draft) => rowOf(draft.permitNumber ?? "", draft.kind, draft.area, "", [draft.description, draft.place, draft.workOrder])),
    ...pending.map((permit) => rowOf(permit.id, permit.kind, permit.area, permit.company, [permit.work, permit.workOrder, permit.equipment])),
  ];

  return (
    <div className="screen">
      <ScreenHead
        kicker="OPERATIONS"
        title="Permits"
        meta={`${plantShown.length} PLANT RECORDS · ${realShown.length} ON THIS DEVICE · ${pendingShown.length} STATION SAMPLES`}
      />
      <PermitStatusFilters current="pending" />
      <PermitBrowseBar
        query={browse.query}
        area={browse.area}
        kind={browse.kind}
        company={browse.company}
        rows={browseRows}
        onQuery={browse.setQuery}
        onArea={browse.setArea}
        onKind={browse.setKind}
        onCompany={browse.setCompany}
      />
      <PlantRefresh ready={ready} onRefresh={() => void refresh()} />
      {plantShown.map((permit) => (
        <button key={permit.serverPermitId} type="button" className="permit-row" onClick={() => openPlantPermit(permit, "pending")}>
          <div className="row-top">
            <span className="pid mono">{permit.id}</span>
            <span className="kind">{kindTitle(permit.kind)}</span>
            <span className="row-status"><span className="screen-meta">{permit.plantRecord?.status === "AUTHORIZED" ? "AUTHORIZED · NOT ACTIVE FOR WORK" : "PENDING REVIEW"}</span></span>
          </div>
          <div className="row-work">{permit.work}</div>
        </button>
      ))}
      {realShown.map((draft) => (
        <button key={draft.id} type="button" className="permit-row" onClick={() => openStoredPermit(draft.id, "pending")}>
          <div className="row-top">
            <span className="pid mono">{draft.permitNumber ?? "LOCAL"}</span>
            <span className="kind">{kindTitle(draft.kind)}</span>
            <span className="row-status"><span className="screen-meta">PENDING REVIEW</span></span>
          </div>
          <div className="row-work">{draft.description || "Job description not entered"}</div>
        </button>
      ))}
      {plantShown.length === 0 && realShown.length === 0 && pendingShown.length === 0 ? (
        <p className="empty">No permits are waiting for review.</p>
      ) : null}
      {pendingShown.length > 0 ? <p className="empty tight">Station samples below are not plant records.</p> : null}
      {pendingShown.length === 0 ? null : (
        pendingShown.map((permit) => {
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

function rowOf(id: string, kind: string, area: string, company: string, text: string[]): BrowseRow {
  return { area, kind, company, text: [id, area, company, ...text] };
}
