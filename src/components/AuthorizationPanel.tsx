import { useEffect, useState } from "react";
import { AdminEditorModal } from "./admin";
import { PinInput } from "./PinInput";
import { useDevice } from "../services/device";
import { useIdentity } from "../services/identity";
import { blockingItemCopy, lifecyclePrompt } from "../services/lifecyclePrompt";
import { approvalActionLabel, authorizationHistory, currentAuthorization, effectiveApprovals, permitWhen, revisionLabel, summaryLine } from "../services/permitDetailPresentation";
import { actOnPlantPermit, canPerform, getPlantPermit, notifyPlantPermitsChanged, permitFromPlant, pinMessage, returnPlantPermitForCorrection, withdrawPlantAuthorization } from "../services/plantDirectory";
import { serverPermitType } from "../services/generalWorkDraft";
import { usePermits } from "../state/PermitStore";
import { kindTitle } from "../workflow";
import type { Permit } from "../types";

export function AuthorizationHistory({ permit }: { permit: Permit }) {
  const record = permit.plantRecord;
  const [historyOpen, setHistoryOpen] = useState(false);
  if (!record) return null;
  const history = authorizationHistory(
    record.approvals,
    (record.authorizationHistory ?? []).map((item) => ({
      revision: item.revision,
      action: approvalActionLabel(item.action, ""),
      person: item.displayName,
      at: item.at,
      permitUserCode: item.permitUserCode,
      userId: item.userId,
      reason: item.reason ?? null,
      code: item.action,
    })),
  );
  if (history.length === 0) return null;
  return (
    <div className="auth-history-wrap">
      <button type="button" className="btn btn-ghost" onClick={() => setHistoryOpen((open) => !open)}>
        {historyOpen ? "Hide authorization history" : "View authorization history"}
      </button>
      {historyOpen ? (
        <ol className="auth-history">
          {history.map((item, index) => (
            <li key={`${item.revision}-${item.action}-${item.at}-${index}`}>
              {revisionLabel(item.revision) ? <div className="kicker">{revisionLabel(item.revision)}</div> : null}
              <strong>{item.action}</strong>
              {item.person ? <div>{item.person}</div> : null}
              {item.at ? <div>{permitWhen(item.at)}</div> : null}
              {item.reason ? <div>Reason: {item.reason}</div> : null}
              {item.permitUserCode || item.userId ? (
                <div className="auth-identity mono">{[item.permitUserCode, item.userId].filter(Boolean).join(" · ")}</div>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

export function AuthorizationPanel({ permit, onUpdated }: { permit: Permit; onUpdated: (permit: Permit) => void }) {
  const identity = useIdentity();
  const { link } = useDevice();
  const { openCorrection } = usePermits();
  const record = permit.plantRecord;
  const [pin, setPin] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [returning, setReturning] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [reason, setReason] = useState("CONDITIONS_CHANGED");
  const [comments, setComments] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    setPin("");
    setConfirming(false);
  }, [identity.user?.id, permit.serverPermitId]);
  if (!record || !permit.serverPermitId) return null;
  const effective = effectiveApprovals(record.approvals, record.authorizationHistory ?? []);
  const shown = lifecyclePrompt({
    status: record.status,
    jobDescription: permit.jobDescription,
    workOrder: permit.workOrder,
    hazards: permit.hazards,
    controls: permit.precautions,
    ppe: permit.ppe,
    modules: permit.conditions.map((item) => item.value),
    missing: record.missing,
    approvals: effective,
    canAuthorize: canPerform(identity.user, "PERMIT_AUTHORIZER"),
    canAccept: canPerform(identity.user, "CRAFT_RECEIVER"),
    canCorrect: canPerform(identity.user, "PERMIT_AUTHORIZER") || canPerform(identity.user, "REQUESTER"),
    actorId: identity.user?.id ?? null,
    createdBy: record.createdBy ?? null,
    allowSelfAuthorization: record.allowSelfAuthorization ?? false,
    permitType: serverPermitType(permit.kind),
  });
  const edit = (step = 0) => openCorrection(permit, step);
  const summary = currentAuthorization(effective, record.revision);
  const closeReturn = () => {
    setReturning(false);
    setMessage("");
  };
  const returnForCorrection = async () => {
    if (!identity.token || !permit.serverPermitId) {
      setMessage("Plant Link has not established a Permit Control session.");
      return;
    }
    if (link.link !== "ready") {
      setMessage("Plant Link must be READY before an authorized permit can be returned for correction.");
      return;
    }
    setMessage("");
    try {
      await returnPlantPermitForCorrection(identity.token, permit.serverPermitId, record.revision);
      const updated = permitFromPlant(await getPlantPermit(permit.serverPermitId));
      onUpdated(updated);
      notifyPlantPermitsChanged();
      setReturning(false);
      openCorrection(updated, shown.focusStep);
    } catch (error) {
      setMessage(pinMessage(error));
    }
  };
  const closeWithdraw = () => {
    setWithdrawing(false);
    setPin("");
    setMessage("");
    setComments("");
    setReason("CONDITIONS_CHANGED");
  };
  const withdrawAuthorization = async () => {
    if (!identity.token || !permit.serverPermitId) {
      setMessage("Plant Link has not established a Permit Control session.");
      return;
    }
    if (link.link !== "ready") {
      setMessage("Plant Link must be READY before authorization can be withdrawn.");
      return;
    }
    if (reason === "OTHER" && comments.trim().length === 0) {
      setMessage("Comments are required when the reason is Other.");
      return;
    }
    setMessage("");
    try {
      await withdrawPlantAuthorization(identity.token, permit.serverPermitId, pin, record.revision, reason, comments);
      onUpdated(permitFromPlant(await getPlantPermit(permit.serverPermitId)));
      notifyPlantPermitsChanged();
      setPin("");
      setWithdrawing(false);
      setComments("");
      setReason("CONDITIONS_CHANGED");
    } catch (error) {
      setPin("");
      setMessage(pinMessage(error));
    }
  };
  const run = async () => {
    if (!shown.action || !identity.token) {
      setMessage("Plant Link has not established a Permit Control session.");
      return;
    }
    setMessage("");
    try {
      await actOnPlantPermit(identity.token, permit.serverPermitId!, shown.action, pin, record.revision, shown.actingRole ?? undefined);
      onUpdated(permitFromPlant(await getPlantPermit(permit.serverPermitId!)));
      notifyPlantPermitsChanged();
      setPin("");
      setConfirming(false);
    } catch (error) {
      setPin("");
      setMessage(pinMessage(error));
    }
  };

  return (
    <>
      <section className="detail-readiness">
        <div className="next-action">
          <div className="kicker">Next action</div>
          <strong>{shown.nextTitle}</strong>
          {shown.nextDetail ? <p>{shown.nextDetail}</p> : null}
        </div>
        {shown.gaps.length > 0 ? (
          <ul>
            {shown.gaps.map((gap) => (
              <li key={gap}>
                <strong>{gap}</strong>
                <div>{blockingItemCopy(gap)}</div>
              </li>
            ))}
          </ul>
        ) : null}
        {shown.personnel.length > 0 ? (
          <>
            <div className="kicker">{shown.nextTitle === "COMPLETE REQUIRED PERSONNEL" ? "Required" : "Required before activation"}</div>
            <ul className="personnel-need">
              {shown.personnel.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </>
        ) : null}
        {shown.blocked && shown.gaps.length === 0 && shown.personnel.length === 0 ? <p>{shown.blocked}</p> : null}
        {shown.action && shown.actionLabel ? (
          <button type="button" className="btn" onClick={() => { setMessage(""); setPin(""); setConfirming(true); }}>{shown.actionLabel}</button>
        ) : null}
        {shown.correction === "edit" ? (
          <button type="button" className="btn" onClick={() => edit(shown.focusStep)}>Edit permit</button>
        ) : null}
        {shown.correction === "return" ? (
          <button type="button" className="btn" id="return-for-correction" onClick={() => { setMessage(""); setReturning(true); }}>
            Return for correction
          </button>
        ) : null}
        {shown.withdraw ? (
          <button type="button" className="btn btn-ghost" id="withdraw-authorization" onClick={() => { setPin(""); setMessage(""); setWithdrawing(true); }}>
            WITHDRAW AUTHORIZATION
          </button>
        ) : null}
        {summary.length > 0 ? (
          <div className="auth-summary">
            <div className="kicker">Authorization</div>
            {summary.map((item) => (
              <p key={item.actingRole}>{summaryLine(item.actingRole, item.displayName, item.at)}</p>
            ))}
          </div>
        ) : null}
        {message && !returning && !confirming && !withdrawing ? <p className="form-error">{message}</p> : null}
      </section>
      {confirming && shown.action ? (
        <AdminEditorModal
          title={shown.nextTitle}
          code={permit.id}
          subtitle={`${kindTitle(permit.kind)} · REV ${permit.revision}`}
          primaryLabel={shown.nextTitle}
          onClose={() => { setConfirming(false); setPin(""); setMessage(""); }}
          onSave={() => void run()}
          error={message || undefined}
        >
          <p className="correction-copy">{permit.area || "No area"} · {identity.user?.displayName}</p>
          <PinInput label="PIN" purpose="current" value={pin} onChange={setPin} />
        </AdminEditorModal>
      ) : null}
      {returning ? (
        <AdminEditorModal
          title="Return permit for correction"
          code={permit.id}
          subtitle={`${kindTitle(permit.kind)} · REV ${permit.revision}`}
          primaryLabel="Return for correction"
          restoreId="return-for-correction"
          onClose={closeReturn}
          onSave={() => void returnForCorrection()}
          error={message || undefined}
        >
          <p className="correction-copy">This Permit has already been authorized.</p>
          <p className="correction-copy">Changing Permit conditions will create a new revision and invalidate the current authorization.</p>
          <p className="correction-copy">The updated Permit must be reviewed and authorized again before work may be activated.</p>
          {shown.gaps.length > 0 ? (
            <>
              <div className="kicker">Current blocking items</div>
              <ul>
                {shown.gaps.map((gap) => (
                  <li key={gap}>
                    <strong>{gap}</strong>
                    <div>{blockingItemCopy(gap)}</div>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </AdminEditorModal>
      ) : null}
      {withdrawing ? (
        <AdminEditorModal
          title="WITHDRAW AUTHORIZATION"
          code={permit.id}
          subtitle={`${kindTitle(permit.kind)} · REV ${permit.revision}`}
          primaryLabel="WITHDRAW AUTHORIZATION"
          restoreId="withdraw-authorization"
          onClose={closeWithdraw}
          onSave={() => void withdrawAuthorization()}
          error={message || undefined}
        >
          <p className="correction-copy">Permit {permit.id} · {kindTitle(permit.kind)} · REV {permit.revision}</p>
          <p className="correction-copy">This Permit is currently AUTHORIZED but is not ACTIVE.</p>
          <p className="correction-copy">Withdrawing authorization returns the Permit to Pending Review.</p>
          <p className="correction-copy">Work remains NOT AUTHORIZED.</p>
          <label className="field">
            <span>Reason</span>
            <select value={reason} onChange={(event) => setReason(event.target.value)}>
              <option value="CONDITIONS_CHANGED">Conditions Changed</option>
              <option value="PERMIT_REQUIRES_CORRECTION">Permit Requires Correction</option>
              <option value="SCOPE_CHANGED">Scope Changed</option>
              <option value="AUTHORIZATION_ENTERED_IN_ERROR">Authorization Entered in Error</option>
              <option value="REQUIRED_INFORMATION_MISSING">Required Information Missing</option>
              <option value="OTHER">Other</option>
            </select>
          </label>
          <label className="field">
            <span>Comments</span>
            <textarea value={comments} rows={3} onChange={(event) => setComments(event.target.value)} />
          </label>
          <PinInput label="PIN" purpose="current" value={pin} onChange={setPin} />
        </AdminEditorModal>
      ) : null}
    </>
  );
}
