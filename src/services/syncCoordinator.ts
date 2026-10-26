import { syncMayStart, type PlantLink } from "../lib/connectivity";

export type SyncCycle = (signal: AbortSignal) => Promise<void>;

export type SyncRequest =
  | { started: true }
  | { started: false; reason: "plant-link" | "busy" | "store" };

/**
 * Synchronization runs only after Plant Link is READY.
 * The health monitor and this coordinator stay separate. A lost Plant Link aborts the
 * current cycle. This coordinator does not poll and does not retry on a timer.
 */
export class SyncCoordinator {
  private link: PlantLink = "checking";
  private storeReady = false;
  private running = false;
  private again = false;
  private abort: AbortController | null = null;
  private readonly cycle: SyncCycle;

  constructor(cycle: SyncCycle) {
    this.cycle = cycle;
  }

  onStoreReady(): void {
    this.storeReady = true;
    if (syncMayStart(this.link)) void this.start();
  }

  onPlantLink(next: PlantLink): void {
    const previous = this.link;
    this.link = next;
    if (!syncMayStart(next)) {
      this.again = false;
      this.abort?.abort();
      return;
    }
    if (!syncMayStart(previous)) void this.start();
  }

  onOutboxCreated(): SyncRequest {
    if (!syncMayStart(this.link)) return { started: false, reason: "plant-link" };
    return this.start();
  }

  requestSyncNow(): SyncRequest {
    if (!this.storeReady) return { started: false, reason: "store" };
    if (!syncMayStart(this.link)) return { started: false, reason: "plant-link" };
    if (this.running) return { started: false, reason: "busy" };
    return this.start();
  }

  stop(): void {
    this.again = false;
    this.abort?.abort();
  }

  private start(): SyncRequest {
    if (!this.storeReady) return { started: false, reason: "store" };
    if (!syncMayStart(this.link)) return { started: false, reason: "plant-link" };
    if (this.running) {
      this.again = true;
      return { started: false, reason: "busy" };
    }
    this.running = true;
    void this.run();
    return { started: true };
  }

  private async run(): Promise<void> {
    let passes = 0;
    try {
      do {
        this.again = false;
        if (!syncMayStart(this.link)) break;
        const controller = new AbortController();
        this.abort = controller;
        try {
          await this.cycle(controller.signal);
        } catch {
          this.again = false;
        }
        passes += 1;
      } while (this.again && syncMayStart(this.link) && passes < 2);
    } finally {
      this.running = false;
      this.abort = null;
    }
  }
}
