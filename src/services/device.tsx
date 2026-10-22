import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { checkingPlantLink, syncMayStart, type PlantLink, type PlantLinkSnapshot } from "../lib/connectivity";
import { presentAreaCatalog, type AreaCatalog, type AreaRecord } from "./areas";
import { refreshAreaCatalog } from "./areaRefresh";
import { listCachedAreas, notePlantContact, noteSyncCycle, onLocalStoreChanged, readLocalStatus, type LocalView } from "./localStore";
import { startPlantLinkMonitor } from "./plantLink";
import { SyncCoordinator } from "./syncCoordinator";

interface DeviceState {
  link: PlantLinkSnapshot;
  local: LocalView;
  areas: AreaCatalog;
}

const DeviceContext = createContext<DeviceState | null>(null);

export function DeviceProvider({ children }: { children: ReactNode }) {
  const [link, setLink] = useState<PlantLinkSnapshot>(checkingPlantLink);
  const [local, setLocal] = useState<LocalView>({ status: "checking" });
  const [cachedAreas, setCachedAreas] = useState<AreaRecord[] | null>(null);
  const linkRef = useRef<PlantLink>(checkingPlantLink.link);

  useEffect(() => {
    let stopped = false;
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
        return;
      }
      const outcome = await refreshAreaCatalog({ link: linkRef.current, signal });
      if (stopped) return;
      if (outcome === "storage-failed") {
        await noteSyncCycle("stopped").catch(() => undefined);
        setLocal({ status: "failed" });
        return;
      }
      try {
        const status = await noteSyncCycle("stopped");
        if (outcome === "updated") setCachedAreas(await listCachedAreas());
        if (!stopped) setLocal({ status: "available", ...status });
      } catch {
        if (!stopped) setLocal({ status: "failed" });
      }
    });

    const stopMonitor = startPlantLinkMonitor((snapshot) => {
      if (stopped) return;
      linkRef.current = snapshot.link;
      setLink(snapshot);
      coordinator.onPlantLink(snapshot.link);
      if (snapshot.link === "ready" || snapshot.link === "api-online") {
        void notePlantContact()
          .then((status) => {
            if (!stopped) setLocal({ status: "available", ...status });
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

    const stopStoreWatch = onLocalStoreChanged(() => {
      void readLocalStatus()
        .then((status) => {
          if (!stopped) setLocal({ status: "available", ...status });
        })
        .catch(() => {
          if (!stopped) setLocal({ status: "failed" });
        });
    });

    return () => {
      stopped = true;
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
    return { link, local, areas };
  }, [cachedAreas, link, local]);

  return <DeviceContext.Provider value={value}>{children}</DeviceContext.Provider>;
}

export function useDevice(): DeviceState {
  const device = useContext(DeviceContext);
  if (!device) throw new Error("Device status is unavailable.");
  return device;
}
