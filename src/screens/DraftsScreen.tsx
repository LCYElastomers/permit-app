import { localDraftLabel, localSavedLabel } from "../services/generalWorkDraft";
import { PlantRefresh, useAuthoritativePermits } from "../services/plantLists";
import { usePermits } from "../state/PermitStore";
import { kindTitle } from "../workflow";
import { ScreenHead } from "../components/ui";

export function DraftsScreen() {
  const { drafts, loadDraft, openPlantPermit } = usePermits();
  const { plant, refresh, ready } = useAuthoritativePermits(["DRAFT"]);
  const plantNumbers = new Set(plant.map((permit) => permit.id));
  const open = drafts.filter((draft) => (draft.lifecycleStatus ?? "DRAFT") === "DRAFT" && !(draft.permitNumber && plantNumbers.has(draft.permitNumber)));

  return (
    <div className="screen">
      <ScreenHead kicker="PERMITS" title="Drafts" meta={`${plant.length} PLANT DRAFTS · ${open.length} ON THIS DEVICE`} />
      <PlantRefresh ready={ready} onRefresh={() => void refresh()} />
      {plant.map((permit) => (
        <button key={permit.serverPermitId} type="button" className="permit-row" onClick={() => openPlantPermit(permit, "drafts")}>
          <div className="row-top">
            <span className="pid mono">{permit.id}</span>
            <span className="kind">{kindTitle(permit.kind)}</span>
            <span className="row-status"><span className="screen-meta">DRAFT · SYNCHRONIZED</span></span>
          </div>
          <div className="row-work">{permit.work}</div>
        </button>
      ))}
      {open.length === 0 && plant.length === 0 ? (
        <p className="empty">No drafts saved on this device.</p>
      ) : open.length === 0 ? null : (
        <div className="drafts-board">
        {open.map((draft) => (
          <button key={draft.id} type="button" className="permit-row" onClick={() => loadDraft(draft.id)}>
            <div className="row-top">
              <span className="pid mono">{draft.permitNumber ?? "LOCAL DRAFT"}</span>
              <span className="kind">{kindTitle(draft.kind)}</span>
              <span className="row-status">
                <span className="screen-meta">{draft.lifecycleStatus ?? "DRAFT"}</span>
              </span>
            </div>
            <div className="row-work">{draft.description || "Job description not entered"}</div>
            <div className="row-fields">
              <div className="row-band">
                <div className="kv">
                  <span className="k">Area</span>
                  <span className="v">{draft.area || "—"}</span>
                </div>
                <div className="kv">
                  <span className="k">Equipment</span>
                  <span className="v mono">{draft.place || "—"}</span>
                </div>
                <div className="kv">
                  <span className="k">Work Order</span>
                  <span className="v mono">{draft.workOrder || "—"}</span>
                </div>
              </div>
              <div className="row-band">
                <div className="kv">
                  <span className="k">Saved on this device</span>
                  <span className="v mono">{localSavedLabel(draft.updated) || "—"}</span>
                </div>
                <div className="kv">
                  <span className="k">Local status</span>
                  <span className="v">SAVED LOCALLY</span>
                </div>
                <div className="kv">
                  <span className="k">Sync</span>
                  <span className="v">{draft.permitNumber ? "SYNCHRONIZED" : draft.outboxStatus === "ATTENTION" ? "NEEDS ATTENTION" : "PENDING SYNC"}</span>
                </div>
              </div>
              <div className="row-band">
                <div className="kv">
                  <span className="k">{draft.permitNumber ? "Permit number" : "Local id"}</span>
                  <span className="v mono">{draft.permitNumber ?? localDraftLabel(draft.id)}</span>
                </div>
              </div>
            </div>
          </button>
        ))}
        </div>
      )}
    </div>
  );
}
