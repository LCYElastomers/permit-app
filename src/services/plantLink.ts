import { API_TIMEOUT_MS, CONNECTIVITY_POLL_MS } from "../lib/api/config";
import { checkingPlantLink, formatCheckTime, type PlantLink, type PlantLinkSnapshot } from "../lib/connectivity";
import { checkConnectivity } from "./connectivity";

const FOREGROUND_COOLDOWN_MS = 5_000;
const PROBE_DEADLINE_MS = API_TIMEOUT_MS * 2 + 2_000;

export interface PlantLinkController {
  stop: () => void;
  connectNow: () => void;
  noteForeground: () => void;
  noteNetwork: () => void;
}

type ProbeResult = Omit<PlantLinkSnapshot, "lastCheck"> | "cancelled";
type ProbeReason = "start" | "timer" | "manual" | "foreground";

export interface PlantLinkMonitorOptions {
  probe?: (signal: AbortSignal) => Promise<ProbeResult>;
  intervalMs?: number;
  deadlineMs?: number;
  cooldownMs?: number;
  now?: () => number;
}

export function startPlantLinkMonitor(
  onSnapshot: (snapshot: PlantLinkSnapshot) => void,
  options: PlantLinkMonitorOptions = {},
): PlantLinkController {
  const probe = options.probe ?? checkConnectivity;
  const deadlineMs = options.deadlineMs ?? PROBE_DEADLINE_MS;
  const intervalMs = options.intervalMs ?? CONNECTIVITY_POLL_MS;
  const cooldownMs = options.cooldownMs ?? FOREGROUND_COOLDOWN_MS;
  const now = options.now ?? Date.now;
  let stopped = false;
  let running = false;
  let generation = 0;
  let previous: PlantLink = checkingPlantLink.link;
  let lastCheck: string | null = null;
  let lastStarted = 0;
  let lastNetwork = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let active: AbortController | null = null;

  const clearTimer = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  const schedule = (delay: number) => {
    clearTimer();
    if (stopped) return;
    logPlantLink("next probe scheduled", { delayMs: String(delay) });
    timer = setTimeout(() => {
      timer = null;
      void begin("timer");
    }, delay);
  };

  const begin = async (reason: ProbeReason) => {
    if (stopped) return;
    if (reason === "foreground") {
      if (running || now() - lastStarted < cooldownMs) return;
    } else if (running && reason !== "manual") {
      return;
    }
    if (reason === "manual") {
      clearTimer();
      if (running) {
        generation += 1;
        active?.abort();
      }
    }
    const token = ++generation;
    const controller = new AbortController();
    active = controller;
    running = true;
    lastStarted = now();
    logPlantLink("probe started", { reason, previous });
    if (shouldAnnounceChecking(reason, previous)) {
      publish({ link: "checking", lastCheck });
    }
    let result: ProbeResult;
    try {
      result = await boundedProbe(controller.signal, deadlineMs, probe);
    } catch {
      result = { link: "unreachable" };
      logPlantLink("probe failure", { category: "probe-failed" });
    }
    if (active === controller) {
      active = null;
      running = false;
    }
    controller.abort();
    if (stopped || token !== generation) return;
    if (result === "cancelled") {
      logPlantLink("probe failure", { category: "cancelled" });
      lastCheck = formatCheckTime(new Date());
      previous = "unreachable";
      publish({ link: "unreachable", lastCheck });
      schedule(intervalMs);
      return;
    }
    lastCheck = formatCheckTime(new Date());
    const next = { ...result, lastCheck };
    logPlantLink("state transition", { from: previous, to: next.link });
    previous = next.link;
    publish(next);
    schedule(intervalMs);
  };

  const publish = (snapshot: PlantLinkSnapshot) => {
    try {
      onSnapshot(snapshot);
    } catch (error) {
      logPlantLink("probe failure", { category: "snapshot" });
      console.info("plant link snapshot failed", error instanceof Error ? error.name : "error");
    }
  };

  void begin("start");
  return {
    stop: () => {
      stopped = true;
      generation += 1;
      active?.abort();
      active = null;
      running = false;
      clearTimer();
    },
    connectNow: () => {
      logPlantLink("manual connect requested", { previous });
      void begin("manual");
    },
    noteForeground: () => {
      void begin("foreground");
    },
    noteNetwork: () => {
      if (now() - lastNetwork < 1_000) return;
      lastNetwork = now();
      logPlantLink("network hint", { previous });
      void begin("manual");
    },
  };
}

function shouldAnnounceChecking(reason: ProbeReason, previous: PlantLink): boolean {
  if (previous === "ready") return false;
  if (reason === "manual" || reason === "foreground") return true;
  return previous === "unreachable";
}

async function boundedProbe(
  parent: AbortSignal,
  deadlineMs: number,
  probe: (signal: AbortSignal) => Promise<ProbeResult>,
): Promise<ProbeResult> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (parent.aborted) abort();
  else parent.addEventListener("abort", abort, { once: true });
  let expired = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const deadline = new Promise<ProbeResult>((resolve) => {
    timer = setTimeout(() => {
      expired = true;
      abort();
      logPlantLink("probe failure", { category: "deadline" });
      resolve({ link: "unreachable" });
    }, deadlineMs);
  });
  const work = probe(controller.signal).catch(() => ({ link: "unreachable" as const }));
  try {
    const outcome = await Promise.race([work, deadline]);
    return expired ? { link: "unreachable" } : outcome;
  } finally {
    if (timer !== null) clearTimeout(timer);
    parent.removeEventListener("abort", abort);
    abort();
  }
}

function logPlantLink(event: string, fields: Record<string, string>): void {
  console.info("plant link", event, fields);
}
