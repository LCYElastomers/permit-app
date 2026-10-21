import { useState } from "react";
import { contractors } from "../data/mock";
import { GENERAL_EXCLUSIONS, PERMIT_TYPES, typeRecommendations } from "../permitTypes";
import { plantClock } from "../plantClock";
import { usePermits } from "../state/PermitStore";
import type { PermitDraft, PermitKind } from "../types";
import {
  AREAS,
  CONTROLS,
  HAZARDS,
  STEPS,
  authorizationRoles,
  detailFields,
  issueBlockers,
  kindTitle,
  toggleItem,
} from "../workflow";
import { Field, Section } from "../components/ui";

const COMPANIES = contractors.filter((item) => item.name !== "LCY").map((item) => item.name);

export function NewPermit() {
  const { form, updateForm, saveDraft, issuePermit, resetForm } = usePermits();
  const [saved, setSaved] = useState("");
  const [signError, setSignError] = useState("");
  const blockers = issueBlockers(form);

  const patch = (partial: Partial<PermitDraft>) => {
    updateForm((current) => ({ ...current, ...partial }));
  };

  const setField = (key: string, value: string) => {
    updateForm((current) => ({ ...current, fields: { ...current.fields, [key]: value } }));
  };

  return (
    <div className="screen fill workflow">
      <div className="steps">
        {STEPS.map((step, index) => (
          <button
            key={step.num}
            type="button"
            className={form.step === index ? "step current" : "step"}
            onClick={() => patch({ step: index })}
          >
            <span className="step-num">{step.num}</span>
            <span className="step-label">{step.label}</span>
          </button>
        ))}
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
        <div className="kind-meta mono">{form.code || "UNSAVED"}</div>
        <button type="button" className="btn btn-ghost" onClick={() => { resetForm(); setSaved(""); }}>
          Clear
        </button>
      </div>

      <div className="workflow-body">
        {saved ? <div className="notice">Draft {saved} saved on this station.</div> : null}
        <TypeRecommendationNotice form={form} onUse={(kind) => patch({ kind })} />
        {form.step === 0 && <ScopeStep form={form} patch={patch} setField={setField} />}
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

      <footer className="workflow-foot">
        <button
          type="button"
          className="btn btn-ghost"
          disabled={form.step === 0}
          onClick={() => patch({ step: Math.max(0, form.step - 1) })}
        >
          Back
        </button>
        <div className="foot-actions">
          <button
            type="button"
            className="btn"
            onClick={() => {
              const code = saveDraft();
              setSaved(code);
            }}
          >
            Save Draft
          </button>
          {form.step < 5 ? (
            <button type="button" className="btn" onClick={() => patch({ step: form.step + 1 })}>
              Continue
            </button>
          ) : (
            <button type="button" className="btn btn-danger" disabled={blockers.length > 0} onClick={() => issuePermit()}>
              Issue Permit
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

function ScopeStep({
  form,
  patch,
  setField,
}: {
  form: PermitDraft;
  patch: (partial: Partial<PermitDraft>) => void;
  setField: (key: string, value: string) => void;
}) {
  return (
    <Section index="01" title="SCOPE">
      <div className="form-grid">
        <div className="form-field">
          <span>Permit type</span>
          <div className="readonly-value">{kindTitle(form.kind)}</div>
        </div>
        <label className="form-field">
          <span>Area</span>
          <select value={form.area} onChange={(event) => patch({ area: event.target.value })}>
            <option value="">Select area</option>
            {AREAS.map((area) => (
              <option key={area}>{area}</option>
            ))}
          </select>
        </label>
        <label className="form-field">
          <span>Equipment / location</span>
          <input className="mono-input" value={form.place} onChange={(event) => patch({ place: event.target.value })} />
        </label>
        <label className="form-field">
          <span>Work order</span>
          <input className="mono-input" value={form.workOrder} onChange={(event) => patch({ workOrder: event.target.value })} />
        </label>
        <label className="form-field span-2">
          <span>Job description</span>
          <textarea
            value={form.description}
            onChange={(event) => patch({ description: event.target.value })}
            placeholder="Describe the work"
          />
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
        <label className="form-field">
          <span>Contractor company</span>
          {form.companyType === "LCY" ? (
            <div className="readonly-value">LCY</div>
          ) : (
            <select value={form.company} onChange={(event) => patch({ company: event.target.value })}>
              <option value="">Select company</option>
              {COMPANIES.map((company) => (
                <option key={company}>{company}</option>
              ))}
            </select>
          )}
        </label>
        <label className="form-field">
          <span>Requester</span>
          <input value={form.requester} onChange={(event) => patch({ requester: event.target.value })} />
        </label>
        <label className="form-field">
          <span>Craft / permit receiver</span>
          <input value={form.craft} onChange={(event) => patch({ craft: event.target.value })} />
        </label>
        <label className="form-field">
          <span>Planned start</span>
          <input className="mono-input" type="time" value={form.plannedStart} onChange={(event) => patch({ plannedStart: event.target.value })} />
        </label>
        <label className="form-field">
          <span>Planned expiration</span>
          <input className="mono-input" type="time" value={form.plannedEnd} onChange={(event) => patch({ plannedEnd: event.target.value })} />
        </label>
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
            <div key={item.key} className={value === "included" ? "exclusion included" : "exclusion"}>
              <span>{item.label}</span>
              <div className="kind-switch compact">
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
            {option}
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
          <Field label="Equipment / location" value={form.place} mono />
          <Field label="Work order" value={form.workOrder} mono />
          <Field label="Job description" value={form.description} wide />
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
                  <input
                    value={form.names[role.id] ?? ""}
                    placeholder="Name"
                    onChange={(event) => {
                      const value = event.target.value;
                      setSignError("");
                      updateForm((current) => ({
                        ...current,
                        names: { ...current.names, [role.id]: value },
                      }));
                    }}
                  />
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
      {blockers.length > 0 ? (
        <div className="blocker">
          <div className="kicker">OUTSTANDING BEFORE ISSUE</div>
          <ul>
            {blockers.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="notice">Required sign-offs are complete. Issue permit will open the active record.</p>
      )}
    </Section>
  );
}
