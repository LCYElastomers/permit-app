import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { isTextEntry, shouldRestoreModalFocus } from "../services/touchInput";
import { createPortal } from "react-dom";
import type { FieldWidth } from "../services/adminPresentation";

export function AdminPage({ children }: { children: ReactNode }) {
  return <div className="admin-console">{children}</div>;
}

export function AdminHeader({
  title,
  purpose,
  context,
  onBack,
}: {
  title: string;
  purpose?: string;
  context?: string;
  onBack?: () => void;
}) {
  return (
    <header className="admin-header">
      <div>
        {onBack ? (
          <button type="button" className="admin-back" onClick={onBack}>
            ← Administration
          </button>
        ) : (
          <div className="kicker">Administration</div>
        )}
        <h1>{title}</h1>
        {purpose ? <p>{purpose}</p> : null}
      </div>
      {context ? <div className="admin-context">{context}</div> : null}
    </header>
  );
}

export function AdminBreadcrumbs({ items, onSelect }: { items: { id: string; label: string; inert?: boolean }[]; onSelect: (id: string) => void }) {
  return (
    <nav className="admin-crumbs" aria-label="Administration">
      {items.map((item, index) => (
        <span key={item.id}>
          {index > 0 ? <span className="admin-crumb-sep">/</span> : null}
          {index === items.length - 1 || item.inert ? (
            <span aria-current={index === items.length - 1 ? "page" : undefined}>{item.label}</span>
          ) : (
            <button type="button" onClick={() => onSelect(item.id)}>
              {item.label}
            </button>
          )}
        </span>
      ))}
    </nav>
  );
}

type AdminButtonVariant = "primary" | "secondary" | "danger" | "quiet";

export function AdminButton({
  variant = "secondary",
  className,
  type = "button",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: AdminButtonVariant }) {
  return (
    <button type={type} className={`admin-btn admin-btn-${variant}${className ? ` ${className}` : ""}`} {...props}>
      {children}
    </button>
  );
}

export function AdminSection({ title, purpose, children }: { title: string; purpose?: string; children: ReactNode }) {
  return (
    <section className="admin-section">
      <header>
        <h2>{title}</h2>
        {purpose ? <p>{purpose}</p> : null}
      </header>
      {children}
    </section>
  );
}

export function AdminField({
  label,
  help,
  width = "standard",
  children,
}: {
  label: string;
  help?: string;
  width?: FieldWidth;
  children: ReactNode;
}) {
  return (
    <label className={`admin-field admin-w-${width}`}>
      <span>{label}</span>
      {children}
      {help ? <small>{help}</small> : null}
    </label>
  );
}

export function AdminFieldGroup({ children }: { children: ReactNode }) {
  return <div className="admin-fields">{children}</div>;
}

export function AdminToolbar({ children }: { children: ReactNode }) {
  return <div className="admin-toolbar">{children}</div>;
}

export function AdminEmptyState({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="admin-empty">
      <strong>{title}</strong>
      <p>{children}</p>
      {action}
    </div>
  );
}

export function AdminStatus({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "ok" | "warn" }) {
  return <span className={`admin-status is-${tone}`}>{children}</span>;
}

export function AdminError({ title, children, onRetry }: { title: string; children: ReactNode; onRetry?: () => void }) {
  return (
    <div className="admin-error" role="alert">
      <strong>{title}</strong>
      <p>{children}</p>
      {onRetry ? (
        <AdminButton variant="secondary" onClick={onRetry}>
          Try again
        </AdminButton>
      ) : null}
    </div>
  );
}

