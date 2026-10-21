import { usePermits } from "../state/PermitStore";
import { STEPS, kindShort } from "../workflow";
import { ScreenHead } from "../components/ui";

export function DraftsScreen() {
  const { drafts, loadDraft } = usePermits();

  return (
    <div className="screen">
      <ScreenHead kicker="PERMITS" title="Drafts" meta={`${drafts.length} OPEN`} />
      {drafts.length === 0 ? (
        <p className="empty">No drafts saved on this station.</p>
      ) : (
        drafts.map((draft) => (
          <button key={draft.code} type="button" className="permit-row" onClick={() => loadDraft(draft.code)}>
            <div className="row-top">
              <span className="pid mono">{draft.code}</span>
              <span className="kind">{kindShort(draft.kind)}</span>
              <span className="row-status">
                <span className="mono screen-meta">
                  {STEPS[draft.step]?.num} {STEPS[draft.step]?.label}
                </span>
              </span>
            </div>
            <div className="row-work">{draft.description || "Scope not entered"}</div>
            <div className="row-fields">
              <div className="kv">
                <span className="k">Area</span>
                <span className="v">{draft.area || "—"}</span>
              </div>
              <div className="kv">
                <span className="k">Equipment / location</span>
                <span className="v mono">{draft.place || "—"}</span>
              </div>
              <div className="kv">
                <span className="k">Work Order</span>
                <span className="v mono">{draft.workOrder || "—"}</span>
              </div>
              <div className="kv">
                <span className="k">Company</span>
                <span className="v">{draft.company || "—"}</span>
              </div>
              <div className="kv">
                <span className="k">Updated</span>
                <span className="v mono">{draft.updated || "—"}</span>
              </div>
            </div>
          </button>
        ))
      )}
    </div>
  );
}
