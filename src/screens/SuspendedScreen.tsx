import { usePermits } from "../state/PermitStore";
import { permitType } from "../permitTypes";
import { kindShort, kindTitle } from "../workflow";
import { Kv, ScreenHead } from "../components/ui";
import { PermitBrowseBar, PermitStatusFilters, usePermitBrowse, type BrowseRow } from "../components/PermitFilters";
import { bySort } from "../services/navigationContext";
import { PlantRefresh, stationSamplePermits, useAuthoritativePermits } from "../services/plantLists";

export function SuspendedScreen() {
  const { permits, drafts, openPermit, openStoredPermit, openPlantPermit } = usePermits();
  const browse = usePermitBrowse("suspended");
  const { plant, refresh, ready } = useAuthoritativePermits(["SUSPENDED"]);
  const plantNumbers = new Set(plant.map((permit) => permit.id));
  const real = drafts.filter((draft) => draft.lifecycleStatus === "SUSPENDED" && !(draft.permitNumber && plantNumbers.has(draft.permitNumber)));
  const held = stationSamplePermits(permits, "suspended").slice().sort((a, b) => bySort(browse.sort, a, b));
  const plantShown = plant.filter((permit) => browse.accept(heldRow(permit.id, permit.kind, permit.area, permit.company, [permit.work, permit.workOrder, permit.equipment])));
  const realShown = real.filter((draft) => browse.accept(heldRow(draft.permitNumber ?? "", draft.kind, draft.area, "", [draft.description, draft.place, draft.workOrder])));
  const heldShown = held.filter((permit) => browse.accept(heldRow(permit.id, permit.kind, permit.area, permit.company, [permit.work, permit.suspension?.reason ?? "", permit.workOrder, permit.equipment, permit.location])));
  const browseRows: BrowseRow[] = [
    ...plant.map((permit) => heldRow(permit.id, permit.kind, permit.area, permit.company, [permit.work])),
    ...real.map((draft) => heldRow(draft.permitNumber ?? "", draft.kind, draft.area, "", [draft.description])),
    ...held.map((permit) => heldRow(permit.id, permit.kind, permit.area, permit.company, [permit.work, permit.suspension?.reason ?? ""])),
  ];

  return (
    <div className="screen">
      <ScreenHead kicker="OPERATIONS" title="Permits" meta={`${plantShown.length} PLANT RECORDS · ${heldShown.length} STATION SAMPLES`} />
      <PermitStatusFilters current="suspended" />
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
        <button key={permit.serverPermitId} type="button" className="permit-row is-hold" onClick={() => openPlantPermit(permit, "suspended")}>
          <div className="row-top">
            <span className="pid mono">{permit.id}</span>
            <span className="kind">{kindTitle(permit.kind)}</span>
            <span className="row-status"><span className="screen-meta">SUSPENDED · WORK NOT AUTHORIZED</span></span>
          </div>
          <div className="row-work">{permit.work}</div>
        </button>
      ))}
      {realShown.map((draft) => (
        <button key={draft.id} type="button" className="permit-row is-hold" onClick={() => openStoredPermit(draft.id, "suspended")}>
          <div className="row-top">
            <span className="pid mono">{draft.permitNumber ?? "LOCAL"}</span>
            <span className="kind">{kindTitle(draft.kind)}</span>
            <span className="row-status"><span className="screen-meta">SUSPENDED · WORK NOT AUTHORIZED</span></span>
          </div>
          <div className="row-work">{draft.description || "Job description not entered"}</div>
        </button>
      ))}
      {plantShown.length === 0 && realShown.length === 0 && heldShown.length === 0 ? (
        <p className="empty">No permits are suspended.</p>
      ) : null}
      {heldShown.length === 0 ? null : (
        heldShown.map((permit) => {
          const placeLabel = permitType(permit.kind).place === "location" ? "Location" : "Equipment";
          const place =
            permitType(permit.kind).place === "location"
              ? permit.location || permit.equipment
              : permit.equipment || permit.location;
          return (
            <button
              key={permit.id}
              type="button"
              className="permit-row is-hold"
              onClick={() => openPermit(permit.id, "suspended")}
            >
              <div className="row-top">
                <span className="pid mono">{permit.id}</span>
                <span className="kind">{kindShort(permit.kind)}</span>
                <span className="row-status">
                  <span className="state state-alert">
                    <span className="lamp lamp-alert" />
                    SUSPENDED <span className="mono">{permit.suspension?.time}</span>
                  </span>
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
              <div className="reason">
                <div className="k">Reason</div>
                <p>{permit.suspension?.reason}</p>
              </div>
              <div className="hold-meta">
                <span>Suspended by {permit.suspension?.by}</span>
                <span>Previous status {permit.suspension?.previous}</span>
              </div>
            </button>
          );
        })
      )}
    </div>
  );
}

function heldRow(id: string, kind: string, area: string, company: string, text: string[]): BrowseRow {
  return { area, kind, company, text: [id, area, company, ...text] };
}
