import { useComposition } from "./Composition";
import { backPresentation, statusMoveNotice } from "../services/navigationContext";
import { usePermits } from "../state/PermitStore";

export function ContextualBack({ permitNumber, status }: { permitNumber?: string; status?: string }) {
  const { originSnapshot, returnToOrigin, showActive } = usePermits();
  const composition = useComposition();
  const compact = composition !== "desktop";
  const back = backPresentation(originSnapshot, compact);
  const notice = status ? statusMoveNotice(originSnapshot, status) : null;
  const trail = [...back.trail, permitNumber].filter(Boolean).join(" / ");

  return (
    <div className={`context-nav context-nav-${composition}`}>
      <button type="button" className="context-back" onClick={returnToOrigin}>
        <span aria-hidden="true">←</span>
        <span>{back.label}</span>
      </button>
      {composition === "desktop" && permitNumber ? <div className="context-trail">{trail}</div> : null}
      {notice ? (
        <p className="context-move">
          <span>{notice.message}</span>
          <button type="button" className="context-shift" onClick={() => showActive("all")}>
            {notice.label}
          </button>
        </p>
      ) : null}
    </div>
  );
}
