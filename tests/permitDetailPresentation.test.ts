import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { lifecyclePrompt } from "../src/services/lifecyclePrompt";
import { canPerform, type PlantUser } from "../src/services/plantDirectory";
import {
  authorizationHistory,
  currentAuthorization,
  permitWhen,
  qualificationLabel,
  summaryLine,
  type ApprovalFact,
} from "../src/services/permitDetailPresentation";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

const ready = {
  jobDescription: "Tank entry",
  workOrder: "WO-10",
  hazards: ["engulfment"],
  controls: ["ventilation"],
  ppe: ["harness"],
  modules: ["CONFINED_SPACE"],
  missing: [] as string[],
  approvals: [] as { actingRole: string }[],
  canAuthorize: true,
  canAccept: false,
  actorId: "authorizer",
  createdBy: "requester",
  allowSelfAuthorization: false,
};

const authorizer = (revision: number, at: string, name = "Bobby Fitzgerald"): ApprovalFact => ({
  actingRole: "PERMIT_AUTHORIZER",
  displayName: name,
  permitUserCode: "PCU-0001",
  at,
  decision: "AUTHORIZED",
  revision,
  userId: "b0000001-0000-4000-8000-000000000001",
});

describe("permit detail next action", () => {
  it("offers Authorize Permit to an eligible authorizer on pending review", () => {
    const prompt = lifecyclePrompt({ ...ready, status: "PENDING_REVIEW" });
    expect(prompt.action).toBe("authorize");
    expect(prompt.actionLabel).toBe("AUTHORIZE PERMIT");
    expect(prompt.nextTitle).toBe("AUTHORIZE PERMIT");
  });

  it("keeps authorization available when the acting user is a super administrator", () => {
    const user = { roles: ["SUPER_ADMIN"] } as PlantUser;
    expect(canPerform(user, "PERMIT_AUTHORIZER")).toBe(true);
    const prompt = lifecyclePrompt({ ...ready, status: "PENDING_REVIEW", canAuthorize: canPerform(user, "PERMIT_AUTHORIZER") });
    expect(prompt.action).toBe("authorize");
    expect(prompt.actionLabel).toBe("AUTHORIZE PERMIT");
  });

  it("does not offer authorization again for the current authorized revision", () => {
    const prompt = lifecyclePrompt({
      ...ready,
      status: "AUTHORIZED",
      canAccept: true,
      approvals: [{ actingRole: "PERMIT_AUTHORIZER" }, { actingRole: "CRAFT_RECEIVER" }],
      missing: ["ATTENDANT", "AUTHORIZED_ENTRANT", "GAS_TESTER"],
    });
    expect(prompt.action).not.toBe("authorize");
    expect(prompt.actionLabel).toBeNull();
    expect(prompt.nextTitle).toBe("COMPLETE REQUIRED PERSONNEL");
    expect(prompt.nextTitle).not.toBe("AUTHORIZE PERMIT");
  });

  it("names missing qualifications for people instead of enum codes", () => {
    expect(qualificationLabel("ATTENDANT")).toBe("Attendant");
    expect(qualificationLabel("AUTHORIZED_ENTRANT")).toBe("Authorized Entrant");
    expect(qualificationLabel("GAS_TESTER")).toBe("Gas Tester");
    const prompt = lifecyclePrompt({
      ...ready,
      status: "AUTHORIZED",
      canAccept: true,
      approvals: [{ actingRole: "PERMIT_AUTHORIZER" }, { actingRole: "CRAFT_RECEIVER" }],
      missing: ["ATTENDANT", "AUTHORIZED_ENTRANT", "GAS_TESTER"],
    });
    expect(prompt.personnel).toEqual(["Attendant", "Authorized Entrant", "Gas Tester"]);
    expect(prompt.personnel.join(" ")).not.toContain("AUTHORIZED_ENTRANT");
  });
});

describe("permit detail authorization summary", () => {
  const approvals = [
    authorizer(3, "2026-10-26T18:51:00.000Z", "Earlier Authorizer"),
    authorizer(4, "2026-10-27T14:38:34.743Z"),
    {
      actingRole: "CRAFT_RECEIVER",
      displayName: "Bobby Fitzgerald",
      permitUserCode: "PCU-0001",
      at: "2026-10-27T14:40:00.000Z",
      decision: "ACCEPTED",
      revision: 4,
      userId: "b0000001-0000-4000-8000-000000000001",
    },
  ];

  it("shows one current authorizer and one current receiver", () => {
    const current = currentAuthorization(approvals, 4);
    expect(current.filter((item) => item.actingRole === "PERMIT_AUTHORIZER")).toHaveLength(1);
    expect(current.filter((item) => item.actingRole === "CRAFT_RECEIVER")).toHaveLength(1);
    expect(current[0].displayName).toBe("Bobby Fitzgerald");
    expect(current[1].displayName).toBe("Bobby Fitzgerald");
    const line = summaryLine(current[0].actingRole, current[0].displayName, current[0].at);
    expect(line).toContain("Permit Authorizer: Bobby Fitzgerald");
    expect(line).toContain("Authorized:");
    expect(line).not.toContain("PCU-0001");
    expect(line).not.toContain("T14:38");
    expect(permitWhen("2026-10-27T14:38:34.743719+00:00")).toMatch(/Oct 27, 2026/);
    expect(permitWhen("2026-10-27T14:38:34.743719+00:00")).not.toContain("+00:00");
  });

  it("keeps earlier events and stable user identity in history", () => {
    const history = authorizationHistory(approvals);
    expect(history.map((item) => item.revision)).toEqual([4, 4, 3]);
    expect(history.some((item) => item.person === "Earlier Authorizer")).toBe(true);
    expect(history.every((item) => item.permitUserCode === "PCU-0001")).toBe(true);
    expect(history.every((item) => item.userId === "b0000001-0000-4000-8000-000000000001")).toBe(true);
    expect(history[0].action).toBe("Permit accepted");
  });
});

describe("permit detail presentation structure", () => {
  it("keeps history, documents, and the right rail in their places", () => {
    const detail = source("../src/screens/PermitDetail.tsx");
    const panel = source("../src/components/AuthorizationPanel.tsx");
    const css = source("../src/index.css");
    expect(detail).not.toContain('status === "PENDING_REVIEW" || permit.status === "pending"');
    expect(detail).toContain("<AuthorizationPanel");
    expect(detail).toContain("<PermitDocumentActions");
    expect(detail).toContain("<AuthorizationHistory");
    expect(source("../src/services/lifecyclePrompt.ts")).toContain('actionLabel = "AUTHORIZE PERMIT"');
    expect(panel).toContain("{shown.actionLabel}");
    expect(panel).toContain("View authorization history");
    expect(panel).toContain("useState(false)");
    expect(panel).toContain("historyOpen ? (");
    expect(panel).not.toContain('item.at ?? ""');
    expect(panel).toContain('className="auth-summary"');
    const summary = panel.slice(panel.indexOf('className="auth-summary"'), panel.indexOf("form-error"));
    expect(summary).toContain("summaryLine");
    expect(summary).not.toContain("permitUserCode");
    expect(panel).toContain("item.permitUserCode");
    expect(panel).toContain("item.userId");
    expect(css).toContain("max-width: 420px");
    expect(css).toContain("justify-self: end");
    expect(css).toContain(".composition-portrait .detail-head");
    expect(css).toContain("grid-template-columns: 1fr;");
    expect(css).toContain(".composition-landscape .detail-head");
    expect(css).toContain("minmax(280px, 0.8fr)");
  });
});
