import { CONNECTIVITY_POLL_MS } from "../lib/api/config";
import { checkingPlantLink, formatCheckTime, type PlantLinkSnapshot } from "../lib/connectivity";
import { checkConnectivity } from "./connectivity";

export function startPlantLinkMonitor(onSnapshot: (snapshot: PlantLinkSnapshot) => void): () => void {
  let stopped = false;
  let timer = 0;
  let previous = checkingPlantLink.link;
  const controller = new AbortController();

  const run = async () => {
    let result: Omit<PlantLinkSnapshot, "lastCheck"> | "cancelled";
    try {
      result = await checkConnectivity(controller.signal);
    } catch {
      result = { link: "unreachable" };
    }
    if (stopped || result === "cancelled") return;
    const next = { ...result, lastCheck: formatCheckTime(new Date()) };
    if (import.meta.env.DEV && next.link !== previous) console.info("Plant link", next.link);
    previous = next.link;
    onSnapshot(next);
    timer = window.setTimeout(() => void run(), CONNECTIVITY_POLL_MS);
  };

  void run();
  return () => {
    stopped = true;
    controller.abort();
    window.clearTimeout(timer);
  };
}
