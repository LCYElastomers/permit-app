import { useState } from "react";
import { useIdentity } from "../services/identity";
import { lifecyclePrompt } from "../services/lifecyclePrompt";
import { actOnPlantPermit, canPerform, getPlantPermit, notifyPlantPermitsChanged, permitFromPlant, pinMessage } from "../services/plantDirectory";
import { kindTitle } from "../workflow";
import type { Permit } from "../types";

export function AuthorizationPanel({ permit, onUpdated }: { permit: Permit; onUpdated: (permit: Permit) => void }) {
  const identity = useIdentity();
  const record = permit.plantRecord;
  const [pin, setPin] = useState("");
  const [confirming, setConfirming] = useState(false);
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
    actorId: identity.user?.id ?? null,
    createdBy: record.createdBy ?? null,
    allowSelfAuthorization: record.allowSelfAuthorization ?? false,
  });
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
      <div className="kicker">PERMIT READINESS</div>
      {shown.readiness.map((item) => <p key={item.label}>{item.label} · {item.state}</p>)}
      {record.approvals.map((item) => (
        <p key={`${item.actingRole}-${item.at}`}>{item.actingRole.replaceAll("_", " ")} · {item.displayName} · {item.permitUserCode} · {item.at ?? ""}</p>
      ))}
      {message ? <p className="form-error">{message}</p> : null}
    </section>
  );
}
