import { useState } from "react";
import { usePermits } from "../state/PermitStore";
import type { Permit } from "../types";
import { permitType, personName } from "../permitTypes";
import { usePlantClock } from "../plantClock";
import { assetLine, authorizationHold, kindTitle, screenLabel } from "../workflow";
import { PermitDocumentActions } from "../components/PermitDocumentActions";
import { useComposition } from "../components/Composition";
import { detailDocumentTarget, documentActionPlacement } from "../services/permitDocumentActions";
import { Field, Section, StateMark } from "../components/ui";
import { AuthorizationPanel } from "../components/AuthorizationPanel";

export function PermitDetail() {
  const {
    permits,
    selectedId,
    readonlyDetail,
    origin,
    go,
    suspendPermit,
    extendPermit,
    closePermit,
    reinstatePermit,
    replacePlantPermit,
  } = usePermits();
  const clock = usePlantClock();
  const composition = useComposition();
  const permit = permits.find((item) => item.id === selectedId);
  const [panel, setPanel] = useState<"none" | "suspend" | "close">("none");
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState(false);
  const [notice, setNotice] = useState("");
  const [file, setFile] = useState<string | null>(null);

  if (!permit) {
    return (
      <div className="screen">
        <p className="empty">That permit is not on this station.</p>
        <button type="button" className="btn" onClick={() => go("active")}>
          Active Permits
        </button>
      </div>
    );
  }

  const locked = readonlyDetail || permit.status === "closed" || permit.status === "expired";
  const hold = authorizationHold(permit, clock.hm);
  const attachment = permit.attachments.find((item) => item.name === file) ?? null;
  const requester = [permit.requester, permit.requesterGroup].filter(Boolean).join(" · ");
  const documents = detailDocumentTarget(permit);
  const documentPlacement = documentActionPlacement(composition);

  return (
    <div className="screen">
      <header className="detail-head">
        <div>
          <button type="button" className="crumb" onClick={() => go(origin)}>
            {screenLabel(origin)}
          </button>
          <div className="detail-id mono">{permit.id}</div>
          <h1 className="detail-title">
            {kindTitle(permit.kind)}
            <span className="rev mono">REV {permit.revision}</span>
          </h1>
          <div className="status-row">
            {permit.plantRecord ? (
              <span className={`state ${permit.plantRecord.status === "ACTIVE" ? "state-ok" : "state-warn"}`}>
                {permit.plantRecord.status === "ACTIVE" ? "ACTIVE · WORK AUTHORIZED" : `${permit.plantRecord.status} · NOT ACTIVE FOR WORK`}
              </span>
            ) : hold ? (
              <div className={`stop-mark${hold === "expired" ? " is-expired" : ""}`}>
                <strong>{hold === "suspended" ? "SUSPENDED" : "EXPIRED"}</strong>
                <span>WORK NOT AUTHORIZED</span>
              </div>
            ) : (
              <StateMark status={permit.status} />
            )}
          </div>
          <div className="asset-line">{assetLine(permit)}</div>
          <p className="detail-work">{permit.jobDescription}</p>
          <div className="detail-timing mono">{windowOf(permit) || "No window recorded"}</div>
          <div className="wo-line mono">{permit.workOrder}</div>
        </div>
        <div className="detail-actions">
        {permit.plantRecord ? (
          <AuthorizationPanel permit={permit} onUpdated={replacePlantPermit} />
        ) : permit.sample === false ? (
          <p className="notice">This device copy is not an authorization. Submit it to the plant record, then authorize it from Pending Review.</p>
        ) : locked ? (
          <div className="readonly-plate">
            <span>RECORD</span>
            <strong>{permit.status === "expired" ? "EXPIRED" : "CLOSED"}</strong>
            {permit.status === "expired" ? <span>WORK NOT AUTHORIZED</span> : null}
          </div>
        ) : (
          <div className="action-bar">
            {permit.status === "suspended" ? (
              <button
                type="button"
                className="btn btn-hold"
                onClick={() => {
                  reinstatePermit(permit.id);
                  setPanel("none");
                  setNotice("Permit returned to the previous status.");
                }}
              >
                Reinstate
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-hold safety-action"
                onClick={() => {
                  setPanel(panel === "suspend" ? "none" : "suspend");
                  setNotice("");
                }}
              >
                Suspend Permit
              </button>
            )}
            <button
              type="button"
              className="btn"
              onClick={() => {
                const next = extendPermit(permit.id);
                setPanel("none");
                setNotice(next ? `Expiration is now ${next}.` : "This permit has no expiration to extend.");
              }}
            >
              Extend
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                setPanel(panel === "close" ? "none" : "close");
                setNotice("");
              }}
            >
              Close Permit
            </button>
          </div>
        )}
        {documentPlacement === "toolbar" ? <PermitDocumentActions target={documents} placement="toolbar" /> : null}
        </div>
      </header>

      {panel === "suspend" && !locked ? (
        <div className="confirm">
          <div>
            <div className="kicker">SUSPEND</div>
            <p className="confirm-copy">Hold this permit and record why work stopped.</p>
          </div>
          <label className="confirm-field">
            <span>Reason</span>
            <input
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                setReasonError(false);
              }}
              placeholder="State the reason for suspension"
            />
          </label>
          {reasonError ? <p className="form-error">A reason is required.</p> : null}
          <div className="confirm-actions">
            <button
              type="button"
              className="btn btn-hold"
              onClick={() => {
                if (!reason.trim()) {
                  setReasonError(true);
                  return;
                }
                suspendPermit(permit.id, reason.trim());
                setPanel("none");
                setNotice("Permit suspended.");
              }}
            >
              Confirm Suspend
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setPanel("none")}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {panel === "close" && !locked ? (
        <div className="confirm">
          <div>
            <div className="kicker">CLOSE</div>
            <p className="confirm-copy">File this permit to the archive as closed. The record stays readable.</p>
          </div>
          <div className="confirm-actions">
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                closePermit(permit.id);
                setPanel("none");
                setNotice("");
              }}
            >
              Confirm Close
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setPanel("none")}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {notice ? <div className="notice">{notice}</div> : null}

      {permit.status === "suspended" && permit.suspension ? (
        <div className="hold-band">
          <div className="kicker">SUSPENDED {permit.suspension.time}</div>
          <p>{permit.suspension.reason}</p>
          <div className="hold-meta">
            <span>WORK NOT AUTHORIZED</span>
            <span>Suspended by {permit.suspension.by}</span>
            <span className="mono">Previous status {permit.suspension.previous}</span>
          </div>
        </div>
      ) : null}

      {documentPlacement === "documents" ? <PermitDocumentActions target={documents} placement="documents" /> : null}

      <div className="detail-layout">
        <div className="detail-main">
          <Section index="01" title="OVERVIEW">
            <div className="field-grid">
              <Field label="Area" value={permit.area} />
              {permit.equipment ? <Field label="Equipment" value={permit.equipment} mono /> : null}
              {permit.location ? <Field label="Location" value={permit.location} /> : null}
              <Field label="Company" value={permit.company} />
              <Field label="Work order" value={permit.workOrder} mono />
              <Field label="Requested by" value={requester} />
              <Field label="Permit receiver / craft" value={permit.craft} />
              <Field label="Shift supervisor" value={permit.shiftSupervisor} />
            </div>
          </Section>

          <Section index="02" title="ISOLATION">
            <div className="field-grid">
              <Field label="Energy isolation required" value={permit.isolation.required} />
              <Field label="Energy control plan" value={permit.isolation.plan} mono />
              <Field label="Lock box" value={permit.isolation.lockBox} mono />
              <Field label="Zero energy verified" value={permit.isolation.zeroEnergy} mono />
              <Field label="Blinds installed" value={permit.isolation.blinds} />
            </div>
            {permit.conditions.length > 0 ? (
              <>
                <div className="subhead">CONDITIONS</div>
                <div className="field-grid">
                  {permit.conditions.map((condition) => (
                    <Field key={condition.label} label={condition.label} value={condition.value} />
                  ))}
                </div>
              </>
            ) : null}
          </Section>

          <Section index="03" title="ATMOSPHERE">
            {permit.readings.length === 0 ? (
              <p className="empty tight">No instrument readings recorded.</p>
            ) : (
              <table className="gas reading-history">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>O2</th>
                    <th>LEL</th>
                    <th>CO</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {permit.readings.map((reading) => (
                    <tr key={`${reading.time}-${reading.o2}`}>
                      <td>{reading.time}</td>
                      <td>{reading.o2}</td>
                      <td>{reading.lel}</td>
                      <td>{reading.co}</td>
                      <td className={reading.result === "PASS" ? "pass" : "fail"}>{reading.result}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          <Section index="04" title="CONTROLS">
            <div className="triple">
              <div>
                <div className="subhead">HAZARDS</div>
                <ItemList items={permit.hazards} hazard />
              </div>
              <div>
                <div className="subhead">PPE</div>
                <ItemList items={permit.ppe} />
              </div>
              <div>
                <div className="subhead">PRECAUTIONS</div>
                <ItemList items={permit.precautions} />
              </div>
            </div>
          </Section>
        </div>

        <aside className="detail-side">
          <Section index="05" title="PERSONNEL">
            <ul className="people">
              <Person role="Shift Supervisor" name={permit.shiftSupervisor} />
              <Person role="Requester" name={requester} />
              <Person role="Craft / Permit Receiver" name={permit.craft} />
              {permitType(permit.kind).personnel.map((slot) => (
                <Person key={slot.role} role={slot.role} name={personName(permit, slot)} />
              ))}
            </ul>
          </Section>

          {permit.signoffs.length > 0 ? (
            <Section index="06" title="SIGN-OFF">
              <ul className="people">
                {permit.signoffs.map((signoff) => (
                  <li key={signoff.role}>
                    <span className="role">{signoff.role}</span>
                    <span className={signoff.state === "outstanding" ? "name warn" : "name"}>
                      {signoff.state === "signed"
                        ? `${signoff.name}  ${signoff.time}`
                        : signoff.name
                          ? `${signoff.name} recorded on this device`
                          : "Outstanding"}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          <Section index="07" title="ATTACHMENTS">
            {permit.attachments.map((item) => (
              <button
                key={item.name}
                type="button"
                className={file === item.name ? "attach on" : "attach"}
                onClick={() => setFile(file === item.name ? null : item.name)}
              >
                <span className="mono">{item.name}</span>
              </button>
            ))}
            {attachment ? <p className="doc-note">{attachment.note}</p> : null}
          </Section>

          <Section index="08" title="HISTORY">
            <ol className="history">
              {permit.history.map((event, index) => (
                <li key={`${event.time}-${event.label}-${index}`} className={event.tone}>
                  <span className="mono">{event.time}</span>
                  <span>{event.label}</span>
                </li>
              ))}
            </ol>
          </Section>
        </aside>
      </div>
    </div>
  );
}

function windowOf(permit: Permit): string {
  if (permit.started && permit.expires) return `${permit.started} – ${permit.expires}`;
  if (permit.expires) return `Expires ${permit.expires}`;
  return "";
}

function Person({ role, name }: { role: string; name: string }) {
  return (
    <li>
      <span className="role">{role}</span>
      <span className="name">{name || "—"}</span>
    </li>
  );
}

function ItemList({ items, hazard = false }: { items: string[]; hazard?: boolean }) {
  if (items.length === 0) return <p className="empty tight">None recorded.</p>;
  return (
    <ul className={hazard ? "taglist hazard" : "taglist"}>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}