export function AdminEditorModal({
  title,
  code,
  subtitle,
  subject = "this record",
  wide = false,
  dirty = false,
  primaryLabel,
  onClose,
  onSave,
  onPrevious,
  onNext,
  recordLabel,
  restoreId,
  children,
  error,
}: {
  title: string;
  code?: string;
  subtitle?: string;
  subject?: string;
  wide?: boolean;
  dirty?: boolean;
  primaryLabel: string;
  onClose: () => void;
  onSave: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  recordLabel?: string;
  restoreId?: string | null;
  children: ReactNode;
  error?: ReactNode;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const dirtyRef = useRef(dirty);
  const closeRef = useRef(onClose);
  const restoreRef = useRef(restoreId);
  const [pending, setPending] = useState<(() => void) | null>(null);
  const pendingRef = useRef(pending);
  dirtyRef.current = dirty;
  closeRef.current = onClose;
  restoreRef.current = restoreId;
  pendingRef.current = pending;
  const composition = typeof document === "undefined"
    ? ""
    : [...(document.querySelector(".shell")?.classList ?? [])].find((item) => item.startsWith("composition-")) ?? "";

  const request = (action?: () => void) => {
    if (dirtyRef.current) setPending(() => action ?? (() => closeRef.current()));
    else if (action) action();
    else closeRef.current();
  };
  const requestRef = useRef(request);
  requestRef.current = request;

  useEffect(() => {
    const node = dialogRef.current;
    const previously = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    node?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        if (pendingRef.current) setPending(null);
        else requestRef.current();
        return;
      }
      if (event.key !== "Tab" || !node) return;
      const items = [...node.querySelectorAll<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])")].filter((item) => !item.hasAttribute("disabled"));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (document.activeElement === node || !node.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.classList.add("admin-modal-open");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("admin-modal-open");
      const named = document.body.dataset.adminRestore;
      delete document.body.dataset.adminRestore;
      const restore = named ? document.getElementById(named) : restoreRef.current ? document.getElementById(restoreRef.current) : null;
      const target = restore ?? previously;
      const coarse = window.matchMedia("(any-pointer: coarse)").matches;
      if (target && shouldRestoreModalFocus({ coarse, targetIsText: isTextEntry(target) })) target.focus();
      else if (document.activeElement instanceof HTMLElement && isTextEntry(document.activeElement)) document.activeElement.blur();
    };
  }, []);

  useEffect(() => {
    if (!pending) return;
    dialogRef.current?.querySelector<HTMLElement>(".admin-modal-guard .admin-btn-primary")?.focus();
  }, [pending]);

  const discard = () => {
    const action = pending;
    setPending(null);
    if (action) action();
  };

  const layer = (
    <div className={`admin-modal-layer ${composition}`} onMouseDown={(event) => { if (event.target === event.currentTarget) request(); }}>
      <div
        ref={dialogRef}
        className={`admin-modal${wide ? " is-wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <header className="admin-modal-head">
          <div>
            <h2 id={titleId}>{title}</h2>
            {code ? <p className="admin-modal-code">{code}</p> : null}
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <AdminButton variant="quiet" aria-label="Close" onClick={() => request()}>Close</AdminButton>
        </header>
        {onPrevious || onNext ? (
          <div className="admin-modal-nav">
            <AdminButton variant="quiet" disabled={!onPrevious} onClick={() => onPrevious && request(onPrevious)}>← Previous</AdminButton>
            <span>{recordLabel}</span>
            <AdminButton variant="quiet" disabled={!onNext} onClick={() => onNext && request(onNext)}>Next →</AdminButton>
          </div>
        ) : null}
        <div className="admin-modal-body" onFocus={(event) => event.target instanceof HTMLElement && event.target.scrollIntoView({ block: "nearest" })}>
          {children}
        </div>
        {error ? <div className="admin-modal-alert">{error}</div> : null}
        <footer className="admin-modal-foot">
          <AdminButton variant="secondary" onClick={() => request()}>Cancel</AdminButton>
          <AdminButton variant="primary" onClick={onSave}>{primaryLabel}</AdminButton>
        </footer>
        {pending ? (
          <div className="admin-modal-guard" role="alertdialog" aria-labelledby={`${titleId}-guard`}>
            <strong id={`${titleId}-guard`}>Unsaved changes</strong>
            <p>Changes to {subject} have not been saved.</p>
            <div>
              <AdminButton variant="danger" onClick={discard}>Discard changes</AdminButton>
              <AdminButton variant="primary" onClick={() => setPending(null)}>Keep editing</AdminButton>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );

  return createPortal(layer, document.body);
}
