import { useEffect, useRef } from "react";
import { assets, contractors, templates } from "../data/mock";
import { usePlantClock } from "../plantClock";
import { usePermits } from "../state/PermitStore";
import type { ListScreen } from "../types";
import { ActivePermits } from "../screens/ActivePermits";
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
        <div className="network">
          <div className="network-label">NETWORK</div>
          <div className="network-state">
            <span className="lamp lamp-ok" />
            ONLINE
          </div>
          <div className="network-sync mono">Last synced 13:27</div>
        </div>
      </aside>
      <div className="workspace">
        <OpsBar />
        <main className="stage" ref={stageRef}>
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
      <div className="ops-seg ops-server">
        <span className="lamp lamp-ok" />
        <span>SERVER ONLINE</span>
      </div>
    </header>
  );
}
