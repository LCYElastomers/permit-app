import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { checkingPlantLink, syncMayStart, type PlantLink, type PlantLinkSnapshot } from "../lib/connectivity";
import { presentAreaCatalog, type AreaCatalog, type AreaRecord } from "./areas";
import { refreshAreaCatalog } from "./areaRefresh";
import { listCachedAreas, notePlantContact, noteSyncCycle, onLocalStoreChanged, readLocalStatus, type LocalView } from "./localStore";
import { pushGeneralWorkCreates, pushPermitSubmissions, type PushStep } from "./permitPush";
import { startPlantLinkMonitor } from "./plantLink";
import { SyncCoordinator } from "./syncCoordinator";
import { syncNowNotice, type SyncProgress } from "./syncStatus";

interface DeviceState {
  link: PlantLinkSnapshot;
  local: LocalView;
  areas: AreaCatalog;
  syncNotice: string | null;
  syncProgress: SyncProgress | null;
  requestSyncNow: () => void;
}

const DeviceContext = createContext<DeviceState | null>(null);

export function DeviceProvider({ children }: { children: ReactNode }) {
  const [link, setLink] = useState<PlantLinkSnapshot>(checkingPlantLink);
  const [local, setLocal] = useState<LocalView>({ status: "checking" });
  const [cachedAreas, setCachedAreas] = useState<AreaRecord[] | null>(null);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const linkRef = useRef<PlantLink>(checkingPlantLink.link);
  const coordinatorRef = useRef<SyncCoordinator | null>(null);

  const requestSyncNow = useCallback(() => {
    const coordinator = coordinatorRef.current;
    if (!coordinator) {
      setSyncNotice(syncNowNotice({ started: false, reason: "store" }));
      return;
    }
    setSyncNotice(syncNowNotice(coordinator.requestSyncNow()));
  }, []);

  useEffect(() => {
    let stopped = false;
    const report = (index: number, total: number) => {
      if (!stopped) setSyncProgress({ index, total });
    };
    const showStored = async () => {
      const status = await readLocalStatus().catch(() => null);
      if (!stopped && status) setLocal({ status: "available", ...status });
    };
    const settle = async (step: PushStep) => {
      if (step === "storage-failed") {
        await noteSyncCycle("stopped").catch(() => undefined);
        if (!stopped) setLocal({ status: "failed" });
        return true;
      }
      if (step === "deferred") {
        await showStored();
        return true;
      }
      if (step === "stopped") {
        await noteSyncCycle("stopped").catch(() => undefined);
        await showStored();
        return true;
      }
      return false;
    };
    const coordinator = new SyncCoordinator(async (signal) => {
      if (stopped || signal.aborted || !syncMayStart(linkRef.current)) return;
      try {
        const started = await noteSyncCycle("start");
        if (!stopped) setLocal({ status: "available", ...started });
      } catch {
        if (!stopped) setLocal({ status: "failed" });
        return;
      }
      if (stopped || signal.aborted || !syncMayStart(linkRef.current)) {
        await noteSyncCycle("stopped").catch(() => undefined);
        if (!stopped) setSyncProgress(null);
        return;
      }
      const outcome = await refreshAreaCatalog({ link: linkRef.current, signal });
      if (stopped) return;
      if (outcome === "storage-failed") {
        await noteSyncCycle("stopped").catch(() => undefined);
        setLocal({ status: "failed" });
        setSyncProgress(null);
        return;
      }
      if (outcome === "updated") {
        try {
          setCachedAreas(await listCachedAreas());
        } catch {
          if (!stopped) setLocal({ status: "failed" });
          return;
        }
      }
      if (stopped || signal.aborted || !syncMayStart(linkRef.current)) {
        await noteSyncCycle("stopped").catch(() => undefined);
        if (!stopped) setSyncProgress(null);
        return;
      }
      const pushed = await pushGeneralWorkCreates({ link: () => linkRef.current, signal, onProgress: report });
      if (stopped) return;
      if (await settle(pushed)) {
        if (!stopped) setSyncProgress(null);
        return;
      }
      if (stopped || signal.aborted || !syncMayStart(linkRef.current)) {
        await noteSyncCycle("stopped").catch(() => undefined);
        if (!stopped) setSyncProgress(null);
        return;
      }
      const submitted = await pushPermitSubmissions({ link: () => linkRef.current, signal, onProgress: report });
      if (stopped) return;
      if (await settle(submitted)) {
        if (!stopped) setSyncProgress(null);
        return;
      }
      try {
        const status = await noteSyncCycle("stopped");
        if (!stopped) {
          setLocal({ status: "available", ...status });
          setSyncProgress(null);
        }
      } catch {
        if (!stopped) setLocal({ status: "failed" });
      }
    });
    coordinatorRef.current = coordinator;

    const stopMonitor = startPlantLinkMonitor((snapshot) => {
      if (stopped) return;
      linkRef.current = snapshot.link;
      setLink(snapshot);
      if (syncMayStart(snapshot.link)) setSyncNotice(null);
      coordinator.onPlantLink(snapshot.link);
      if (snapshot.link === "ready" || snapshot.link === "api-online") {
        void notePlantContact()
          .then((status) => {
            if (stopped) return;
            setLocal((current) =>
              current.status === "available" && current.syncState === "SYNCING" ? current : { status: "available", ...status },
            );
          })
          .catch(() => undefined);
      }
    });

    void (async () => {
      try {
        const status = await readLocalStatus();
        const areas = await listCachedAreas();
        if (stopped) return;
        setCachedAreas(areas);
        setLocal({ status: "available", ...status });
        coordinator.onStoreReady();
      } catch {
        if (!stopped) setLocal({ status: "failed" });
      }
    })();

    const stopStoreWatch = onLocalStoreChanged((reason) => {
      void readLocalStatus()
        .then((status) => {
          if (stopped) return;
          setLocal((current) => {
            if (current.status === "available" && current.syncState === "SYNCING") {
              return { ...current, pendingCount: status.pendingCount, lastPermitSyncAt: status.lastPermitSyncAt };
            }
            return { status: "available", ...status };
          });
        })
        .catch(() => {
          if (!stopped) setLocal({ status: "failed" });
        });
      if (reason === "draft-saved" && syncMayStart(linkRef.current)) coordinator.onOutboxCreated();
    });

    return () => {
      stopped = true;
      coordinatorRef.current = null;
      coordinator.stop();
      stopMonitor();
      stopStoreWatch();
    };
  }, []);

  const value = useMemo<DeviceState>(() => {
    const areas = presentAreaCatalog(
      local.status,
      cachedAreas,
      local.status === "available" ? local.referenceAreasSyncedAt : null,
    );
    return { link, local, areas, syncNotice, syncProgress, requestSyncNow };
  }, [cachedAreas, link, local, requestSyncNow, syncNotice, syncProgress]);

  return <DeviceContext.Provider value={value}>{children}</DeviceContext.Provider>;
}

export function useDevice(): DeviceState {
  const device = useContext(DeviceContext);
  if (!device) throw new Error("Device status is unavailable.");
  return device;
}
