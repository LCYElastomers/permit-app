import { describe, expect, it } from "vitest";
import { resolveApiBaseUrl, PRODUCTION_API_URL } from "../src/lib/api/config";
import { ApiError, ApiTransportError } from "../src/lib/api/errors";
import { probeCall } from "../src/lib/api/failures";
import { interpretConnectivity } from "../src/lib/connectivity";
import { parseAreaList } from "../src/services/areas";

const health = { outcome: "ok" as const, body: { status: "ok", service: "permit-control-api", databaseConfigured: true } };
const ready = { outcome: "ok" as const, body: { status: "ready" } };

describe("API base URL", () => {
  it("uses the production host when no override is set", () => {
    expect(resolveApiBaseUrl(undefined)).toBe(PRODUCTION_API_URL);
    expect(resolveApiBaseUrl("  ")).toBe(PRODUCTION_API_URL);
  });

  it("accepts a configured base and drops a trailing slash", () => {
    expect(resolveApiBaseUrl("http://127.0.0.1:5080/")).toBe("http://127.0.0.1:5080");
  });
});

describe("connectivity mapping", () => {
  it("is online only when the process and the database are ready", () => {
    expect(interpretConnectivity(health, ready)).toMatchObject({ state: "online", server: "online", database: "ready" });
  });

  it("is offline when the process cannot be reached", () => {
    for (const healthCall of [
      { outcome: "offline" as const },
      { outcome: "timeout" as const },
      { outcome: "tls" as const },
      { outcome: "malformed" as const },
      { outcome: "http" as const, status: 500 },
      { outcome: "http" as const, status: 503 },
    ]) {
      expect(interpretConnectivity(healthCall, ready).state).toBe("offline");
    }
  });

  it("is server not ready when the process is up and readiness fails", () => {
    expect(interpretConnectivity(health, { outcome: "http", status: 503 }).state).toBe("server-not-ready");
    expect(interpretConnectivity(health, { outcome: "http", status: 500 }).state).toBe("server-not-ready");
    expect(interpretConnectivity(health, { outcome: "timeout" }).database).toBe("not-ready");
    expect(interpretConnectivity(health, { outcome: "ok", body: { status: "not-ready" } }).state).toBe("server-not-ready");
  });
});

describe("API failures", () => {
  it("keeps transport failures free of response text", () => {
    expect(probeCall(new ApiTransportError("timeout"))).toEqual({ outcome: "timeout" });
    expect(probeCall(new ApiTransportError("tls"))).toEqual({ outcome: "tls" });
    expect(probeCall(new ApiTransportError("offline"))).toEqual({ outcome: "offline" });
    expect(probeCall(new TypeError("Failed to fetch"))).toEqual({ outcome: "offline" });
    expect(probeCall(new TypeError("certificate has expired"))).toEqual({ outcome: "tls" });
    expect(probeCall(new ApiError(503))).toEqual({ outcome: "http", status: 503 });
    expect(probeCall(new SyntaxError("Unexpected token"))).toEqual({ outcome: "malformed" });
    expect(new ApiError(500).message).toBe("request failed");
  });
});

describe("area DTOs", () => {
  it("keeps the id and trims the display name", () => {
    const areas = parseAreaList([{ id: "0b6d1a22-1111-4a1b-9c1d-111111111111", name: "  Unit 1  " }]);
    expect(areas).toEqual([{ id: "0b6d1a22-1111-4a1b-9c1d-111111111111", name: "Unit 1" }]);
  });

  it("rejects a payload that is not the area list", () => {
    expect(parseAreaList({ id: "0b6d1a22-1111-4a1b-9c1d-111111111111", name: "Unit 1" })).toBeNull();
    expect(parseAreaList([{ id: "not-a-uuid", name: "Unit 1" }])).toBeNull();
    expect(parseAreaList([{ id: "0b6d1a22-1111-4a1b-9c1d-111111111111", name: "   " }])).toBeNull();
  });

  it("accepts an empty list", () => {
    expect(parseAreaList([])).toEqual([]);
  });
});
