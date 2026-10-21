import type { ReactNode } from "react";
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
