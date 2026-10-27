import { useEffect, useRef, useState } from "react";
import { contractors } from "../data/mock";
import { GENERAL_EXCLUSIONS, PERMIT_TYPES, typeRecommendations } from "../permitTypes";
import { plantClock } from "../plantClock";
import { areaIdForName, areaPickerMessage, areaSelection, type AreaCatalog } from "../services/areas";
import { catalogLabel } from "../services/catalogLabels";
import { useAreaCatalog } from "../services/useAreaCatalog";
import { useDevice } from "../services/device";
import { localDraftLabel, submitLocalPermit } from "../services/generalWorkDraft";
import { useIdentity } from "../services/identity";
import { describePermitSave } from "../services/syncStatus";
import { draftDocumentTarget, documentActionPlacement } from "../services/permitDocumentActions";
import { localFailureMessage, logLocalSaveFailure } from "../services/localStore";
import { usePermits } from "../state/PermitStore";
import type { PermitDraft, PermitKind } from "../types";
import {
  CONTROLS,
  HAZARDS,
  STEPS,
  authorizationRoles,
  canSubmitForReview,
  detailFields,
  issueBlockers,
  preparationGaps,
  preparationSections,
  kindTitle,
  toggleItem,
} from "../workflow";
import { useComposition } from "../components/Composition";
import { PermitDocumentActions } from "../components/PermitDocumentActions";
import { Field, Section, TouchSelect } from "../components/ui";
import { ContextualBack } from "../components/ContextualBack";
const COMPANIES = contractors.filter((item) => item.name !== "LCY").map((item) => item.name);

export function NewPermit() {
  const { form, updateForm, saveDraft, resetForm, originSnapshot } = usePermits();
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
  const saveLine = saveError || describePermitSave(form, link.link);
  const [typeChosen, setTypeChosen] = useState(() => Boolean(form.id) || form.step > 0);

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
      {typeChosen ? null : (
        <TypeChooser onSelect={(kind) => { patch({ kind, step: 0 }); setTypeChosen(true); }} />
      )}
      {typeChosen ? (
      <>
      {originSnapshot?.captured ? <ContextualBack permitNumber={form.permitNumber ?? undefined} /> : null}
      <div className="steps">
        {STEPS.map((item, index) => (
          <button
            key={item.num}
            type="button"
            className={form.step === index ? "step current" : index < form.step ? "step done" : "step"}
            onClick={() => patch({ step: index })}
          >
            <span className="step-num">{item.num}</span>
            <span className="step-label">{item.label === "PERMIT DETAILS" ? "DETAILS" : item.label}</span>
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
        <div className="kind-meta mono">
          {kindTitle(form.kind)}
          {" · "}
          {form.permitNumber ? form.permitNumber : form.id ? `LOCAL DRAFT ${localDraftLabel(form.id)}` : "UNSAVED"}
        </div>
        {form.step === 0 ? (
          <button type="button" className="btn btn-ghost" onClick={() => setTypeChosen(false)}>
            Change permit type
          </button>
        ) : null}
        <button type="button" className="btn btn-ghost" onClick={() => { resetForm(); setTypeChosen(false); setSaveError(""); }}>
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

      {form.preserveWorkingState ? (
        <p className="field-note">This permit uses a saved format this version cannot edit. The original record was not changed.</p>
      ) : null}
      <div className="workflow-stage">
        <div className="workflow-main">
          <p className="step-purpose">{STEP_PURPOSE[form.step]}</p>
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
          {form.step === 4 && <ReviewStep form={form} onOpen={(index) => patch({ step: index })} />}
          {form.step === 5 && (
            <AuthorizationStep form={form} link={link.link} signError={signError} setSignError={setSignError} onOpen={(index) => patch({ step: index })} />
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
                .catch((error: unknown) => {
                  logLocalSaveFailure("save_draft", form, error);
                  setSaveError(localFailureMessage(error));
                })
                .finally(() => {
                  savingRef.current = false;
                  setSaving(false);
                });
            }}
          >
            {form.id ? "Save Changes" : "Save Draft"}
          </button>
          {form.step < 5 ? (
            <button type="button" className="btn btn-next" onClick={() => patch({ step: form.step + 1 })}>
              Continue
            </button>
          ) : form.lifecycleStatus === "PENDING_REVIEW" ? null : (
            <button
              type="button"
              className="btn btn-next"
              disabled={!canSubmitForReview(form) || saving}
              onClick={() => {
                if (savingRef.current) return;
                if (!canSubmitForReview(form)) {
                  const gaps = preparationGaps(form);
                  setSaveError(gaps.length > 0 ? `PERMIT NOT READY. Complete: ${gaps.join(", ")}.` : "PERMIT NOT READY.");
                  return;
                }
                savingRef.current = true;
                setSaving(true);
                setSaveError("");
                void saveDraft()
                  .then((saved) => submitLocalPermit(saved.id, identity.user?.id))
                  .then((saved) => {
                    updateForm(() => saved);
                    setSaveError("");
                  })
                  .catch((error: unknown) => {
                    logLocalSaveFailure("submit_for_review", form, error);
                    setSaveError(localFailureMessage(error));
                  })
                  .finally(() => {
                    savingRef.current = false;
                    setSaving(false);
                  });
              }}
            >
              Submit for Review
            </button>
          )}
        </div>
      </footer>
      </>
      ) : null}
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
          searchable={false}
          emptyMessage={areaPickerMessage(catalog)}
          options={areas.map((area) => ({ id: area.id, label: area.name }))}
          onChange={(id) => patch(areaSelection(areas, id))}
        />
        <AreaNote form={form} catalog={catalog} />
        <label className="form-field">
          <span>Equipment / tag</span>
          <input type="text" className="mono-input" value={form.place} onChange={(event) => patch({ place: event.target.value })} />
        </label>
        <label className="form-field">
          <span>Work order</span>
          <input type="text" className="mono-input" value={form.workOrder} onChange={(event) => patch({ workOrder: event.target.value })} />
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
          <input type="text" value={form.requester} onChange={(event) => patch({ requester: event.target.value })} />
        </label>
        <label className="form-field">
          <span>Craft / permit receiver</span>
          <input type="text" value={form.craft} onChange={(event) => patch({ craft: event.target.value })} />
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
              <input type="text" value={form.fields[item.key] ?? ""} onChange={(event) => setField(item.key, event.target.value)} />
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
            <span className="toggle-label">{catalogLabel(option)}</span>
            <span className="toggle-state">{selected.includes(option) ? "SELECTED" : "OPEN"}</span>
          </button>
        ))}
      </div>
      {selected.includes(otherKey) ? (
        <label className="form-field other-field">
          <span>{otherLabel}</span>
          <input type="text" value={otherValue} onChange={(event) => onOther(event.target.value)} />
        </label>
      ) : null}
    </Section>
  );
}

