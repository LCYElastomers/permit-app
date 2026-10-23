import { useEffect, useRef, useState } from "react";
import { contractors } from "../data/mock";
import { GENERAL_EXCLUSIONS, PERMIT_TYPES, typeRecommendations } from "../permitTypes";
import { plantClock } from "../plantClock";
import { areaIdForName, type AreaCatalog } from "../services/areas";
import { useAreaCatalog } from "../services/useAreaCatalog";
import { useDevice } from "../services/device";
import { localDraftLabel, submitLocalPermit } from "../services/generalWorkDraft";
import { useIdentity } from "../services/identity";
import { pinMessage, submitPlantPermit } from "../services/plantDirectory";
import { syncMayStart } from "../lib/connectivity";
import { draftDocumentTarget, documentActionPlacement } from "../services/permitDocumentActions";
import { usePermits } from "../state/PermitStore";
import type { PermitDraft, PermitKind } from "../types";
import {
  CONTROLS,
  HAZARDS,
  STEPS,
  authorizationRoles,
  detailFields,
  issueBlockers,
  preparationGaps,
  kindTitle,
  toggleItem,
} from "../workflow";
import { useComposition } from "../components/Composition";
import { PermitDocumentActions } from "../components/PermitDocumentActions";
import { Field, Section, TouchSelect } from "../components/ui";
import type { PlantLink } from "../lib/connectivity";

const COMPANIES = contractors.filter((item) => item.name !== "LCY").map((item) => item.name);

function localSaveLine(form: PermitDraft, link: PlantLink): string {
  if (!form.id) return "";
  if (form.lifecycleStatus === "PENDING_REVIEW" && form.permitNumber) return "SUBMITTED FOR REVIEW";
  if (form.permitNumber) return "SYNCHRONIZED";
  if (form.outboxStatus === "ATTENTION") return "SAVED LOCALLY · NEEDS ATTENTION";
  if (link === "unreachable") return "SAVED LOCALLY · PLANT LINK OFFLINE";
  return "SAVED LOCALLY · PENDING SYNC";
}

