import { useEffect, useRef } from "react";
import { assets, contractors, templates } from "../data/mock";
import { usePlantClock } from "../plantClock";
import { usePermits } from "../state/PermitStore";
import type { ListScreen } from "../types";
import { connectivityLabel, connectivityLamp, mockConnectivity } from "../lib/connectivity";
import { plantSnapshot } from "../plantStatus";
import { ActivePermits } from "../screens/ActivePermits";
import { CommandCenter } from "../screens/CommandCenter";
import { ArchiveScreen } from "../screens/ArchiveScreen";
import { ContractorsScreen } from "../screens/ContractorsScreen";
import { DraftsScreen } from "../screens/DraftsScreen";
import { EquipmentScreen } from "../screens/EquipmentScreen";
import { NewPermit } from "../screens/NewPermit";
import { PendingReview } from "../screens/PendingReview";
import { PermitDetail } from "../screens/PermitDetail";
import { SuspendedScreen } from "../screens/SuspendedScreen";
import { TemplatesScreen } from "../screens/TemplatesScreen";

const NAV: { label: string; items: { id: ListScreen; label: string }[] }[] = [
  {
    label: "OPERATIONS",
      items: [
      { id: "command", label: "Command Center" },
      { id: "active", label: "Active Permits" },
      { id: "pending", label: "Pending Review" },
      { id: "suspended", label: "Suspended" },
    ],
  },
  {
    label: "PERMITS",
    items: [
      { id: "new", label: "New Permit" },
      { id: "drafts", label: "Drafts" },
      { id: "archive", label: "Archive" },
    ],
  },
  {
    label: "ADMINISTRATION",
    items: [
      { id: "templates", label: "Templates" },
      { id: "contractors", label: "Contractors" },
      { id: "equipment", label: "Equipment" },
    ],
  },
];

export function Shell() {
  const { permits, drafts, screen, origin, selectedId, go } = usePermits();
  const stageRef = useRef<HTMLElement>(null);

  useEffect(() => {
    stageRef.current?.scrollTo(0, 0);
  }, [screen, selectedId]);

  const countFor = (id: ListScreen): number | null => {
    switch (id) {
      case "command":
        return null;
      case "active":
        return permits.filter((permit) => permit.status === "active").length;
      case "pending":
        return permits.filter((permit) => permit.status === "pending").length;
      case "suspended":
        return permits.filter((permit) => permit.status === "suspended").length;
      case "drafts":
        return drafts.length;
      case "archive":
        return permits.filter((permit) => permit.status === "closed" || permit.status === "expired").length;
      case "templates":
        return templates.length;
      case "contractors":
        return contractors.length;
      case "equipment":
        return assets.length;
      default:
        return null;
    }
  };

  return (
    <div className="shell">
      <aside className="nav">
        <div className="brand">
          <div className="brand-mark" />
          <div>
            <div className="brand-code">LCY</div>
            <div className="brand-name">PERMIT CONTROL</div>
          </div>
        </div>
        <div className="nav-scroll">
          {NAV.map((section) => (
            <div className="nav-section" key={section.label}>
              <div className="nav-label">{section.label}</div>
              {section.items.map((item) => {
                const active = screen === item.id || (screen === "detail" && origin === item.id);
                const count = countFor(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={active ? "nav-item active" : "nav-item"}
                    aria-current={active ? "page" : undefined}
                    onClick={() => go(item.id)}
                  >
                    <span>{item.label}</span>
                    {count !== null ? <span className="count">{count}</span> : null}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <NetworkStatus />
      </aside>
      <div className="workspace">
        <OpsBar />
        <PlantStatus />
        <main className="stage" ref={stageRef}>
          {screen === "command" && <CommandCenter />}
          {screen === "active" && <ActivePermits />}
          {screen === "pending" && <PendingReview />}
          {screen === "suspended" && <SuspendedScreen />}
          {screen === "new" && <NewPermit />}
          {screen === "drafts" && <DraftsScreen />}
          {screen === "archive" && <ArchiveScreen />}
          {screen === "templates" && <TemplatesScreen />}
          {screen === "contractors" && <ContractorsScreen />}
          {screen === "equipment" && <EquipmentScreen />}
          {screen === "detail" && <PermitDetail key={selectedId ?? "none"} />}
        </main>
      </div>
    </div>
  );
}

function NetworkStatus() {
  const link = mockConnectivity.current();
  return (
    <div className="network">
      <div className="network-label">NETWORK</div>
      <div className="network-state">
        <span className={`lamp lamp-${connectivityLamp(link.state)}`} />
        {connectivityLabel(link.state)}
      </div>
      <div className="network-sync mono">Last synced {link.lastSynced ?? "—"}</div>
    </div>
  );
}

function PlantStatus() {
  const { permits, go, showActive } = usePermits();
  const clock = usePlantClock();
  const snap = plantSnapshot(permits, clock.hm);
  return (
    <div className="plant-status">
      <button type="button" onClick={() => showActive("all")}>
        <span className="n ok">{snap.active}</span> ACTIVE
      </button>
      <span className="dot">·</span>
      <button type="button" onClick={() => go("pending")}>
        <span className="n warn">{snap.pending}</span> PENDING
      </button>
      <span className="dot">·</span>
      <button type="button" onClick={() => go("suspended")}>
        <span className="n alert">{snap.suspended}</span> SUSPENDED
      </button>
      <span className="dot">·</span>
      <button type="button" onClick={() => showActive("expiring")}>
        <span className="n warn">{snap.expiring}</span> EXPIRING
      </button>
    </div>
  );
}

function ServerStatus() {
  const link = mockConnectivity.current();
  const label = link.state === "online" ? "SERVER ONLINE" : connectivityLabel(link.state);
  return (
    <div className="ops-seg ops-server">
      <span className={`lamp lamp-${connectivityLamp(link.state)}`} />
      <span>{label}</span>
    </div>
  );
}

function OpsBar() {
  const clock = usePlantClock();
  return (
    <header className="opsbar">
      <div className="ops-seg">
        <span className="ops-plant">BAYTOWN</span>
        <span className="ops-slash">/</span>
        <span>PERMIT CONTROL</span>
      </div>
      <div className="ops-seg">
        <span className="ops-k">SHIFT</span>
        <span className="ops-v">B</span>
      </div>
      <div className="ops-seg ops-clock">
        <span className="mono">{clock.date}</span>
        <span className="mono ops-time">{clock.hms}</span>
      </div>
      <ServerStatus />
    </header>
  );
}
