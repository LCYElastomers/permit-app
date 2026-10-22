import { useEffect, useState } from "react";
import { CONNECTIVITY_POLL_MS } from "../lib/api/config";
import { checkingConnectivity, formatCheckTime, type ConnectivitySnapshot } from "../lib/connectivity";
import { checkConnectivity } from "./connectivity";

export function useConnectivity(): ConnectivitySnapshot {
  const [snapshot, setSnapshot] = useState<ConnectivitySnapshot>(checkingConnectivity);

  useEffect(() => {
    let stopped = false;
    let timer = 0;
    const controller = new AbortController();

    const run = async () => {
      const result = await checkConnectivity(controller.signal);
      if (stopped || result === "cancelled") return;
      const next = { ...result, lastCheck: formatCheckTime(new Date()) };
      if (import.meta.env.DEV) console.info("Permit API connectivity", next.state);
      setSnapshot(next);
      timer = window.setTimeout(() => void run(), CONNECTIVITY_POLL_MS);
    };

    void run();
    return () => {
      stopped = true;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, []);

  return snapshot;
}
