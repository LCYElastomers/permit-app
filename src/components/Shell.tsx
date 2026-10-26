import { useEffect, useRef, useState } from "react";
import lcyLogo from "../assets/lcy-logo.png";
import { useComposition } from "./Composition";
import { assets, contractors, templates } from "../data/mock";
import { usePlantClock } from "../plantClock";
import { usePermits } from "../state/PermitStore";
import type { ListScreen } from "../types";
import { plantLinkLabel, plantLinkLamp, type PlantLinkSnapshot } from "../lib/connectivity";
import { useDevice } from "../services/device";
import type { LocalView } from "../services/localStore";
import { describeSync } from "../services/syncStatus";
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
import { UsersScreen } from "../screens/UsersScreen";
import { AdministrationScreen } from "../screens/AdministrationScreen";
import { SessionBanner } from "./SessionBanner";

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
      { id: "administration", label: "Administration" },
      { id: "users", label: "Users" },
      { id: "templates", label: "Templates" },
      { id: "contractors", label: "Contractors" },
      { id: "equipment", label: "Equipment" },
    ],
  },
];

const FIELD_TABS: { id: "home" | "permits" | "new" | "more"; label: string; screen?: ListScreen }[] = [
  { id: "home", label: "HOME", screen: "command" },
  { id: "permits", label: "PERMITS", screen: "active" },
  { id: "new", label: "+ NEW", screen: "new" },
  { id: "more", label: "MORE" },
];

const MORE_ROUTES: { id: ListScreen; label: string }[] = [
  { id: "pending", label: "Pending Review" },
  { id: "suspended", label: "Suspended" },
  { id: "drafts", label: "Drafts" },
  { id: "archive", label: "Archive" },
  { id: "administration", label: "Administration" },
  { id: "users", label: "Users" },
  { id: "templates", label: "Templates" },
  { id: "contractors", label: "Contractors" },
  { id: "equipment", label: "Equipment" },
];

const PERMIT_SCREENS: ListScreen[] = ["active", "pending", "suspended"];

