import { useEffect, useRef, useState } from "react";
import lcyLogo from "../assets/lcy-logo.png";
import { useComposition } from "./Composition";
import { usePermits } from "../state/PermitStore";
import type { ListScreen } from "../types";
import { plantLinkLabel, plantLinkLamp, type PlantLinkSnapshot } from "../lib/connectivity";
import { useDevice } from "../services/device";
import type { LocalView } from "../services/localStore";
import { canPerform } from "../services/plantDirectory";
import { useIdentity } from "../services/identity";
import { describeSync } from "../services/syncStatus";
import { ActivePermits } from "../screens/ActivePermits";
import { CommandCenter } from "../screens/CommandCenter";
import { FieldHome } from "../screens/FieldHome";
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
import { IdentityMenu, SessionBanner } from "./SessionBanner";

const OPERATIONS: { id: ListScreen; label: string }[] = [
  { id: "command", label: "Command Center" },
  { id: "active", label: "Permits" },
  { id: "new", label: "New Permit" },
  { id: "drafts", label: "Drafts" },
  { id: "archive", label: "Archive" },
];

const FIELD_TABS: { id: "home" | "permits" | "new" | "drafts" | "more"; label: string; screen?: ListScreen }[] = [
  { id: "home", label: "HOME", screen: "command" },
  { id: "permits", label: "PERMITS", screen: "active" },
  { id: "new", label: "+ NEW", screen: "new" },
  { id: "drafts", label: "DRAFTS", screen: "drafts" },
  { id: "more", label: "MORE" },
];

const PERMIT_SCREENS: ListScreen[] = ["active", "pending", "suspended"];

export function Shell() {
  const { drafts, screen, origin, selectedId, go, activeView } = usePermits();
  const { link, local } = useDevice();
  const identity = useIdentity();
  const composition = useComposition();
  const stageRef = useRef<HTMLElement>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [newVisit, setNewVisit] = useState(0);
  const showAdmin = canPerform(identity.user, "ADMIN");

  useEffect(() => {
    stageRef.current?.scrollTo(0, 0);
  }, [screen, selectedId]);

  const countFor = (id: ListScreen): number | null => (id === "drafts" ? drafts.length : null);

  const openRoute = (id: ListScreen) => {
    setMoreOpen(false);
    if (id === "new") setNewVisit((visit) => visit + 1);
    go(id);
  };

  const permitsActive =
    PERMIT_SCREENS.includes(screen as ListScreen) ||
    (screen === "detail" && PERMIT_SCREENS.includes(origin));
  const moreActive = moreOpen || ["archive", "templates", "contractors", "equipment", "users", "administration"].includes(screen);
  const navActive = (id: ListScreen) => {
    if (id === "active") return permitsActive;
    return screen === id || (screen === "detail" && origin === id);
  };

  return (
    <div className={`shell composition-${composition}`}>
      {composition === "desktop" ? (
        <aside id="app-nav" className="nav">
          <div className="brand">
            <img className="brand-logo" src={lcyLogo} alt="LCY" />
            <div className="brand-name">PERMIT CONTROL</div>
          </div>
          <div className="nav-scroll">
            <div className="nav-section">
              <div className="nav-label">OPERATIONS</div>
              {OPERATIONS.map((item) => {
                const active = navActive(item.id);
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
            {showAdmin ? (
              <div className="nav-section">
                <div className="nav-label">ADMINISTRATION</div>
                <button
                  type="button"
                  className={screen === "administration" ? "nav-item active" : "nav-item"}
                  aria-current={screen === "administration" ? "page" : undefined}
                  onClick={() => openRoute("administration")}
                >
                  <span>Administration</span>
                </button>
              </div>
            ) : null}
          </div>
        </aside>
      ) : null}
      {composition === "landscape" ? (
        <nav className="field-rail" aria-label="Field">
          {FIELD_TABS.map((tab) => {
            const active =
              tab.id === "home"
                ? screen === "command" || (screen === "detail" && origin === "command")
                :                 tab.id === "permits"
                  ? permitsActive
                  : tab.id === "new"
                    ? screen === "new"
                    : tab.id === "drafts"
                      ? screen === "drafts" || (screen === "detail" && origin === "drafts")
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
        <OpsBar link={link} local={local} showLogo={composition !== "desktop"} />
        {local.status === "failed" ? (
          <div className="storage-banner" role="status">
            <strong>LOCAL DATA UNAVAILABLE</strong>
            <span>Records on this device cannot be read. Plant Link does not restore them.</span>
          </div>
        ) : null}
        <SessionBanner />
        <main className="stage" ref={stageRef}>
          {screen === "command" && (composition === "portrait" ? <FieldHome /> : <CommandCenter />)}
          {screen === "active" && <ActivePermits filter={activeView === "expiring" ? "expiring" : "active"} />}
          {screen === "pending" && <PendingReview />}
          {screen === "suspended" && <SuspendedScreen />}
          {screen === "new" && <NewPermit key={newVisit} />}
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
            <button type="button" onClick={() => openRoute("archive")}>
              <span>Archive</span>
            </button>
            {showAdmin ? (
              <button type="button" onClick={() => openRoute("administration")}>
                <span>Administration</span>
              </button>
            ) : null}
            <p className="more-note">Profile, PIN, and Switch User are in the user menu.</p>
            <NetworkStatus link={link} local={local} />
          </section>
        ) : null}
        {composition === "portrait" ? (
          <nav className="field-tabbar" aria-label="Field">
            {FIELD_TABS.map((tab) => {
              const active =
                tab.id === "home"
                  ? screen === "command" || (screen === "detail" && origin === "command")
                  :                 tab.id === "permits"
                  ? permitsActive
                  : tab.id === "new"
                    ? screen === "new"
                    : tab.id === "drafts"
                      ? screen === "drafts" || (screen === "detail" && origin === "drafts")
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

function OpsBar({ link, local, showLogo }: { link: PlantLinkSnapshot; local: LocalView; showLogo: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="opsbar">
      <div className="ops-seg">
        {showLogo ? <img className="ops-logo" src={lcyLogo} alt="LCY" /> : null}
        <span className="ops-plant">BAYTOWN</span>
        <span className="ops-slash">·</span>
        <span>SHIFT B</span>
      </div>
      <div className="ops-spacer" />
      <div className="ops-link">
        <button
          type="button"
          className="ops-seg ops-server"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <span className={`lamp lamp-${plantLinkLamp(link.link)}`} />
          <span>PLANT {plantLinkLabel(link.link)}</span>
        </button>
        {open ? (
          <div className="link-popover">
            <NetworkStatus link={link} local={local} />
          </div>
        ) : null}
      </div>
      <IdentityMenu />
    </header>
  );
}
