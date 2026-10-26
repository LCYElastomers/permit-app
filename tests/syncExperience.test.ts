import { describe, expect, it } from "vitest";
import { DELAYED_SYNC_NOTICE, describePermitSave, describeSync, OFFLINE_SYNC_NOTICE, syncNowNotice } from "../src/services/syncStatus";
import { nextPlantRows, plantListsMayRefresh, PLANT_LIST_REFRESH_MS, stationSamplePermits } from "../src/services/plantLists";

describe("sync status", () => {
  it("shows offline local work without a plant error", () => {
    expect(
      describeSync({ link: "unreachable", storage: "available", pending: 1, syncState: "PENDING", progress: null }),
    ).toMatchObject({
      plant: "OFFLINE",
      primary: "LOCAL DATA",
      secondary: "AVAILABLE",
      detail: "1 CHANGE PENDING",
      notice: null,
    });
  });

  it("shows sync progress and a calm synchronized state", () => {
    expect(
      describeSync({ link: "ready", storage: "available", pending: 1, syncState: "SYNCING", progress: { index: 1, total: 1 } }),
    ).toMatchObject({ plant: "CONNECTED", primary: "SYNCING", secondary: "1 OF 1" });
    expect(describeSync({ link: "ready", storage: "available", pending: 0, syncState: "IDLE", progress: null })).toMatchObject({
      plant: "CONNECTED",
      primary: "SYNCHRONIZED",
      secondary: "PENDING",
      detail: "0",
    });
  });

  it("explains a delayed sync without a transport error", () => {
    const view = describeSync({ link: "ready", storage: "available", pending: 1, syncState: "BACKOFF", progress: null });
    expect(view.primary).toBe("SYNC DELAYED");
    expect(view.secondary).toBe("1 CHANGE PENDING");
    expect(view.notice).toBe(DELAYED_SYNC_NOTICE);
    expect(view.notice).not.toContain("http");
    expect(syncNowNotice({ started: false, reason: "plant-link" })).toBe(OFFLINE_SYNC_NOTICE);
    expect(syncNowNotice({ started: false, reason: "busy" })).toBeNull();
    expect(syncNowNotice({ started: true })).toBeNull();
  });

  it("keeps synchronization separate from work authorization", () => {
    expect(
      describePermitSave({ id: "local", permitNumber: null, lifecycleStatus: "DRAFT", outboxStatus: "PENDING" }, "unreachable"),
    ).toBe("LOCAL DRAFT · SAVED LOCALLY · PLANT LINK OFFLINE");
    expect(describePermitSave({ id: "local", permitNumber: "PTW-2026-00042", lifecycleStatus: "DRAFT" }, "ready")).toBe("SYNCHRONIZED");
    expect(describePermitSave({ id: "local", permitNumber: "PTW-2026-00042", lifecycleStatus: "PENDING_REVIEW" }, "ready")).toBe(
      "SYNCHRONIZED · SUBMITTED FOR REVIEW",
    );
  });
});

describe("authoritative lists", () => {
  it("refreshes only while plant link is ready and keeps the last rows", () => {
    expect(plantListsMayRefresh("unreachable")).toBe(false);
    expect(plantListsMayRefresh("api-online")).toBe(false);
    expect(plantListsMayRefresh("ready")).toBe(true);
    expect(PLANT_LIST_REFRESH_MS).toBeGreaterThanOrEqual(60_000);
    expect(nextPlantRows([{ id: "kept" }], { ok: false })).toEqual([{ id: "kept" }]);
    expect(nextPlantRows([{ id: "kept" }], { ok: true, rows: [{ id: "next" }] })).toEqual([{ id: "next" }]);
  });

  it("keeps station samples out of the plant list", () => {
    const rows = [
      { sample: true, status: "pending", id: "sample" },
      { sample: false, status: "pending", id: "plant" },
      { status: "active", id: "legacy-sample" },
    ];
    expect(stationSamplePermits(rows, "pending").map((row) => row.id)).toEqual(["sample"]);
    expect(stationSamplePermits(rows, "active").map((row) => row.id)).toEqual(["legacy-sample"]);
  });
});