function TypeChooser({ onSelect }: { onSelect: (kind: PermitKind) => void }) {
  return (
    <div className="type-select">
      <div className="kicker">NEW PERMIT</div>
      <h1>Select Permit Type</h1>
      <div className="type-choices">
        {PERMIT_TYPES.map((type) => (
          <button key={type.id} type="button" onClick={() => onSelect(type.id)}>
            <strong>{type.title}</strong>
            <span>{TYPE_SUMMARY[type.id]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

const STEP_PURPOSE = [
  "What work is being performed and where?",
  "What can harm people, equipment or the plant?",
  "How are those hazards controlled?",
  "What additional permit-specific requirements apply?",
  "Is the permit complete and accurate?",
  "Who must approve or accept the permit before work begins?",
];

const TYPE_SUMMARY: Record<PermitKind, string> = {
  general: "Routine and non-intrusive work",
  "hot-work": "Welding, cutting, grinding and other ignition-producing work",
  "confined-space": "Entry into a configured confined space",
  "opening-blinding": "Process opening, line breaking, blinding and related work",
  excavation: "Excavation and ground-disturbance work",
  "live-electrical": "Work involving energized electrical systems",
};

function reviewStepFor(gap: string): number {
  if (gap === "At least one hazard") return 1;
  if (gap === "Controls") return 2;
  if (gap === "PPE") return 3;
  return 0;
}

function ReviewStep({ form, onOpen }: { form: PermitDraft; onOpen: (step: number) => void }) {
  const details = detailFields(form.kind).filter((item) => (form.fields[item.key] ?? "").trim());
  const gaps = preparationGaps(form);
  const sections = preparationSections(form);
  const first = gaps[0];
  return (
    <div className="review-grid">
      <section className="readiness" aria-label="Review status">
        {sections.map((section) => (
          <p key={section.label}><span>{section.label}</span><strong>{section.complete ? "COMPLETE" : "INCOMPLETE"}</strong></p>
        ))}
        <p><span>People</span><strong>{form.requester.trim() && form.craft.trim() ? "COMPLETE" : "REQUIRED"}</strong></p>
        <p><span>Authorization Readiness</span><strong>{gaps.length === 0 ? "COMPLETE" : "PENDING"}</strong></p>
        {first ? (
          <div className="readiness-action">
            <p>{first}</p>
            <button type="button" className="btn" onClick={() => onOpen(reviewStepFor(first))}>Review {first}</button>
          </div>
        ) : null}
      </section>
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
              <li key={item}>{item === "other" && form.fields.otherHazard ? form.fields.otherHazard : catalogLabel(item)}</li>
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
                {item === "other controls" && form.fields.otherControl ? form.fields.otherControl : catalogLabel(item)}
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
  link,
  signError,
  setSignError,
  onOpen,
}: {
  form: PermitDraft;
  link: string;
  signError: string;
  setSignError: (roleId: string) => void;
  onOpen: (step: number) => void;
}) {
  const { updateForm } = usePermits();
  const roles = authorizationRoles(form).filter((role) => role.required || form.signatures[role.id]);
  const gaps = preparationGaps(form);
  const first = gaps[0];

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
                    type="text"
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
        <div className="kicker">PERMIT READINESS</div>
        {preparationSections(form).map((section) => (
          <p key={section.label}>{section.label} {section.complete ? "COMPLETE" : "INCOMPLETE"}</p>
        ))}
        {form.lifecycleStatus === "PENDING_REVIEW" ? (
          <p>Pending review. Saved locally. This permit is not authorized for work.</p>
        ) : first ? (
          <div className="readiness-action">
            <p>{gaps.length} {gaps.length === 1 ? "ITEM REQUIRES ATTENTION" : "ITEMS REQUIRE ATTENTION"}</p>
            <p>{first}</p>
            <button type="button" className="btn" onClick={() => onOpen(reviewStepFor(first))}>Review {first}</button>
          </div>
        ) : (
          <>
            <p>Plant Link {link === "ready" ? "is ready" : "is offline"}.</p>
            <p>
              {link === "ready"
                ? "Submitting now saves the review request on this device and synchronizes it while Plant Link is ready."
                : "Submitting now will save the review request locally. Permit Control will synchronize it automatically when the plant connection returns."}
            </p>
            <p>Submit for Review does not authorize work.</p>
          </>
        )}
        <p>Names recorded here are on this device. They are not authenticated signatures.</p>
        {gaps.length === 0 ? <p>Required role names are recorded. That does not authorize work.</p> : null}
      </div>
    </Section>
  );
}
