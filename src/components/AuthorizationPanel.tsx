import { useState } from "react";
import { useIdentity } from "../services/identity";
import { actOnPlantPermit, canPerform, getPlantPermit, permitFromPlant, pinMessage } from "../services/plantDirectory";
import type { Permit } from "../types";

export function AuthorizationPanel({ permit, onUpdated }: { permit: Permit; onUpdated: (permit: Permit) => void }) {
  const identity = useIdentity();
  const record = permit.plantRecord;
  const [pin, setPin] = useState("");
  const [message, setMessage] = useState("");
  if (!record || !permit.serverPermitId) return null;
  const accepted = record.approvals.some((item) => item.actingRole === "CRAFT_RECEIVER");
  const authorized = record.approvals.some((item) => item.actingRole === "PERMIT_AUTHORIZER");
  const run = async (action: "authorize" | "accept" | "activate", actingRole?: string) => {
    if (!identity.token) {
      setMessage("Plant Link has not established a Permit Control session.");
      return;
    }
    setMessage("");
    try {
      await actOnPlantPermit(identity.token, permit.serverPermitId!, action, pin, record.revision, actingRole);
      const next = await getPlantPermit(permit.serverPermitId!);
      onUpdated(permitFromPlant(next));
      setPin("");
    } catch (error) {
      setMessage(pinMessage(error));
    }
  };

  return (
    <section className="blocker">
      <div className="kicker">AUTHORIZATION</div>
      <p>{record.status === "ACTIVE" ? "ACTIVE · WORK AUTHORIZED" : `${record.status} · NOT ACTIVE FOR WORK`}</p>
      {record.approvals.length === 0 ? <p>No authoritative authorization is recorded.</p> : null}
      {record.approvals.map((item) => (
        <p key={`${item.actingRole}-${item.at}`}>
          {item.actingRole.replaceAll("_", " ")} · {item.displayName} · {item.permitUserCode} · {item.at ?? ""}
        </p>
      ))}
      <div className="kicker">READINESS</div>
      <p>{record.missing.length === 0 ? "Required qualifications are complete." : `Required qualifications incomplete: ${record.missing.join(", ")}`}</p>
      <label className="confirm-field">
        <span>Permit Control PIN</span>
        <input inputMode="numeric" autoComplete="off" maxLength={6} value={pin} onChange={(event) => setPin(event.target.value)} />
      </label>
      <div className="confirm-actions">
        {record.status === "PENDING_REVIEW" && canPerform(identity.user, "PERMIT_AUTHORIZER") ? (
          <button type="button" className="btn" onClick={() => void run("authorize")}>Authorize Permit</button>
        ) : null}
        {record.status === "AUTHORIZED" && canPerform(identity.user, "CRAFT_RECEIVER") ? (
          <button type="button" className="btn" onClick={() => void run("accept")}>Accept Permit</button>
        ) : null}
        {record.status === "AUTHORIZED" && authorized && accepted && record.missing.length === 0 && (canPerform(identity.user, "PERMIT_AUTHORIZER") || canPerform(identity.user, "CRAFT_RECEIVER")) ? (
          <button type="button" className="btn btn-danger" onClick={() => void run("activate", canPerform(identity.user, "CRAFT_RECEIVER") ? "CRAFT_RECEIVER" : "PERMIT_AUTHORIZER")}>Activate Permit</button>
        ) : null}
      </div>
      {message ? <p className="form-error">{message}</p> : null}
    </section>
  );
}
