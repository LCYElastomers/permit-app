import { describe, expect, it } from "vitest";
import { blockingItemCopy, lifecyclePrompt, plantStatusCopy, preparationSection, requiredModules, safeDiagnostic } from "../src/services/lifecyclePrompt";

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

  it("blocks authorization when required PPE is missing and names PPE", () => {
    const prompt = lifecyclePrompt({ ...base, status: "PENDING_REVIEW", ppe: [] });
    expect(prompt.action).toBeNull();
    expect(prompt.nextTitle).toBe("AUTHORIZATION BLOCKED");
    expect(prompt.blocked).toContain("PPE");
    expect(prompt.gaps).toEqual(["PPE"]);
    expect(prompt.correction).toBe("edit");
    expect(prompt.focus).toBe("ppe");
    expect(prompt.focusStep).toBe(3);
    expect(preparationSection("PPE")).toBe(3);
    expect(blockingItemCopy("PPE")).toContain("PPE selection must be completed");
    expect(prompt.readiness.find((item) => item.label === "PPE")?.state).toBe("INCOMPLETE");
    expect(prompt.workAuthorized).toBe(false);
  });

  it("uses module-aware PPE readiness for every permit type", () => {
    for (const permitType of ["GENERAL_WORK", "HOT_WORK", "CONFINED_SPACE", "OPENING_BLINDING", "EXCAVATION", "LIVE_ELECTRICAL"]) {
      expect(requiredModules(permitType)).toContain("PPE");
      const blocked = lifecyclePrompt({ ...base, status: "PENDING_REVIEW", ppe: [], permitType });
      expect(blocked.action).toBeNull();
      expect(blocked.gaps).toContain("PPE");
      const ready = lifecyclePrompt({ ...base, status: "PENDING_REVIEW", permitType });
      expect(ready.action).toBe("authorize");
    }
    const hotWork = requiredModules("HOT_WORK");
    expect(hotWork).toEqual(expect.arrayContaining(["PPE", "HOT_WORK", "FIRE_WATCH", "ATMOSPHERIC_MONITORING"]));
  });

  it("keeps a pending review permit editable without a new identity", () => {
    const prompt = lifecyclePrompt({ ...base, status: "PENDING_REVIEW" });
    expect(prompt.correction).toBe("edit");
    expect(prompt.action).toBe("authorize");
  });

  it("offers return for correction when an authorized permit is not ready", () => {
    const prompt = lifecyclePrompt({
      ...base,
      status: "AUTHORIZED",
      ppe: [],
      approvals: [{ actingRole: "PERMIT_AUTHORIZER" }],
    });
    expect(prompt.action).toBeNull();
    expect(prompt.correction).toBe("return");
    expect(prompt.blocked).toContain("PPE");
    expect(prompt.focusStep).toBe(3);
    expect(prompt.workAuthorized).toBe(false);
    expect(prompt.title).toBe("AUTHORIZED");
    expect(prompt.nextTitle).toBe("NOT READY FOR ACTIVATION");
  });

  it("withholds casual editing from active, suspended, and closed permits", () => {
    expect(lifecyclePrompt({ ...base, status: "ACTIVE", approvals: [{ actingRole: "PERMIT_AUTHORIZER" }] }).correction).toBe("none");
    expect(lifecyclePrompt({ ...base, status: "SUSPENDED" }).correction).toBe("reauthorize");
    expect(lifecyclePrompt({ ...base, status: "CLOSED" }).correction).toBe("none");
    expect(lifecyclePrompt({ ...base, status: "CANCELLED" }).correction).toBe("none");
    expect(lifecyclePrompt({ ...base, status: "EXPIRED" }).correction).toBe("none");
    expect(lifecyclePrompt({ ...base, status: "SUPERSEDED" }).correction).toBe("none");
    expect(lifecyclePrompt({ ...base, status: "ACTIVE" }).detail).toBe("WORK AUTHORIZED");
    expect(lifecyclePrompt({ ...base, status: "PENDING_REVIEW", ppe: [] }).detail).toBe("NOT AUTHORIZED FOR WORK");
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
