import { useState, type ReactNode } from "react";
import { useComposition } from "./Composition";
import type { PermitStatus } from "../types";
import { statusLabel } from "../workflow";

export function ScreenHead({
  kicker,
  title,
  meta,
}: {
  kicker: string;
  title: string;
  meta?: string;
}) {
  return (
    <div className="screen-head">
      <div>
        <div className="kicker">{kicker}</div>
        <h1>{title}</h1>
      </div>
      {meta ? <div className="screen-meta">{meta}</div> : null}
    </div>
  );
}

export function Section({
  index,
  title,
  children,
}: {
  index: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="block">
      <header className="section-head">
        <span className="idx">{index}</span>
        <h2>{title}</h2>
      </header>
      {children}
    </section>
  );
}

export function Field({
  label,
  value,
  mono = false,
  wide = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "field wide" : "field"}>
      <div className="field-label">{label}</div>
      <div className={mono ? "field-value mono" : "field-value"}>{value || "—"}</div>
    </div>
  );
}

export function TouchSelect({
  label,
  value,
  placeholder,
  disabled = false,
  options,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  disabled?: boolean;
  options: { id: string; label: string }[];
  onChange: (id: string) => void;
}) {
  const composition = useComposition();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((option) => option.id === value);

  if (composition === "desktop") {
    return (
      <label className="form-field">
        <span>{label}</span>
        <select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  const needle = query.trim().toLowerCase();
  const shown = options.filter((option) => option.label.toLowerCase().includes(needle));

  return (
    <div className="form-field">
      <span>{label}</span>
      <button type="button" className="picker-trigger" disabled={disabled} onClick={() => setOpen(true)}>
        <span>{selected?.label || placeholder}</span>
        <span aria-hidden="true">›</span>
      </button>
      {open ? (
        <div className="picker-sheet" role="dialog" aria-label={label}>
          <div className="picker-bar">
            <label className="form-field">
              <span>Search</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                onChange("");
                setOpen(false);
                setQuery("");
              }}
            >
              Clear
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setOpen(false);
                setQuery("");
              }}
            >
              Close
            </button>
          </div>
          <div className="picker-list">
            {shown.length === 0 ? <p className="empty">No matches.</p> : null}
            {shown.map((option) => (
              <button
                key={option.id}
                type="button"
                className={option.id === value ? "picker-option on" : "picker-option"}
                onClick={() => {
                  onChange(option.id);
                  setOpen(false);
                  setQuery("");
                }}
              >
                <span>{option.label}</span>
                <span className="picker-state">{option.id === value ? "SELECTED" : "OPEN"}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function Kv({
  label,
  value,
  mono = false,
  className = "",
}: {
  label: string;
  value: string;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={`kv ${className}`.trim()}>
      <span className="k">{label}</span>
      <span className={mono ? "v mono" : "v"}>{value || "—"}</span>
    </div>
  );
}

export function StateMark({ status }: { status: PermitStatus }) {
  const tone =
    status === "active" ? "ok" : status === "suspended" ? "alert" : status === "closed" ? "idle" : "warn";
  return (
    <span className={`state state-${tone}`}>
      <span className={`lamp lamp-${tone}`} />
      {statusLabel(status)}
    </span>
  );
}