export function Shell() {
  const { permits, drafts, screen, origin, selectedId, go } = usePermits();
  const { link, local } = useDevice();
  const composition = useComposition();
  const stageRef = useRef<HTMLElement>(null);
  const [moreOpen, setMoreOpen] = useState(false);

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

  const openRoute = (id: ListScreen) => {
    setMoreOpen(false);
    go(id);
  };

  const permitsActive =
    screen === "active" ||
    PERMIT_SCREENS.includes(screen as ListScreen) ||
    (screen === "detail" && PERMIT_SCREENS.includes(origin));
  const moreActive =
    moreOpen || ["drafts", "archive", "templates", "contractors", "equipment", "users", "administration"].includes(screen);

  return (
    <div className={`shell composition-${composition}`}>
      {composition === "desktop" ? (
        <aside id="app-nav" className="nav">
          <div className="brand">
            <img className="brand-logo" src={lcyLogo} alt="LCY" />
            <div className="brand-name">PERMIT CONTROL</div>
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
                      onClick={() => openRoute(item.id)}
                    >
                      <span>{item.label}</span>
                      {count !== null ? <span className="count">{count}</span> : null}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <NetworkStatus link={link} local={local} />
        </aside>
      ) : null}
      {composition === "landscape" ? (
        <nav className="field-rail" aria-label="Field">
          {FIELD_TABS.map((tab) => {
            const active =
              tab.id === "home"
                ? screen === "command" || (screen === "detail" && origin === "command")
                : tab.id === "permits"
                  ? permitsActive
                  : tab.id === "new"
                    ? screen === "new"
                    : moreActive;
            return (
              <button
                key={tab.id}
                type="button"
                className={tab.id === "new" ? (active ? "field-tab is-new active" : "field-tab is-new") : active ? "field-tab active" : "field-tab"}
                aria-current={active ? "page" : undefined}
                onClick={() => {
                  if (tab.id === "more") {
                    setMoreOpen((open) => !open);
                    return;
                  }
                  if (tab.screen) openRoute(tab.screen);
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      ) : null}
      <div className="workspace">
        <OpsBar link={link} showLogo={composition !== "desktop"} />
        {local.status === "failed" ? (
          <div className="storage-banner" role="status">
            <strong>LOCAL DATA UNAVAILABLE</strong>
            <span>Records on this device cannot be read. Plant Link does not restore them.</span>
          </div>
        ) : null}
        {composition === "portrait" ? null : <PlantStatus />}
        <SessionBanner />
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
          {screen === "users" && <UsersScreen />}
          {screen === "administration" && <AdministrationScreen />}
          {screen === "detail" && <PermitDetail key={selectedId ?? "none"} />}
        </main>
        {composition !== "desktop" && moreOpen ? (
          <section className="more-sheet" aria-label="More">
            {MORE_ROUTES.map((item) => (
              <button key={item.id} type="button" onClick={() => openRoute(item.id)}>
                <span>{item.label}</span>
                {countFor(item.id) !== null ? <span className="count">{countFor(item.id)}</span> : null}
              </button>
            ))}
            <NetworkStatus link={link} local={local} />
          </section>
        ) : null}
        {composition === "portrait" ? (
          <nav className="field-tabbar" aria-label="Field">
            {FIELD_TABS.map((tab) => {
              const active =
                tab.id === "home"
                  ? screen === "command" || (screen === "detail" && origin === "command")
                  : tab.id === "permits"
                    ? permitsActive
                    : tab.id === "new"
                      ? screen === "new"
                      : moreActive;
              return (
                <button
                  key={tab.id}
                  type="button"
                  className={tab.id === "new" ? (active ? "field-tab is-new active" : "field-tab is-new") : active ? "field-tab active" : "field-tab"}
                  aria-current={active ? "page" : undefined}
                  onClick={() => {
                    if (tab.id === "more") {
                      setMoreOpen((open) => !open);
                      return;
                    }
                    if (tab.screen) openRoute(tab.screen);
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>
        ) : null}
      </div>
    </div>
  );
}

function NetworkStatus({ link, local }: { link: PlantLinkSnapshot; local: LocalView }) {
  const { requestSyncNow, requestConnect, syncNotice, syncProgress } = useDevice();
  const view = describeSync({
    link: link.link,
    storage: local.status,
    pending: local.status === "available" ? local.pendingCount : 0,
    syncState: local.status === "available" ? local.syncState : null,
    progress: syncProgress,
  });
  const storageFailed = local.status === "failed";
  return (
    <div className={storageFailed ? "network is-storage-failed" : "network"}>
      <div className="network-label">PLANT LINK</div>
      <div className="network-state">
        <span className={`lamp lamp-${plantLinkLamp(link.link)}`} />
        {view.plant}
      </div>
      <div className="network-detail mono">
        <div>
          <strong className={storageFailed ? "storage-alert" : undefined}>{view.primary}</strong>
        </div>
        {view.secondary ? (
          <div>
            <strong>{view.secondary}</strong>
          </div>
        ) : null}
        {view.detail ? (
          <div>
            <strong>{view.detail}</strong>
          </div>
        ) : null}
        <div>
          <span>LAST CHECK</span>
          <strong>{link.lastCheck ?? "—"}</strong>
        </div>
      </div>
      {view.notice ? <p className="sync-notice">{view.notice}</p> : null}
      {syncNotice ? <p className="sync-notice">{syncNotice}</p> : null}
      {link.link === "unreachable" || link.link === "api-online" ? (
        <button type="button" className="sync-now" onClick={requestConnect}>
          CONNECT TO PLANT
        </button>
      ) : null}
      {link.link === "ready" ? (
        <>
          <button type="button" className="sync-now" onClick={requestSyncNow}>
            SYNC NOW
          </button>
          <button type="button" className="sync-now" onClick={requestConnect}>
            CHECK PLANT LINK
          </button>
        </>
      ) : null}
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

function PlantLinkStatus({ link }: { link: PlantLinkSnapshot }) {
  return (
    <div className="ops-seg ops-server">
      <span className={`lamp lamp-${plantLinkLamp(link.link)}`} />
      <span>PLANT {plantLinkLabel(link.link)}</span>
    </div>
  );
}

function OpsBar({ link, showLogo }: { link: PlantLinkSnapshot; showLogo: boolean }) {
  const clock = usePlantClock();
  return (
    <header className="opsbar">
      <div className="ops-seg">
        {showLogo ? <img className="ops-logo" src={lcyLogo} alt="LCY" /> : null}
        <span className="ops-plant">BAYTOWN</span>
        <span className="ops-slash">/</span>
        <span>PERMIT CONTROL</span>
      </div>
      <div className="ops-seg ops-shift">
        <span className="ops-k">SHIFT</span>
        <span className="ops-v">B</span>
      </div>
      <div className="ops-seg ops-clock">
        <span className="mono ops-date">{clock.date}</span>
        <span className="mono ops-time">{clock.hms}</span>
      </div>
      <PlantLinkStatus link={link} />
    </header>
  );
}
