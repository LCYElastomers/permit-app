import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { PermitStatus } from "../types";
import { pickerViewportFrame, visiblePickerOptions } from "../services/picker";
import { statusLabel } from "../workflow";
import { useComposition } from "./Composition";

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
  searchable = true,
  emptyMessage = "No choices are available on this device yet.",
  options,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  disabled?: boolean;
  searchable?: boolean;
  emptyMessage?: string;
  options: { id: string; label: string }[];
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [coarse, setCoarse] = useState(() => typeof window !== "undefined" && window.matchMedia("(any-pointer: coarse)").matches);
  const composition = useComposition();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [frame, setFrame] = useState(() => pickerViewportFrame(
    typeof window === "undefined" || !window.visualViewport
      ? null
      : { height: window.visualViewport.height, offsetTop: window.visualViewport.offsetTop },
    typeof window === "undefined" ? 0 : window.innerHeight,
  ));
  const listId = useId();
  const titleId = `${listId}-title`;
  const selected = options.find((option) => option.id === value);
  const close = () => {
    setOpen(false);
    setQuery("");
    triggerRef.current?.focus();
  };

  useEffect(() => {
    const media = window.matchMedia("(any-pointer: coarse)");
    const apply = () => setCoarse(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    const read = () => {
      const viewport = window.visualViewport;
      setFrame(pickerViewportFrame(
        viewport ? { height: viewport.height, offsetTop: viewport.offsetTop } : null,
        window.innerHeight,
      ));
    };
    read();
    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", read);
    viewport?.addEventListener("scroll", read);
    window.addEventListener("resize", read);
    return () => {
      viewport?.removeEventListener("resize", read);
      viewport?.removeEventListener("scroll", read);
      window.removeEventListener("resize", read);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (searchable && !coarse) searchRef.current?.focus();
    else {
      const current = panel?.querySelector<HTMLElement>(".picker-option.on");
      const first = panel?.querySelector<HTMLElement>(".picker-option");
      (current ?? first ?? panel)?.focus();
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        setQuery("");
        triggerRef.current?.focus();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const items = [...panel.querySelectorAll<HTMLElement>("button, input, [href]")].filter((item) => !item.hasAttribute("disabled"));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [coarse, open, searchable]);

  const shown = visiblePickerOptions(options, searchable ? query : "");
  const sheet = (
    <div
      className={`picker-sheet composition-${composition}`}
      style={{ top: frame.top, height: frame.height }}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        ref={panelRef}
        className="picker-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="picker-bar">
          <div className="picker-heading">
            <div className="picker-title" id={titleId}>{`SELECT ${label.toUpperCase()}`}</div>
            <div className="picker-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  onChange("");
                  close();
                }}
              >
                Clear
              </button>
              <button type="button" className="btn" onClick={close}>
                Close
              </button>
            </div>
          </div>
          {searchable ? (
            <label className="form-field">
              <span>Search</span>
              <input ref={searchRef} type="text" value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
          ) : null}
        </div>
        <div className="picker-list" id={listId} role="listbox" aria-labelledby={titleId}>
          {shown.length === 0 ? <p className="empty">{options.length === 0 ? emptyMessage : "No matches."}</p> : null}
          {shown.map((option) => (
            <button
              key={option.id}
              type="button"
              role="option"
              aria-selected={option.id === value}
              className={option.id === value ? "picker-option on" : "picker-option"}
              onClick={() => {
                onChange(option.id);
                close();
              }}
            >
              <span>{option.label}</span>
              {option.id === value ? <span className="picker-state">SELECTED</span> : null}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="form-field">
      <span id={`${listId}-label`}>{label}</span>
      <button
        ref={triggerRef}
        type="button"
        className={coarse ? "picker-trigger is-coarse" : "picker-trigger"}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-labelledby={`${listId}-label`}
        onClick={() => setOpen(true)}
      >
        <span>{selected?.label || placeholder}</span>
        <span aria-hidden="true">›</span>
      </button>
      {open && typeof document !== "undefined" ? createPortal(sheet, document.body) : null}
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
