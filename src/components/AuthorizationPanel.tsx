import { useEffect, useState } from "react";
import { AdminEditorModal } from "./admin";
import { PinInput } from "./PinInput";
import { useDevice } from "../services/device";
import { useIdentity } from "../services/identity";
import { blockingItemCopy, lifecyclePrompt } from "../services/lifecyclePrompt";
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
  useEffect(() => {
    setPin("");
    setConfirming(false);
  }, [identity.user?.id, permit.serverPermitId]);
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
        <div className="kicker">{shown.nextTitle}</div>
        <p>{shown.nextDetail}</p>
        {shown.gaps.length > 0 ? (
          <>
            <div className="kicker">Blocking items</div>
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
        {shown.blocked && shown.gaps.length === 0 ? <p>{shown.blocked}</p> : null}
        {shown.action ? (
          <button type="button" className="btn" onClick={() => { setMessage(""); setPin(""); setConfirming(true); }}>{shown.nextTitle}</button>
        ) : null}
        {shown.correction === "edit" ? (
          <button type="button" className="btn" onClick={() => edit(shown.focusStep)}>Edit permit</button>
        ) : null}
        {shown.correction === "return" ? (
          <button type="button" className="btn" id="return-for-correction" onClick={() => { setMessage(""); setReturning(true); }}>
            Return for correction
          </button>
        ) : null}
        {record.approvals.length > 0 ? (
          <>
            <div className="kicker">Authorization history</div>
            {record.approvals.map((item) => (
              <p key={`${item.actingRole}-${item.at}`}>{item.actingRole.replaceAll("_", " ")} · {item.displayName} · {item.permitUserCode} · {item.at ?? ""}</p>
            ))}
          </>
        ) : null}
        {message && !returning && !confirming ? <p className="form-error">{message}</p> : null}
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
          <p className="correction-copy">{permit.area || "No area"} · {identity.user?.displayName} · {identity.user?.permitUserCode} · {shown.actingRole?.replaceAll("_", " ")}</p>
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
    </>
  );
}
