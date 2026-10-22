import { usePlantClock } from "../plantClock";
import {
  CONTROL_MODULES,
  areaLoads,
  attentionItems,
  controlHealth,
  dayActivity,
  exposureByKind,
  lifecycle,
  plantSnapshot,
  recentActivity,
} from "../plantStatus";
import { usePermits } from "../state/PermitStore";
import { ScreenHead } from "../components/ui";

export function CommandCenter() {
  const { permits, openPermit, go, showActive } = usePermits();
  const clock = usePlantClock();
  const snap = plantSnapshot(permits, clock.hm);
  const attention = attentionItems(permits, clock.hm);
  const areas = areaLoads(permits, clock.hm).filter((area) => area.active > 0);
  const exposure = exposureByKind(permits);
  const modules = CONTROL_MODULES.map((module) => ({ ...module, value: module.count(permits) }));
  const health = controlHealth(permits, clock.hm);
  const movement = lifecycle(permits, clock.hm);
  const feed = recentActivity(permits);
  const hours = dayActivity(permits);
  const peak = Math.max(1, ...hours.flatMap((hour) => [hour.issued, hour.active, hour.closed]));
  const busiest = Math.max(1, ...areas.map((area) => area.active));

  return (
    <div className="screen command">
      <ScreenHead
        kicker="OPERATIONS"
        title="Permit Command Center"
        meta={`BAYTOWN · SHIFT B · ${clock.date} · ${clock.hm}`}
      />

      <div className="snapshot">
        <SnapshotMetric value={snap.active} label="Active Now" tone="ok" lead onClick={() => showActive("all")} />
        <SnapshotMetric value={snap.pending} label="Pending Review" tone="warn" lead onClick={() => go("pending")} />
        <SnapshotMetric value={snap.suspended} label="Suspended" tone="alert" lead onClick={() => go("suspended")} />
        <SnapshotMetric value={snap.expiring} label="Expiring Soon" tone="warn" lead onClick={() => showActive("expiring")} />
        <SnapshotMetric value={snap.closedToday} label="Closed Today" tone="idle" onClick={() => go("archive")} />
        <SnapshotMetric value={snap.issuedToday} label="Issued Today" tone="idle" onClick={() => go("archive")} />
        <SnapshotMetric value={snap.contractors} label="Contractors Active" tone="idle" onClick={() => go("contractors")} />
        <SnapshotMetric value={snap.areas} label="Areas Active" tone="idle" />
      </div>

      <div className="command-grid">
        <section className="command-panel command-attention">
          <header className="panel-head">
            <h2>Attention Required</h2>
            <span>{attention.length}</span>
          </header>
          {attention.length === 0 ? (
            <p className="empty tight">Nothing is waiting on a decision.</p>
          ) : (
            attention.map((item) => (
              <button key={`${item.kicker}-${item.id}`} type="button" className={`attention tone-${item.tone}`} onClick={() => openPermit(item.id, "command")}>
                <div className="attention-kicker">{item.kicker}</div>
                <div className="attention-id">
                  <span className="mono">{item.id}</span>
                  <span>{item.kind}</span>
                </div>
                <div className="attention-place">{item.place}</div>
                <div className="attention-summary">{item.summary}</div>
                <div className={`attention-meta${item.tone === "alert" ? " is-alert" : ""}`}>{item.meta}</div>
              </button>
            ))
          )}
        </section>

        <div className="command-stack">
          <section className="command-panel command-areas">
            <header className="panel-head">
              <h2>Work by Area</h2>
            </header>
            <div className="area-list">
              {areas.map((area) => (
                <button key={area.area} type="button" className="area-row" onClick={() => showActive("all", area.area)}>
                  <span className="area-name">{area.area}</span>
                  <span className="area-track">
                    <span className="area-fill" style={{ width: `${(area.active / busiest) * 100}%` }} />
                  </span>
                  <span className="area-count">
                    <strong>{area.active}</strong> active
                    {area.expiring > 0 ? <em>{area.expiring} expiring</em> : null}
                    {area.suspended > 0 ? <em className="is-alert">{area.suspended} suspended</em> : null}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="command-panel command-later">
            <header className="panel-head">
              <h2>Current Work Exposure</h2>
            </header>
            <div className="exposure">
              {exposure.map((item) => (
                <div key={item.kind} className="exposure-row">
                  <span>{item.label}</span>
                  <span className="exposure-bar">
                    <span style={{ width: snap.active ? `${(item.count / snap.active) * 100}%` : "0%" }} />
                  </span>
                  <strong>{item.count}</strong>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      <div className="command-grid">
        <section className="command-panel command-controls">
          <header className="panel-head">
            <h2>Active Safety Controls</h2>
          </header>
          <div className="module-list">
            {modules.map((module) => (
              <div key={module.id} className="module-row">
                <span>{module.label}</span>
                <strong>{module.value}</strong>
              </div>
            ))}
          </div>
        </section>
        <section className="command-panel command-later">
          <header className="panel-head">
            <h2>Control Status</h2>
          </header>
          <div className="health-grid">
            {health.map((block) => (
              <div key={block.id} className="health">
                <h3>{block.label}</h3>
                {block.rows.map((row) => (
                  <div key={row.label} className={`health-row tone-${row.tone}`}>
                    <span>{row.label}</span>
                    <strong>{row.value}</strong>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="command-panel command-later">
        <header className="panel-head">
          <h2>Today&apos;s Permit Lifecycle</h2>
        </header>
        <div className="lifecycle">
          {movement.map((item) => (
            <div key={item.label} className="life">
              <strong>{item.value}</strong>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="command-grid">
        <section className="command-panel command-later">
          <header className="panel-head">
            <h2>Recent Activity</h2>
          </header>
          <ol className="feed">
            {feed.map((event) => (
              <li key={`${event.id}-${event.time}-${event.label}`} className={event.tone === "alert" ? "is-alert" : ""}>
                <button type="button" className="feed-hit" onClick={() => openPermit(event.id, "command")}>
                  <span className="mono feed-time">{event.time}</span>
                  <span className="feed-body">
                    <span className="feed-line">
                      <span className="mono">{event.id}</span>
                      <span className="feed-label">{event.label}</span>
                    </span>
                    <span className="feed-where">
                      {event.area}
                      {event.place && event.place !== "—" ? ` · ${event.place}` : ""} · {event.kind}
                    </span>
                    {event.note ? <span className="feed-note">{event.note}</span> : null}
                    {event.readings ? (
                      <span className="feed-reads mono">
                        O2 {event.readings.o2} · LEL {event.readings.lel} · CO {event.readings.co}
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </section>
        <section className="command-panel command-later">
          <header className="panel-head">
            <h2>Permit Activity</h2>
            <span className="panel-note">Issued, became active, and closed by hour</span>
          </header>
          <div className="day-legend">
            <span><i className="swatch issued" /> Issued</span>
            <span><i className="swatch became" /> Active</span>
            <span><i className="swatch closed" /> Closed</span>
          </div>
          <div className="day-chart">
            {hours.map((hour) => (
              <div key={hour.hour} className="day-col">
                <div className="day-bars">
                  <span className="issued" style={{ height: `${(hour.issued / peak) * 100}%` }} />
                  <span className="became" style={{ height: `${(hour.active / peak) * 100}%` }} />
                  <span className="closed" style={{ height: `${(hour.closed / peak) * 100}%` }} />
                </div>
                <span className="mono day-hour">{hour.hour}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function SnapshotMetric({
  value,
  label,
  tone,
  lead = false,
  onClick,
}: {
  value: number;
  label: string;
  tone: "ok" | "warn" | "alert" | "idle";
  lead?: boolean;
  onClick?: () => void;
}) {
  const className = lead ? `metric metric-lead tone-${tone}` : `metric metric-extra tone-${tone}`;
  const body = (
    <>
      <span className="metric-value">{value}</span>
      <span className="metric-label">{label}</span>
    </>
  );
  if (!onClick) {
    return <div className={className}>{body}</div>;
  }
  return (
    <button type="button" className={className} onClick={onClick}>
      {body}
    </button>
  );
}
