import { useCallback, useEffect, useState } from "react";
import type { PlantLink } from "../lib/connectivity";
import type { Permit } from "../types";
import { useDevice } from "./device";
import { listPlantPermits, onPlantPermitsChanged, permitFromPlant } from "./plantDirectory";

export const PLANT_LIST_REFRESH_MS = 60_000;

export function plantListsMayRefresh(link: PlantLink): boolean {
  return link === "ready";
}

export function nextPlantRows<T>(previous: T[], result: { ok: true; rows: T[] } | { ok: false }): T[] {
  return result.ok ? result.rows : previous;
}

export function stationSamplePermits<T extends { sample?: boolean; status: string }>(permits: T[], status: string): T[] {
  return permits.filter((permit) => permit.status === status && permit.sample !== false);
}

export function useAuthoritativePermits(statuses: readonly string[]) {
  const { link } = useDevice();
  const ready = plantListsMayRefresh(link.link);
  const [plant, setPlant] = useState<Permit[]>([]);
  const key = statuses.join("\n");
  const refresh = useCallback(async () => {
    if (!plantListsMayRefresh(link.link)) return;
    const requested = key.split("\n").filter((status) => status.length > 0);
    try {
      const groups = await Promise.all(requested.map((status) => listPlantPermits(status)));
      const rows = groups.flat().map(permitFromPlant);
      setPlant((previous) => nextPlantRows(previous, { ok: true, rows }));
    } catch {
      setPlant((previous) => nextPlantRows(previous, { ok: false }));
    }
  }, [key, link.link]);

  useEffect(() => {
    if (!ready) return;
    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, PLANT_LIST_REFRESH_MS);
    const onFocus = () => {
      void refresh();
    };
    window.addEventListener("focus", onFocus);
    const stop = onPlantPermitsChanged(() => {
      void refresh();
    });
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      stop();
    };
  }, [ready, refresh]);

  return { plant, refresh, ready };
}

export function PlantRefresh({ ready, onRefresh }: { ready: boolean; onRefresh: () => void }) {
  return (
    <div className="list-refresh">
      <button type="button" className="btn btn-ghost" onClick={onRefresh} disabled={!ready}>
        Refresh
      </button>
    </div>
  );
}
