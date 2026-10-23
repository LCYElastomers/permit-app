import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/lib/api/errors";
import { apiRequest } from "../src/lib/api/client";
import {
  completePinEnrollment,
  pinMessage,
  showCreatePinForm,
  type PlantUser,
} from "../src/services/plantDirectory";

const token = "session-token";
const bobby: PlantUser = {
  id: "b0000001-0000-4000-8000-000000000001",
  permitUserCode: "PCU-0001",
  displayName: "Bobby Fitzgerald",
  windowsUsername: "bobby.fitzgerald",
  windowsDomain: null,
  personnelReference: "3100",
  personnelCode: "IT",
  jobTitle: "IT Manager",
  department: null,
  enabled: true,
  pinState: "ACTIVE",
  pinChangedAt: "2026-10-23T12:00:00Z",
  failedAttempts: 0,
  lockedUntil: null,
  roles: ["SUPER_ADMIN"],
  qualifications: [],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PIN enrollment response", () => {
  it("accepts the 204 enrollment contract and refreshes the same bearer session", async () => {
    const calls: { url: string; authorization: string | null; body: string | null }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({
          url,
          authorization: header(init?.headers, "Authorization"),
          body: typeof init?.body === "string" ? init.body : null,
        });
        if (url.endsWith("/api/v1/identity/pin")) return new Response(null, { status: 204 });
        return json(bobby);
      }),
    );

    const finish = await completePinEnrollment(token, "135790", "135790");

    expect(finish).toEqual({ kind: "active", user: bobby });
    expect(showCreatePinForm(bobby.pinState, false)).toBe(false);
    expect(calls[0]?.url).toContain("/api/v1/identity/pin");
    expect(calls[0]?.authorization).toBe(`Bearer ${token}`);
    expect(calls[1]?.url).toContain("/api/v1/identity/session");
    expect(calls[1]?.authorization).toBe(`Bearer ${token}`);
    expect(JSON.stringify(finish)).not.toContain("135790");
    expect(JSON.stringify(finish)).not.toContain("PinHash");
  });

  it("accepts a JSON success body and still reloads the current user", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.endsWith("/api/v1/identity/pin")) return json({ pinState: "ACTIVE" });
        return json(bobby);
      }),
    );

    const finish = await completePinEnrollment(token, "135790", "135790");
    expect(finish.kind).toBe("active");
    if (finish.kind === "active") expect(finish.user.pinState).toBe("ACTIVE");
  });

  it("refreshes an already enrolled credential instead of replacing it", async () => {
    const bodies: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (typeof init?.body === "string") bodies.push(init.body);
        if (url.endsWith("/api/v1/identity/pin")) return json({ error: "pin-already-enrolled" }, 400);
        return json(bobby);
      }),
    );

    const finish = await completePinEnrollment(token, "246801", "246801");
    expect(finish).toEqual({ kind: "active", user: bobby });
    expect(bodies).toHaveLength(1);
    expect(showCreatePinForm("ACTIVE", false)).toBe(false);
  });

  it("keeps a saved enrollment when the session refresh fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.endsWith("/api/v1/identity/pin")) return new Response(null, { status: 204 });
        return json({ error: "session-required" }, 401);
      }),
    );

    const finish = await completePinEnrollment(token, "135790", "135790");
    expect(finish).toEqual({ kind: "saved" });
    expect(showCreatePinForm("NOT_ENROLLED", true)).toBe(false);
    expect(JSON.stringify(finish)).not.toContain("135790");
  });

  it("reports a genuine enrollment failure without a refresh", async () => {
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        urls.push(url);
        return json({ error: "pin-too-weak" }, 400);
      }),
    );

    const finish = await completePinEnrollment(token, "123456", "123456");
    expect(finish).toEqual({ kind: "failed", message: "That PIN is not allowed." });
    expect(urls).toHaveLength(1);
    expect(showCreatePinForm("NOT_ENROLLED", false)).toBe(true);
  });

  it("uses the generic failure only for an unrecognized server error", () => {
    expect(pinMessage(new ApiError(500, "request-failed"))).toBe("Permit Control could not complete that action.");
  });
});

describe("PIN enrollment prompt", () => {
  it("stays closed for an active credential on the next launch", () => {
    expect(showCreatePinForm("ACTIVE", false)).toBe(false);
    expect(showCreatePinForm("NOT_ENROLLED", false)).toBe(true);
    expect(showCreatePinForm("ENROLLMENT_REQUIRED", false)).toBe(true);
    expect(showCreatePinForm("CHANGE_REQUIRED", false)).toBe(false);
  });
});

describe("empty success responses", () => {
  it("does not parse a 204 body", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 204 })));
    await expect(apiRequest<unknown>("/api/v1/identity/pin", { method: "POST" })).resolves.toBeUndefined();
  });

  it("still rejects a success response that is not JSON", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("not-json", { status: 200 })));
    await expect(apiRequest<unknown>("/api/v1/health")).rejects.toMatchObject({ kind: "malformed" });
  });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function header(headers: HeadersInit | undefined, name: string): string | null {
  if (!headers) return null;
  if (headers instanceof Headers) return headers.get(name);
  if (Array.isArray(headers)) return headers.find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1] ?? null;
  const value = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1];
  return value ?? null;
}