export function NewPermit() {
  const { form, updateForm, saveDraft, resetForm } = usePermits();
  const catalog = useAreaCatalog();
  const composition = useComposition();
  const { link } = useDevice();
  const identity = useIdentity();
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [signError, setSignError] = useState("");
  const blockers = issueBlockers(form);
  const step = STEPS[form.step] ?? STEPS[0];
  const saveLine = saveError || localSaveLine(form, link.link);

  const patch = (partial: Partial<PermitDraft>) => {
    updateForm((current) => ({ ...current, ...partial }));
  };

  useEffect(() => {
    if (catalog.status !== "ready" || form.areaId || !form.area) return;
    const areaId = areaIdForName(catalog.areas, form.area);
    if (!areaId) return;
    updateForm((current) => (current.areaId ? current : { ...current, areaId }));
  }, [catalog, form.area, form.areaId, updateForm]);

  const setField = (key: string, value: string) => {
    updateForm((current) => ({ ...current, fields: { ...current.fields, [key]: value } }));
  };

  return (
    <div className="screen fill workflow">
      <div className="steps">
        {STEPS.map((item, index) => (
          <button
            key={item.num}
            type="button"
            className={form.step === index ? "step current" : "step"}
            onClick={() => patch({ step: index })}
          >
            <span className="step-num">{item.num}</span>
            <span className="step-label">{item.label}</span>
          </button>
        ))}
      </div>
      <div className="field-progress">
        <div className="field-progress-count">
          {form.step + 1} OF {STEPS.length}
        </div>
        <div className="field-progress-name">{step.label}</div>
        <div className="field-progress-marks" aria-hidden="true">
          {STEPS.map((item, index) => (
            <span key={item.num} className={index === form.step ? "current" : index < form.step ? "done" : ""} />
          ))}
        </div>
      </div>

      <div className="kind-bar">
        <div className="kind-switch type-switch" role="group" aria-label="Permit type">
          {PERMIT_TYPES.map((type) => (
            <button
              key={type.id}
              type="button"
              className={form.kind === type.id ? "on" : ""}
              onClick={() => patch({ kind: type.id })}
            >
              {type.short}
            </button>
          ))}
        </div>
        <div className="kind-meta mono">
          {form.permitNumber ? form.permitNumber : form.id ? `LOCAL DRAFT ${localDraftLabel(form.id)}` : "UNSAVED"}
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => { resetForm(); setSaveError(""); }}>
          Clear
        </button>
        {documentActionPlacement(composition) === "toolbar" ? (
          <PermitDocumentActions target={draftDocumentTarget(form)} placement="toolbar" />
        ) : null}
      </div>

      {form.kind === "general" && form.id ? (
        <section className="document-actions" aria-label="Permit document">
          <div className="stop-mark">
            <strong>DRAFT</strong>
            <span>NOT AUTHORIZED FOR WORK</span>
          </div>
          <p>A printed copy of this draft does not authorize work.</p>
          {form.permitNumber ? null : <p>Print and export are available after the plant record assigns a permit number.</p>}
        </section>
      ) : null}
      {documentActionPlacement(composition) === "documents" && form.kind === "general" && form.id ? (
        <PermitDocumentActions target={draftDocumentTarget(form)} placement="documents" />
      ) : null}

      <div className="workflow-stage">
        <div className="workflow-main">
          <TypeRecommendationNotice form={form} onUse={(kind) => patch({ kind })} />
          {form.step === 0 && <ScopeStep form={form} patch={patch} setField={setField} catalog={catalog} />}
          {form.step === 1 && (
            <ChoiceStep
              index="02"
              title="HAZARDS"
              options={HAZARDS}
              selected={form.hazards}
              onToggle={(value) => patch({ hazards: toggleItem(form.hazards, value) })}
              otherKey="other"
              otherLabel="Other hazard"
              otherValue={form.fields.otherHazard ?? ""}
              onOther={(value) => setField("otherHazard", value)}
            />
          )}
          {form.step === 2 && (
            <ChoiceStep
              index="03"
              title="CONTROLS"
              options={CONTROLS}
              selected={form.controls}
              onToggle={(value) => patch({ controls: toggleItem(form.controls, value) })}
              otherKey="other controls"
              otherLabel="Other controls"
              otherValue={form.fields.otherControl ?? ""}
              onOther={(value) => setField("otherControl", value)}
            />
          )}
          {form.step === 3 && <DetailStep form={form} setField={setField} />}
          {form.step === 4 && <ReviewStep form={form} />}
          {form.step === 5 && (
            <AuthorizationStep form={form} signError={signError} setSignError={setSignError} blockers={blockers} />
          )}
        </div>
        <aside className="workflow-context">
          <div className="kicker">THIS DRAFT</div>
          <div className="context-id mono">
            {form.permitNumber ? form.permitNumber : form.id ? `LOCAL DRAFT ${localDraftLabel(form.id)}` : "UNSAVED"}
          </div>
          <p>{kindTitle(form.kind)}</p>
          <p>{form.area || "Area not selected"}</p>
          <p className="mono">{form.place || "No equipment tag"}</p>
          <p>
            {form.hazards.length} hazards · {form.controls.length} controls
          </p>
          {form.step >= 4 && blockers.length > 0 ? (
            <p>{blockers.length} items outstanding before issue</p>
          ) : null}
        </aside>
      </div>

      <footer className="workflow-foot">
        <button
          type="button"
          className="btn btn-ghost btn-back"
          disabled={form.step === 0}
          onClick={() => patch({ step: Math.max(0, form.step - 1) })}
        >
          Back
        </button>
        {saveLine ? (
          <p className={saveError ? "save-status foot-save is-failed" : "save-status foot-save"}>{saveLine}</p>
        ) : (
          <span className="foot-save" />
        )}
        <div className="foot-actions">
          <button
            type="button"
            className="btn btn-save"
            disabled={saving}
            onClick={() => {
              if (savingRef.current) return;
              savingRef.current = true;
              setSaving(true);
              setSaveError("");
              void saveDraft()
                .catch(() => {
                  setSaveError("This draft could not be saved on this device. Local data is unavailable. The form is still here.");
                })
                .finally(() => {
                  savingRef.current = false;
                  setSaving(false);
                });
            }}
          >
            Save Draft
          </button>
          {form.step < 5 ? (
            <button type="button" className="btn btn-next" onClick={() => patch({ step: form.step + 1 })}>
              Continue
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-next"
              disabled={!form.id || preparationGaps(form).length > 0 || form.lifecycleStatus === "PENDING_REVIEW"}
              onClick={() => {
                if (!form.id) {
                  setSaveError("Save the draft on this device before submitting it for review.");
                  return;
                }
                void submitLocalPermit(form.id)
                  .then(async (saved) => {
                    updateForm(() => saved);
                    if (!saved.permitNumber || !syncMayStart(link.link) || !identity.token) {
                      setSaveError("Submitted on this device. Plant Link must be ready before the plant record leaves draft.");
                      return;
                    }
                    await submitPlantPermit(identity.token, saved.id);
                    setSaveError("");
                  })
                  .catch((error) => setSaveError(pinMessage(error) || "This draft could not be submitted. It is still saved on this device."));
              }}
            >
              Submit for Review
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

function AreaNote({ form, catalog }: { form: PermitDraft; catalog: AreaCatalog }) {
  if (catalog.status === "loading") return <p className="field-note">Loading areas.</p>;
  if (catalog.status === "storage-failed") {
    return <p className="field-note">Local permit data is unavailable on this device.</p>;
  }
  if (catalog.status === "unsynchronized") {
    return <p className="field-note">Area reference data has not been synchronized.</p>;
  }
  if (catalog.areas.length === 0) return <p className="field-note">No areas are configured.</p>;
  const known = catalog.areas.some((area) => area.id === form.areaId || area.name === form.area);
  if (form.area && !known) return <p className="field-note">Saved area is not in the current reference list.</p>;
  return null;
}

function ScopeStep({
  form,
  patch,
  setField,
  catalog,
}: {
  form: PermitDraft;
  patch: (partial: Partial<PermitDraft>) => void;
  setField: (key: string, value: string) => void;
  catalog: ReturnType<typeof useAreaCatalog>;
}) {
  const areas = catalog.status === "ready" ? catalog.areas : [];
  const selected = areas.some((area) => area.id === form.areaId) ? form.areaId : "";
  return (
    <Section index="01" title="SCOPE">
      <div className="form-grid">
        <div className="form-field">
          <span>Permit type</span>
          <div className="readonly-value">{kindTitle(form.kind)}</div>
        </div>
        <TouchSelect
          label="Area"
          value={selected}
          placeholder="Select area"
          disabled={catalog.status !== "ready"}
          options={areas.map((area) => ({ id: area.id, label: area.name }))}
          onChange={(id) => {
            const area = areas.find((item) => item.id === id);
            patch({ areaId: area?.id ?? "", area: area?.name ?? "" });
          }}
        />
        <AreaNote form={form} catalog={catalog} />
        <label className="form-field">
          <span>Equipment / tag</span>
          <input className="mono-input" value={form.place} onChange={(event) => patch({ place: event.target.value })} />
        </label>
        <label className="form-field">
          <span>Work order</span>
          <input className="mono-input" value={form.workOrder} onChange={(event) => patch({ workOrder: event.target.value })} />
        </label>
        <label className="form-field span-2">
          <span>Describe the work</span>
          <textarea value={form.description} onChange={(event) => patch({ description: event.target.value })} />
        </label>
        <div className="form-field">
          <span>Company type</span>
          <div className="kind-switch compact">
            <button
              type="button"
              className={form.companyType === "LCY" ? "on" : ""}
              onClick={() => patch({ companyType: "LCY", company: "LCY" })}
            >
              LCY
            </button>
            <button
              type="button"
              className={form.companyType === "Contractor" ? "on" : ""}
              onClick={() =>
                patch({
                  companyType: "Contractor",
                  company: form.company === "LCY" ? "" : form.company,
                })
              }
            >
              Contractor
            </button>
          </div>
        </div>
        {form.companyType === "LCY" ? (
          <div className="form-field">
            <span>Contractor company</span>
            <div className="readonly-value">LCY</div>
          </div>
        ) : (
          <TouchSelect
            label="Contractor company"
            value={form.company}
            placeholder="Select company"
            options={COMPANIES.map((company) => ({ id: company, label: company }))}
            onChange={(id) => patch({ company: id })}
          />
        )}
        <label className="form-field">
          <span>Requester</span>
          <input value={form.requester} onChange={(event) => patch({ requester: event.target.value })} />
        </label>
        <label className="form-field">
          <span>Craft / permit receiver</span>
          <input value={form.craft} onChange={(event) => patch({ craft: event.target.value })} />
        </label>
        <div className="form-pair">
          <label className="form-field">
            <span>Planned start</span>
            <input className="mono-input" type="time" value={form.plannedStart} onChange={(event) => patch({ plannedStart: event.target.value })} />
          </label>
          <label className="form-field">
            <span>Planned expiration</span>
            <input className="mono-input" type="time" value={form.plannedEnd} onChange={(event) => patch({ plannedEnd: event.target.value })} />
          </label>
        </div>
      </div>
      {form.kind === "general" ? <ExclusionList form={form} setField={setField} /> : null}
    </Section>
  );
}

function ExclusionList({
  form,
  setField,
}: {
  form: PermitDraft;
  setField: (key: string, value: string) => void;
}) {
  return (
    <div className="exclusion-block">
      <div className="subhead">CONFIRM THE WORK DOES NOT INCLUDE</div>
      <div className="exclusion-list">
        {GENERAL_EXCLUSIONS.map((item) => {
          const value = form.fields[item.key] ?? "";
          return (
            <div key={item.key} className={value === "included" ? "exclusion binary included" : "exclusion binary"}>
              <span>{item.label}</span>
              <div className="kind-switch compact" role="group" aria-label={item.label}>
                <button
                  type="button"
                  className={value === "excluded" ? "on" : ""}
                  onClick={() => setField(item.key, "excluded")}
                >
                  Not included
                </button>
                <button
                  type="button"
                  className={value === "included" ? "on is-included" : ""}
                  onClick={() => setField(item.key, "included")}
                >
                  Included
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TypeRecommendationNotice({
  form,
  onUse,
}: {
  form: PermitDraft;
  onUse: (kind: PermitKind) => void;
}) {
  const items = typeRecommendations(form);
  if (items.length === 0) return null;
  return (
    <div className="recommend">
      <div className="kicker">TYPE RECOMMENDATION</div>
      <p>This scope sits outside General Work. The same job can move onto the permit that covers it.</p>
      {items.map((item) => (
        <div key={item.kind} className="recommend-row">
          <div>
            <strong>{kindTitle(item.kind)}</strong>
            <div className="recommend-reason">{item.reasons.join(" · ")}</div>
          </div>
          <button type="button" className="btn btn-hold" onClick={() => onUse(item.kind)}>
            Use this type
          </button>
        </div>
      ))}
    </div>
  );
}

function DetailStep({
  form,
  setField,
}: {
  form: PermitDraft;
  setField: (key: string, value: string) => void;
}) {
  return (
    <Section index="04" title="PERMIT DETAILS">
      <div className="form-grid">
        {detailFields(form.kind).map((item) => (
          <label key={item.key} className={item.wide ? "form-field span-2" : "form-field"}>
            <span>{item.label}</span>
            {item.wide ? (
              <textarea value={form.fields[item.key] ?? ""} onChange={(event) => setField(item.key, event.target.value)} />
            ) : (
              <input value={form.fields[item.key] ?? ""} onChange={(event) => setField(item.key, event.target.value)} />
            )}
          </label>
        ))}
      </div>
    </Section>
  );
}

function ChoiceStep({
  index,
  title,
  options,
  selected,
  onToggle,
  otherKey,
  otherLabel,
  otherValue,
  onOther,
}: {
  index: string;
  title: string;
  options: readonly string[];
  selected: string[];
  onToggle: (value: string) => void;
  otherKey: string;
  otherLabel: string;
  otherValue: string;
  onOther: (value: string) => void;
}) {
  return (
    <Section index={index} title={title}>
      <div className="choice-grid">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            className={selected.includes(option) ? "toggle on" : "toggle"}
            aria-pressed={selected.includes(option)}
            onClick={() => onToggle(option)}
          >
            <span className="toggle-mark" aria-hidden="true" />
            <span className="toggle-label">{option}</span>
            <span className="toggle-state">{selected.includes(option) ? "SELECTED" : "OPEN"}</span>
          </button>
        ))}
      </div>
      {selected.includes(otherKey) ? (
        <label className="form-field other-field">
          <span>{otherLabel}</span>
          <input value={otherValue} onChange={(event) => onOther(event.target.value)} />
        </label>
      ) : null}
    </Section>
  );
}

function ReviewStep({ form }: { form: PermitDraft }) {
  const details = detailFields(form.kind).filter((item) => (form.fields[item.key] ?? "").trim());
  return (
    <div className="review-grid">
      <Section index="01" title="SCOPE">
        <div className="field-grid">
          <Field label="Permit type" value={kindTitle(form.kind)} />
          <Field label="Area" value={form.area} />
          <Field label="Equipment / tag" value={form.place} mono />
          <Field label="Work order" value={form.workOrder} mono />
          <Field label="Describe the work" value={form.description} wide />
          <Field label="Company type" value={form.companyType} />
          <Field label="Company" value={form.company} />
          <Field label="Requester" value={form.requester} />
          <Field label="Craft / permit receiver" value={form.craft} />
          <Field label="Planned start" value={form.plannedStart} mono />
          <Field label="Planned expiration" value={form.plannedEnd} mono />
          {form.kind === "general"
            ? GENERAL_EXCLUSIONS.map((item) => (
                <Field
                  key={item.key}
                  label={item.label}
                  value={form.fields[item.key] === "included" ? "Included" : form.fields[item.key] === "excluded" ? "Not included" : ""}
                />
              ))
            : null}
        </div>
      </Section>
      <Section index="02" title="HAZARDS">
        {form.hazards.length === 0 ? (
          <p className="empty tight">No hazards selected.</p>
        ) : (
          <ul className="taglist hazard">
            {form.hazards.map((item) => (
              <li key={item}>{item === "other" && form.fields.otherHazard ? form.fields.otherHazard : item}</li>
            ))}
          </ul>
        )}
      </Section>
      <Section index="03" title="CONTROLS">
        {form.controls.length === 0 ? (
          <p className="empty tight">No controls selected.</p>
        ) : (
          <ul className="taglist">
            {form.controls.map((item) => (
              <li key={item}>
                {item === "other controls" && form.fields.otherControl ? form.fields.otherControl : item}
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section index="04" title="PERMIT DETAILS">
        {details.length === 0 ? (
          <p className="empty tight">No detail fields entered.</p>
        ) : (
          <div className="field-grid">
            {details.map((item) => (
              <Field key={item.key} label={item.label} value={form.fields[item.key] ?? ""} wide={item.wide} />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function AuthorizationStep({
  form,
  signError,
  setSignError,
  blockers,
}: {
  form: PermitDraft;
  signError: string;
  setSignError: (roleId: string) => void;
  blockers: string[];
}) {
  const { updateForm } = usePermits();
  const roles = authorizationRoles(form);

  return (
    <Section index="06" title="AUTHORIZATION">
      <div className="auth-grid">
        {roles.map((role) => {
          const signature = form.signatures[role.id];
          return (
            <article key={role.id} className={signature ? "auth signed" : "auth"}>
              <header>
                <span className="idx">{role.required ? "REQ" : "COND"}</span>
                <h3>{role.label}</h3>
              </header>
              {signature ? (
                <>
                  <div className="auth-name">{signature.name}</div>
                  <div className="auth-time mono">{signature.time}</div>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() =>
                      updateForm((current) => {
                        const signatures = { ...current.signatures };
                        delete signatures[role.id];
                        return { ...current, signatures };
                      })
                    }
                  >
                    Clear
                  </button>
                </>
              ) : (
                <>
                  <label className="form-field">
                    <span>Name</span>
                    <input
                    value={form.names[role.id] ?? ""}
                    onChange={(event) => {
                      const value = event.target.value;
                      setSignError("");
                      updateForm((current) => ({
                        ...current,
                        names: { ...current.names, [role.id]: value },
                      }));
                    }}
                    />
                  </label>
                  {signError === role.id ? <p className="form-error">Enter a name before signing.</p> : null}
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      const name = (form.names[role.id] ?? "").trim();
                      if (!name) {
                        setSignError(role.id);
                        return;
                      }
                      const time = plantClock().hm;
                      updateForm((current) => ({
                        ...current,
                        signatures: { ...current.signatures, [role.id]: { name, time } },
                      }));
                    }}
                  >
                    Sign
                  </button>
                </>
              )}
            </article>
          );
        })}
      </div>
      <div className="blocker">
        <div className="kicker">REVIEW</div>
        <p>{preparationGaps(form).length === 0 ? "Preparation is complete." : "Preparation is not complete."}</p>
        <p>Names recorded here are on this device. They are not authenticated signatures.</p>
        <p>Submit for Review is allowed after the draft is saved and preparation is complete. Authorize, Accept, and Activate stay unavailable until an authenticated person holds that role.</p>
        {blockers.length > 0 ? (
          <ul>
            {blockers.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          <p>Required role names are recorded. That does not authorize work.</p>
        )}
      </div>
    </Section>
  );
}
