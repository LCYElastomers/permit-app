import { afterEach, describe, expect, it, vi } from "vitest";
import { startPlantLinkMonitor, type PlantLinkMonitorOptions } from "../src/services/plantLink";
import { SyncCoordinator } from "../src/services/syncCoordinator";

type Probe = NonNullable<PlantLinkMonitorOptions["probe"]>;

afterEach(() => {
  vi.useRealTimers();
});

function watch(probe: Probe, options: PlantLinkMonitorOptions = {}) {
  const links: string[] = [];
  const signals: AbortSignal[] = [];
  const monitor = startPlantLinkMonitor((snapshot) => links.push(snapshot.link), {
    deadlineMs: 1_000,
    intervalMs: 30_000,
    cooldownMs: 5_000,
    ...options,
    probe: (signal) => {
      signals.push(signal);
      return probe(signal);
    },
  });
  return { links, signals, monitor };
}

function untilAbort(signal: AbortSignal): Promise<"cancelled"> {
  return new Promise((resolve) => {
    if (signal.aborted) resolve("cancelled");
    else signal.addEventListener("abort", () => resolve("cancelled"), { once: true });
  });
}

describe("plant link monitor", () => {
  it("schedules another probe after the link is unreachable", async () => {
    vi.useFakeTimers();
    const seen = watch(async () => ({ link: "unreachable" }));
    await vi.advanceTimersByTimeAsync(0);
    expect(seen.links).toContain("unreachable");
    const first = seen.signals.length;
    await vi.advanceTimersByTimeAsync(30_000);
    expect(seen.signals.length).toBeGreaterThan(first);
    expect(seen.signals[0]).not.toBe(seen.signals[1]);
    seen.monitor.stop();
  });

  it("keeps probing when a probe is cancelled or never settles", async () => {
    vi.useFakeTimers();
    const cancelled = watch(async () => "cancelled");
    await vi.advanceTimersByTimeAsync(0);
    expect(cancelled.links.at(-1)).toBe("unreachable");
    await vi.advanceTimersByTimeAsync(30_000);
    expect(cancelled.signals.length).toBeGreaterThan(1);
    cancelled.monitor.stop();

    const hung = watch(untilAbort);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(hung.links).toContain("unreachable");
    expect(hung.signals[0]?.aborted).toBe(true);
    const started = hung.signals.length;
    await vi.advanceTimersByTimeAsync(30_000);
    expect(hung.signals.length).toBeGreaterThan(started);
    expect(hung.signals.at(-1)?.aborted).toBe(false);
    hung.monitor.stop();
  });

  it("starts a fresh checking probe from connect now", async () => {
    vi.useFakeTimers();
    let release: (value: Awaited<ReturnType<Probe>>) => void = () => undefined;
    const seen = watch(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    await vi.advanceTimersByTimeAsync(0);
    seen.monitor.connectNow();
    await vi.advanceTimersByTimeAsync(0);
    expect(seen.links).toContain("checking");
    expect(seen.signals[0]?.aborted).toBe(true);
    expect(seen.signals.length).toBeGreaterThan(1);
    release({ link: "ready" });
    await vi.advanceTimersByTimeAsync(0);
    expect(seen.links.at(-1)).toBe("ready");
    seen.monitor.stop();
  });

  it("does not announce checking or start a second sync while already ready", async () => {
    vi.useFakeTimers();
    const seen = watch(async () => ({ link: "ready" }));
    await vi.advanceTimersByTimeAsync(0);
    expect(seen.links).toEqual(["ready"]);
    seen.monitor.connectNow();
    await vi.advanceTimersByTimeAsync(0);
    expect(seen.links).toEqual(["ready", "ready"]);
    seen.monitor.stop();
  });

  it("cools down foreground probes and still accepts a network hint", async () => {
    vi.useFakeTimers();
    const seen = watch(async () => ({ link: "unreachable" }));
    await vi.advanceTimersByTimeAsync(0);
    const afterStart = seen.signals.length;
    seen.monitor.noteForeground();
    await vi.advanceTimersByTimeAsync(0);
    expect(seen.signals.length).toBe(afterStart);
    seen.monitor.noteNetwork();
    await vi.advanceTimersByTimeAsync(0);
    expect(seen.signals.length).toBe(afterStart + 1);
    seen.monitor.noteNetwork();
    await vi.advanceTimersByTimeAsync(0);
    expect(seen.signals.length).toBe(afterStart + 1);
    seen.monitor.stop();
  });

  it("wakes synchronization once when the link becomes ready", async () => {
    let runs = 0;
    const coordinator = new SyncCoordinator(async () => {
      runs += 1;
    });
    coordinator.onStoreReady();
    coordinator.onPlantLink("unreachable");
    expect(runs).toBe(0);
    coordinator.onPlantLink("ready");
    expect(runs).toBe(1);
    coordinator.onPlantLink("ready");
    expect(runs).toBe(1);
    coordinator.stop();
  });
});
