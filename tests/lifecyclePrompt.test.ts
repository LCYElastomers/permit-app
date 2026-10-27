import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { blockingItemCopy, detailStatusCopy, lifecyclePrompt, permitDetailSource, plantStatusCopy, presentLifecycleGate, preparationSection, requiredModules, safeDiagnostic, stationDetailPrompt } from "../src/services/lifecyclePrompt";

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
    expect(prompt.nextTitle).toBe("PERMIT AUTHORIZER REQUIRED");
    expect(prompt.nextDetail).toContain("does not have authority to authorize");
  });

  it("blocks self authorization when the policy is off", () => {
    const prompt = lifecyclePrompt({ ...base, status: "PENDING_REVIEW", actorId: "requester", createdBy: "requester" });
    expect(prompt.action).toBeNull();
    expect(prompt.nextTitle).toBe("SELF AUTHORIZATION NOT PERMITTED");
    expect(prompt.nextDetail).toContain("another Permit Authorizer");
  });

  it("authorizes a complete hot work plant permit for a super admin", () => {
    const prompt = lifecyclePrompt({
      ...base,
      status: "PENDING_REVIEW",
      jobDescription: "Testing the application to ensure continuity in the process.",
      workOrder: "TEst",
      hazards: ["heat"],
      controls: ["fire watch"],
      ppe: ["gloves"],
      modules: requiredModules("HOT_WORK"),
      missing: [],
      canAuthorize: true,
      actorId: "b0000001-0000-4000-8000-000000000001",
      createdBy: "other-user",
      allowSelfAuthorization: false,
      permitType: "HOT_WORK",
    });
    expect(prompt.nextTitle).toBe("AUTHORIZE PERMIT");
    expect(prompt.actionLabel).toBe("AUTHORIZE PERMIT");
    expect(prompt.action).toBe("authorize");
    expect(prompt.actingRole).toBe("PERMIT_AUTHORIZER");
    expect(prompt.nextDetail).toContain("ready for authorization");
    const gated = presentLifecycleGate(prompt, { plantReady: true, pinActive: true });
    expect(gated.actionLabel).toBe("AUTHORIZE PERMIT");
    expect(presentLifecycleGate(prompt, { plantReady: false, pinActive: true }).nextTitle).toBe("PLANT CONNECTION REQUIRED");
    expect(presentLifecycleGate(prompt, { plantReady: true, pinActive: false }).nextTitle).toBe("PIN ENROLLMENT REQUIRED");
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
    expect(prompt.nextTitle).toBe("COMPLETE REQUIRED INFORMATION");
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
    expect(prompt.nextTitle).toBe("COMPLETE REQUIRED INFORMATION");
    expect(prompt.action).not.toBe("authorize");
  });

  it("withholds casual editing from active, suspended, and closed permits", () => {
    expect(lifecyclePrompt({ ...base, status: "ACTIVE", approvals: [{ actingRole: "PERMIT_AUTHORIZER" }] }).correction).toBe("none");
    expect(lifecyclePrompt({ ...base, status: "SUSPENDED" }).correction).toBe("reauthorize");
    expect(lifecyclePrompt({ ...base, status: "CLOSED" }).correction).toBe("none");
    expect(lifecyclePrompt({ ...base, status: "CANCELLED" }).correction).toBe("none");
    expect(lifecyclePrompt({ ...base, status: "EXPIRED" }).correction).toBe("none");
    expect(lifecyclePrompt({ ...base, status: "SUPERSEDED" }).correction).toBe("none");
    expect(lifecyclePrompt({ ...base, status: "ACTIVE" }).detail).toBe("WORK AUTHORIZED");
    expect(lifecyclePrompt({ ...base, status: "ACTIVE" }).withdraw).toBe(false);
    expect(lifecyclePrompt({ ...base, status: "PENDING_REVIEW" }).withdraw).toBe(false);
    expect(lifecyclePrompt({ ...base, status: "AUTHORIZED", canAuthorize: true }).withdraw).toBe(true);
    expect(lifecyclePrompt({ ...base, status: "AUTHORIZED", canAuthorize: false }).withdraw).toBe(false);
    expect(lifecyclePrompt({ ...base, status: "SUSPENDED" }).withdraw).toBe(false);
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
    expect(prompt.nextTitle).toBe("COMPLETE REQUIRED PERSONNEL");
    expect(prompt.personnel).toContain("Fire Watch");
    expect(prompt.actionLabel).toBeNull();
  });

  it("uses one detail source and the same shell for plant, synchronized, local, and sample permits", () => {
    expect(permitDetailSource({ sample: false, authority: "authoritative", serverPermitId: "permit-1" })).toBe("synchronized");
    expect(permitDetailSource({ sample: false, plantRecord: { status: "PENDING_REVIEW" } })).toBe("plant");
    expect(permitDetailSource({ sample: false })).toBe("local");
    expect(permitDetailSource({ sample: true })).toBe("sample");
    expect(detailStatusCopy({ status: "pending", sample: false, authority: "authoritative", lifecycleStatus: "PENDING_REVIEW" })).toEqual({
      title: "PENDING REVIEW",
      detail: "NOT AUTHORIZED FOR WORK",
      active: false,
    });
    expect(detailStatusCopy({ status: "pending", sample: false })).toEqual({
      title: "LOCAL DRAFT",
      detail: "SAVED LOCALLY · PENDING SYNC",
      active: false,
    });
    expect(detailStatusCopy({ status: "active", plantRecord: { status: "ACTIVE" } }).title).toBe("ACTIVE");
    expect(detailStatusCopy({ status: "suspended", plantRecord: { status: "SUSPENDED" } }).detail).toBe("WORK NOT AUTHORIZED");
    const pending = stationDetailPrompt({ source: "synchronized", status: "pending", plantReady: true, editable: true });
    expect(pending.edit).toBe(true);
    expect(pending.nextTitle).not.toBe("REVIEW PERMIT");
    expect(stationDetailPrompt({ source: "sample", status: "active", plantReady: true, editable: false })).toMatchObject({
      nextTitle: "WORK AUTHORIZED",
      suspend: true,
      extend: true,
      close: true,
    });
    expect(stationDetailPrompt({ source: "sample", status: "suspended", plantReady: true, editable: false }).nextTitle).toBe("REVIEW FOR REAUTHORIZATION");
    expect(stationDetailPrompt({ source: "local", status: "pending", plantReady: false, editable: true }).nextTitle).toBe("COMPLETE PERMIT");
    const detail = readFileSync("src/screens/PermitDetail.tsx", "utf8");
    expect(detail).not.toContain("REVIEW PERMIT");
    expect(detail).not.toContain("This device copy is not an authorization");
    expect(detail).toContain("Edit permit");
    expect(detail).toContain("getPlantPermit");
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
