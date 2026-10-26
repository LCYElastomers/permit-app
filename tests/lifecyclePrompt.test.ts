import { describe, expect, it } from "vitest";
import { lifecyclePrompt, plantStatusCopy, safeDiagnostic } from "../src/services/lifecyclePrompt";

const base = {
  jobDescription: "Inspect pump",
  workOrder: "WO-10",
  hazards: ["mechanical"],
  controls: ["barricade"],
  ppe: ["gloves"],
  modules: ["CORE"],
  missing: [],
  approvals: [] as { actingRole: string }[],
  canAuthorize: true,
  canAccept: false,
  actorId: "authorizer",
  createdBy: "requester",
  allowSelfAuthorization: false,
};

describe("pending review lifecycle", () => {
  it("offers authorize to a permit authorizer and withholds work authorized", () => {
    const prompt = lifecyclePrompt({ ...base, status: "PENDING_REVIEW" });
    expect(prompt.action).toBe("authorize");
    expect(prompt.actingRole).toBe("PERMIT_AUTHORIZER");
    expect(prompt.workAuthorized).toBe(false);
    expect(prompt.detail).toBe("NOT AUTHORIZED FOR WORK");
    expect(prompt.readiness.find((item) => item.label === "Permit authorizer")?.state).toBe("PENDING");
  });

  it("explains the missing authority instead of hiding the action", () => {
    const prompt = lifecyclePrompt({ ...base, status: "PENDING_REVIEW", canAuthorize: false });
    expect(prompt.action).toBeNull();
    expect(prompt.blocked).toContain("PERMIT AUTHORIZER");
  });

  it("blocks self authorization when the policy is off", () => {
    const prompt = lifecyclePrompt({ ...base, status: "PENDING_REVIEW", actorId: "requester", createdBy: "requester" });
    expect(prompt.action).toBeNull();
    expect(prompt.blocked).toContain("cannot authorize");
  });

  it("keeps an authorized permit out of work authorized until activation", () => {
    const accepted = lifecyclePrompt({
      ...base,
      status: "AUTHORIZED",
      canAccept: true,
      approvals: [{ actingRole: "PERMIT_AUTHORIZER" }, { actingRole: "CRAFT_RECEIVER" }],
    });
    expect(accepted.action).toBe("activate");
    expect(plantStatusCopy("AUTHORIZED").workAuthorized).toBe(false);
    expect(plantStatusCopy("ACTIVE")).toEqual({ title: "ACTIVE", detail: "WORK AUTHORIZED", workAuthorized: true });
  });

  it("asks a craft receiver to accept before activation", () => {
    const prompt = lifecyclePrompt({
      ...base,
      status: "AUTHORIZED",
      canAccept: true,
      approvals: [{ actingRole: "PERMIT_AUTHORIZER" }],
    });
    expect(prompt.action).toBe("accept");
    expect(prompt.actingRole).toBe("CRAFT_RECEIVER");
  });

  it("blocks activation while a required qualification is missing", () => {
    const prompt = lifecyclePrompt({
      ...base,
      status: "AUTHORIZED",
      canAccept: true,
      missing: ["FIRE_WATCH"],
      approvals: [{ actingRole: "PERMIT_AUTHORIZER" }, { actingRole: "CRAFT_RECEIVER" }],
    });
    expect(prompt.action).toBeNull();
    expect(prompt.blocked).toContain("FIRE_WATCH");
  });
});

describe("diagnostics", () => {
  it("drops secret values from the status screen", () => {
    const rows = safeDiagnostic([
      { label: "API", value: "ONLINE" },
      { label: "Database password", value: "secret" },
      { label: "Note", value: "Bearer token" },
    ]);
    expect(rows).toEqual([{ label: "API", value: "ONLINE" }]);
  });
});
