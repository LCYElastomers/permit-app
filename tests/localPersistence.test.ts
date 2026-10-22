import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { syncMayStart, type PlantLink } from "../src/lib/connectivity";
import { parseAreaList, presentAreaCatalog, type AreaRecord } from "../src/services/areas";
import { refreshAreaCatalog } from "../src/services/areaRefresh";
import { AreaCatalogRejected, LocalStoreFailure } from "../src/services/localStore";
import { SyncCoordinator } from "../src/services/syncCoordinator";

const areaId = "0b6d1a22-1111-4a1b-9c1d-111111111111";
const cached: AreaRecord[] = [{ id: areaId, name: "Unit 1" }];

describe("sync eligibility", () => {
  it("starts only when plant link is ready", () => {
    const links: PlantLink[] = ["checking", "unreachable", "api-online", "ready"];
    expect(links.filter((link) => syncMayStart(link))).toEqual(["ready"]);
    expect(syncMayStart.length).toBe(1);
  });

  it("does not consult general internet connectivity", () => {
    const sources = [
      "src/lib/connectivity.ts",
      "src/services/connectivity.ts",
      "src/services/plantLink.ts",
      "src/services/syncCoordinator.ts",
      "src/services/areaRefresh.ts",
      "src/services/device.tsx",
      "src/services/localStore.ts",
    ];
    const root = join(dirname(fileURLToPath(import.meta.url)), "..");
    const text = sources.map((path) => readFileSync(join(root, path), "utf8")).join("\n");
    expect(text).not.toContain("navigator.onLine");
    expect(text).not.toContain("navigator");
    expect(syncMayStart("unreachable")).toBe(false);
    expect(syncMayStart("ready")).toBe(true);
  });
});

describe("area catalog presentation", () => {
  it("shows a cached catalog without a live request", () => {
    expect(presentAreaCatalog("available", cached, null)).toEqual({ status: "ready", areas: cached });
  });

  it("explains a first launch that has never synchronized", () => {
    expect(presentAreaCatalog("available", [], null)).toEqual({ status: "unsynchronized" });
  });

  it("shows an empty server catalog after a successful refresh", () => {
    expect(presentAreaCatalog("available", [], "2026-10-22T16:00:00Z")).toEqual({ status: "ready", areas: [] });
  });

  it("treats a local store failure as its own condition", () => {
    expect(presentAreaCatalog("failed", cached, "2026-10-22T16:00:00Z").status).toBe("storage-failed");
  });
});

describe("area refresh", () => {
  it("does not fetch or replace when plant link is unreachable", async () => {
    let fetched = false;
    let replaced = false;
    const result = await refreshAreaCatalog({
      link: "unreachable",
      signal: new AbortController().signal,
      load: async () => {
        fetched = true;
        return [];
      },
      replace: async () => {
        replaced = true;
      },
    });
    expect(result).toBe("kept");
    expect(fetched).toBe(false);
    expect(replaced).toBe(false);
  });

  it("keeps the previous catalog when the payload is invalid", async () => {
    let replaced = false;
    const result = await refreshAreaCatalog({
      link: "ready",
      signal: new AbortController().signal,
      load: async () => [{ id: "not-a-uuid", name: "Unit 1" }],
      replace: async () => {
        replaced = true;
      },
    });
    expect(result).toBe("kept");
    expect(replaced).toBe(false);
  });

  it("keeps the previous catalog when the request fails", async () => {
    let replaced = false;
    const result = await refreshAreaCatalog({
      link: "ready",
      signal: new AbortController().signal,
      load: async () => {
        throw new Error("timeout");
      },
      replace: async () => {
        replaced = true;
      },
    });
    expect(result).toBe("kept");
    expect(replaced).toBe(false);
  });

  it("replaces only after a complete valid payload and preserves the server uuid", async () => {
    const stored: AreaRecord[][] = [];
    const result = await refreshAreaCatalog({
      link: "ready",
      signal: new AbortController().signal,
      load: async () => [{ id: "0B6D1A22-1111-4A1B-9C1D-111111111111", name: "  Unit 1  " }],
      replace: async (areas) => {
        stored.push(areas);
      },
    });
    expect(result).toBe("updated");
    expect(stored).toEqual([[{ id: "0B6D1A22-1111-4A1B-9C1D-111111111111", name: "Unit 1" }]]);
  });

  it("does not replace when the cycle is aborted", async () => {
    const controller = new AbortController();
    let replaced = false;
    const result = await refreshAreaCatalog({
      link: "ready",
      signal: controller.signal,
      load: async () => {
        controller.abort();
        return [{ id: areaId, name: "Unit 1" }];
      },
      replace: async () => {
        replaced = true;
      },
    });
    expect(result).toBe("kept");
    expect(replaced).toBe(false);
  });

  it("reports storage failure without turning an invalid catalog into an empty write", async () => {
    const rejected = await refreshAreaCatalog({
      link: "ready",
      signal: new AbortController().signal,
      load: async () => [{ id: areaId, name: "Unit 1" }],
      replace: async () => {
        throw new AreaCatalogRejected();
      },
    });
    const failed = await refreshAreaCatalog({
      link: "ready",
      signal: new AbortController().signal,
      load: async () => [{ id: areaId, name: "Unit 1" }],
      replace: async () => {
        throw new LocalStoreFailure();
      },
    });
    expect(rejected).toBe("kept");
    expect(failed).toBe("storage-failed");
  });
});

describe("sync coordinator", () => {
  it("does not run because a non-ready link is up", async () => {
    let calls = 0;
    const coordinator = new SyncCoordinator(async () => {
      calls += 1;
    });
    coordinator.onStoreReady();
    coordinator.onPlantLink("api-online");
    coordinator.onOutboxCreated();
    expect(coordinator.requestSyncNow()).toEqual({ started: false, reason: "plant-link" });
    await Promise.resolve();
    expect(calls).toBe(0);
  });

  it("runs one cycle when plant link becomes ready and does not overlap", async () => {
    let calls = 0;
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const coordinator = new SyncCoordinator(async () => {
      calls += 1;
      await gate;
    });
    coordinator.onStoreReady();
    coordinator.onPlantLink("ready");
    await Promise.resolve();
    expect(calls).toBe(1);
    expect(coordinator.requestSyncNow()).toEqual({ started: false, reason: "busy" });
    expect(calls).toBe(1);
    release();
    await gate;
    await Promise.resolve();
    await Promise.resolve();
    expect(calls).toBe(2);
  });

  it("aborts the current cycle when plant link is lost", async () => {
    let signal: AbortSignal | null = null;
    const coordinator = new SyncCoordinator((next) => {
      signal = next;
      return new Promise((resolve) => {
        next.addEventListener("abort", () => resolve());
      });
    });
    coordinator.onStoreReady();
    coordinator.onPlantLink("ready");
    await Promise.resolve();
    coordinator.onPlantLink("unreachable");
    expect(signal?.aborted).toBe(true);
    expect(coordinator.requestSyncNow()).toEqual({ started: false, reason: "plant-link" });
  });
});

describe("area payload", () => {
  it("preserves the server uuid and rejects duplicates", () => {
    expect(parseAreaList([{ id: "0B6D1A22-1111-4A1B-9C1D-111111111111", name: " Unit 1 " }])).toEqual([
      { id: "0B6D1A22-1111-4A1B-9C1D-111111111111", name: "Unit 1" },
    ]);
    expect(
      parseAreaList([
        { id: areaId, name: "Unit 1" },
        { id: areaId.toUpperCase(), name: "Unit 2" },
      ]),
    ).toBeNull();
  });
});
