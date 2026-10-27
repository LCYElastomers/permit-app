import { useEffect, useRef, useState } from "react";
import { usePermits } from "../state/PermitStore";
import type { Permit } from "../types";
import { permitWhen } from "../services/permitDetailPresentation";
import { permitType, personName } from "../permitTypes";
import { kindTitle } from "../workflow";
import { ContextualBack } from "../components/ContextualBack";
import { PermitDocumentActions } from "../components/PermitDocumentActions";
import { useComposition } from "../components/Composition";
import { catalogLabel } from "../services/catalogLabels";
import { detailDocumentTarget, documentActionPlacement } from "../services/permitDocumentActions";
import { Field, Section } from "../components/ui";
import { AuthorizationHistory, AuthorizationPanel } from "../components/AuthorizationPanel";
import { detailStatusCopy, permitDetailSource, stationDetailPrompt } from "../services/lifecyclePrompt";
import { useDevice } from "../services/device";
import { getPlantPermit, permitFromPlant } from "../services/plantDirectory";

export function PermitDetail() {
  const {
    permits,
    selectedId,
    readonlyDetail,
    suspendPermit,
    extendPermit,
    closePermit,
    reinstatePermit,
    replacePlantPermit,
    drafts,
    loadDraft,
  } = usePermits();
  const composition = useComposition();
  const { link } = useDevice();
  const permit = permits.find((item) => item.id === selectedId);
  const permitRef = useRef(permit);
  permitRef.current = permit;
  const replaceRef = useRef(replacePlantPermit);
  replaceRef.current = replacePlantPermit;
  const [panel, setPanel] = useState<"none" | "suspend" | "close">("none");
  const [resolveFailed, setResolveFailed] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState(false);
  const [notice, setNotice] = useState("");
  const [file, setFile] = useState<string | null>(null);
  const source = permit ? permitDetailSource(permit) : "sample";
  const plantReady = link.link === "ready";
  useEffect(() => {
    setResolveFailed(false);
  }, [permit?.serverPermitId]);
  useEffect(() => {
    const current = permitRef.current;
    if (!current || source !== "synchronized" || !current.serverPermitId || !plantReady) return;
    let stopped = false;
    void getPlantPermit(current.serverPermitId)
      .then((record) => {
        if (stopped) return;
        const plant = permitFromPlant(record);
        replaceRef.current({
          ...plant,
          company: plant.company || current.company,
          equipment: plant.equipment || current.equipment,
          location: plant.location || current.location,
          requester: plant.requester || current.requester,
          craft: plant.craft || current.craft,
          area: plant.area || current.area,
        });
      })
      .catch(() => {
        if (!stopped) setResolveFailed(true);
      });
    return () => {
      stopped = true;
    };
  }, [source, permit?.serverPermitId, plantReady]);

  if (!permit) {
    return (
      <div className="screen">
        <p className="empty">That permit is not on this station.</p>
        <ContextualBack />
      </div>
    );
  }

  const locked = readonlyDetail || permit.status === "closed" || permit.status === "expired";
  const attachment = permit.attachments.find((item) => item.name === file) ?? null;
  const requester = [permit.requester, permit.requesterGroup].filter(Boolean).join(" · ");
  const documents = detailDocumentTarget(permit);
  const documentPlacement = documentActionPlacement(composition);
  const localDraft = drafts.find((draft) => draft.id === permit.serverPermitId || draft.id === permit.id || (permit.id !== "" && draft.permitNumber === permit.id));
  const statusCopy = detailStatusCopy(permit);
  const station = source === "plant" ? null : stationDetailPrompt({
    source,
    status: permit.status,
    plantReady,
    editable: Boolean(localDraft && (localDraft.lifecycleStatus === "DRAFT" || localDraft.lifecycleStatus === "PENDING_REVIEW")),
    resolveFailed,
  });

  return (
    <div className="screen">
      <header className="detail-head">
        <ContextualBack permitNumber={permit.id} status={permit.plantRecord?.status ?? permit.status} />
        <div className="detail-identity">
          <div className="detail-id mono">{permit.id}</div>
          <h1 className="detail-title">
            {kindTitle(permit.kind)}
            <span className="rev mono">· REV {permit.revision}</span>
          </h1>
          <div className="status-row">
            <div className={`detail-status${statusCopy.active ? " is-active" : ""}`}>
              <strong>{statusCopy.title}</strong>
              <span>{statusCopy.detail}</span>
            </div>
          </div>
          <dl className="detail-facts">
            {permit.area ? (
              <div>
                <dt>Work location</dt>
                <dd>{permit.area}</dd>
              </div>
            ) : null}
            {permit.equipment || permit.location ? (
              <div>
                <dt>{permit.equipment ? "Equipment" : "Location"}</dt>
                <dd className="mono">{permit.equipment || permit.location}</dd>
              </div>
            ) : null}
            {permit.jobDescription ? (
              <div className="wide">
                <dt>Work scope</dt>
                <dd>{permit.jobDescription}</dd>
              </div>
            ) : null}
            {permit.workOrder ? (
              <div>
                <dt>Work order</dt>
                <dd className="mono">{permit.workOrder}</dd>
              </div>
            ) : null}
            {permit.company ? (
              <div>
                <dt>Company</dt>
                <dd>{permit.company}</dd>
              </div>
            ) : null}
            {windowOf(permit) ? (
              <div>
                <dt>Window</dt>
                <dd className="mono">{windowOf(permit)}</dd>
              </div>
            ) : null}
          </dl>
        </div>
        <div className="detail-actions">
        {source === "plant" ? (
          <AuthorizationPanel permit={permit} onUpdated={replacePlantPermit} />
        ) : station ? (
          <section className="detail-readiness">
            <div className="next-action">
              <div className="kicker">Next action</div>
              <strong>{station.nextTitle}</strong>
              {station.nextDetail ? <p>{station.nextDetail}</p> : null}
            </div>
            {station.edit || station.suspend || station.extend || station.close || station.reinstate ? (
              <div className="permit-actions">
                <div className="kicker">Permit actions</div>
                <div className="permit-action-row">
                  {station.edit && localDraft ? (
                    <button type="button" className="btn" onClick={() => loadDraft(localDraft.id)}>Edit permit</button>
                  ) : null}
                  {station.reinstate ? (
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
                  ) : null}
                  {station.suspend && !locked ? (
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
                  ) : null}
                  {station.extend && !locked ? (
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
                  ) : null}
                  {station.close && !locked ? (
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
                  ) : null}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}
        {documentPlacement === "toolbar" ? <PermitDocumentActions target={documents} placement="toolbar" /> : null}
        {permit.plantRecord ? <AuthorizationHistory permit={permit} /> : null}
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
              type="text"
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

          {permit.plantRecord ? null : (
            <Section index="08" title="HISTORY">
              <ol className="history">
                {permit.history.map((event, index) => (
                  <li key={`${event.time}-${event.label}-${index}`} className={event.tone}>
                    <span className="mono">{permitWhen(event.time)}</span>
                    <span>{event.label}</span>
                  </li>
                ))}
              </ol>
            </Section>
          )}
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
          <li key={item}>{catalogLabel(item)}</li>
        ))}
    </ul>
  );
}
