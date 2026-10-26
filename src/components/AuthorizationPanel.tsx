import { useState } from "react";
import { useDevice } from "../services/device";
import { useIdentity } from "../services/identity";
import { lifecyclePrompt } from "../services/lifecyclePrompt";
import { actOnPlantPermit, canPerform, getPlantPermit, notifyPlantPermitsChanged, permitFromPlant, pinMessage, returnPlantPermitForCorrection } from "../services/plantDirectory";
import { serverPermitType } from "../services/generalWorkDraft";
import { usePermits } from "../state/PermitStore";
import { kindTitle } from "../workflow";
import type { Permit } from "../types";

export function AuthorizationPanel({ permit, onUpdated }: { permit: Permit; onUpdated: (permit: Permit) => void }) {
  const identity = useIdentity();
  const { link } = useDevice();
  const { openCorrection } = usePermits();
  const record = permit.plantRecord;
  const [pin, setPin] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [returning, setReturning] = useState(false);
  const [message, setMessage] = useState("");
  if (!record || !permit.serverPermitId) return null;
  const shown = lifecyclePrompt({
    status: record.status,
    jobDescription: permit.jobDescription,
    workOrder: permit.workOrder,
    hazards: permit.hazards,
    controls: permit.precautions,
    ppe: permit.ppe,
    modules: permit.conditions.map((item) => item.value),
    missing: record.missing,
    approvals: record.approvals,
    canAuthorize: canPerform(identity.user, "PERMIT_AUTHORIZER"),
    canAccept: canPerform(identity.user, "CRAFT_RECEIVER"),
    canCorrect: canPerform(identity.user, "PERMIT_AUTHORIZER") || canPerform(identity.user, "REQUESTER"),
    actorId: identity.user?.id ?? null,
    createdBy: record.createdBy ?? null,
    allowSelfAuthorization: record.allowSelfAuthorization ?? false,
    permitType: serverPermitType(permit.kind),
  });
  const edit = (step = 0) => openCorrection(permit, step);
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
      openCorrection(updated, shown.focus === "ppe" ? 3 : 0);
    } catch (error) {
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
      setMessage(pinMessage(error));
    }
  };

  return (
    <section className="blocker">
      <div className="kicker">{shown.title}</div>
      <p>{shown.detail}</p>
      <p>{permit.id} · {kindTitle(permit.kind)} · Rev {permit.revision}</p>
      <p>{permit.area || "No area"} · {permit.equipment || "No equipment"} · {permit.workOrder || "No work order"}</p>
      <div className="kicker">NEXT ACTION</div>
      <p>{shown.nextTitle}</p>
      <p>{shown.nextDetail}</p>
      {shown.blocked ? <p>{shown.blocked}</p> : null}
      {shown.action && !confirming ? <button type="button" className="btn" onClick={() => setConfirming(true)}>{shown.nextTitle}</button> : null}
      {confirming && shown.action ? (
        <div className="confirm">
          <div className="kicker">{shown.nextTitle}</div>
          <p>{permit.id} · {kindTitle(permit.kind)} · {permit.area || "No area"}</p>
          <p>Acting as {identity.user?.displayName} · {identity.user?.permitUserCode} · {shown.actingRole?.replaceAll("_", " ")}</p>
          <label className="confirm-field">
            <span>PIN</span>
            <input inputMode="numeric" autoComplete="off" maxLength={6} value={pin} onChange={(event) => setPin(event.target.value)} />
          </label>
          <div className="confirm-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setConfirming(false)}>Cancel</button>
            <button type="button" className="btn" onClick={() => void run()}>{shown.nextTitle}</button>
          </div>
        </div>
      ) : null}
      {shown.gaps.length > 0 ? (
        <>
          <div className="kicker">BLOCKING ITEM</div>
          {shown.gaps.map((gap) => (
            <p key={gap}>{gap === "PPE" ? "PPE selection must be completed before this Permit may be authorized." : `${gap} must be completed before this permit may advance.`}</p>
          ))}
        </>
      ) : null}
      {shown.correction === "edit" ? (
        <div className="confirm-actions">
          <button type="button" className="btn" onClick={() => edit(shown.focus === "ppe" ? 3 : 0)}>Edit permit</button>
          {shown.focus === "ppe" ? <button type="button" className="btn btn-ghost" onClick={() => edit(3)}>Edit PPE</button> : null}
        </div>
      ) : null}
      {shown.correction === "return" && !returning ? (
        <button type="button" className="btn" onClick={() => setReturning(true)}>Return for correction</button>
      ) : null}
      {returning ? (
        <div className="confirm">
          <div className="kicker">EDIT AUTHORIZED PERMIT</div>
          <p>This Permit has already been authorized.</p>
          <p>Changing Permit conditions will create a new revision and invalidate the current authorization.</p>
          <p>The updated Permit must be reviewed and authorized again before work may be activated.</p>
          <div className="confirm-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setReturning(false)}>Cancel</button>
            <button type="button" className="btn" onClick={() => void returnForCorrection()}>Edit permit</button>
          </div>
        </div>
      ) : null}
      <div className="kicker">PERMIT READINESS</div>
      {shown.readiness.map((item) => <p key={item.label}>{item.label} · {item.state}</p>)}
      {record.approvals.map((item) => (
        <p key={`${item.actingRole}-${item.at}`}>{item.actingRole.replaceAll("_", " ")} · {item.displayName} · {item.permitUserCode} · {item.at ?? ""}</p>
      ))}
      {message ? <p className="form-error">{message}</p> : null}
    </section>
  );
}
