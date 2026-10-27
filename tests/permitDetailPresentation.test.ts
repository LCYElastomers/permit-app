import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { lifecyclePrompt } from "../src/services/lifecyclePrompt";
import { canPerform, type PlantUser } from "../src/services/plantDirectory";
import {
  authorizationHistory,
  currentAuthorization,
  effectiveApprovals,
  permitWhen,
  qualificationLabel,
  summaryLine,
  type ApprovalFact,
  type HistoryFact,
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
    expect(prompt.withdraw).toBe(false);
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
    expect(prompt.withdraw).toBe(true);
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
    expect(line).toContain("Permit Authorized:");
    expect(line).not.toContain("|");
    expect(line).not.toContain("PCU-0001");
    expect(line).not.toContain("T14:38");
    expect(permitWhen("2026-10-27T14:38:34.743719+00:00")).toMatch(/Oct 27, 2026 · /);
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

  it("drops a withdrawn authorization from the current summary and keeps both events in history", () => {
    const withdrawnAt = "2026-10-27T15:12:00.000Z";
    const historyRows = [
      { revision: 4, action: "PERMIT_AUTHORIZED", at: "2026-10-27T14:38:34.743Z" },
      { revision: 4, action: "PERMIT_ACCEPTED", at: "2026-10-27T14:40:00.000Z" },
      { revision: 4, action: "PERMIT_AUTHORIZATION_WITHDRAWN", at: withdrawnAt },
    ];
    const effective = effectiveApprovals(approvals, historyRows);
    expect(currentAuthorization(effective, 4)).toEqual([]);
    const recorded: HistoryFact[] = [
      {
        revision: 4,
        action: "Authorization withdrawn",
        person: "Bobby Fitzgerald",
        at: withdrawnAt,
        permitUserCode: "PCU-0001",
        userId: "b0000001-0000-4000-8000-000000000001",
        reason: "Permit Requires Correction",
        code: "PERMIT_AUTHORIZATION_WITHDRAWN",
      },
      {
        revision: 4,
        action: "Permit authorized",
        person: "Bobby Fitzgerald",
        at: "2026-10-27T14:38:34.743Z",
        permitUserCode: "PCU-0001",
        userId: "b0000001-0000-4000-8000-000000000001",
        code: "PERMIT_AUTHORIZED",
      },
    ];
    const history = authorizationHistory(approvals, recorded);
    expect(history[0].action).toBe("Authorization withdrawn");
    expect(history[0].reason).toBe("Permit Requires Correction");
    expect(history[1].action).toBe("Permit authorized");
    expect(permitWhen(history[0].at)).toMatch(/Oct 27, 2026/);
    expect(permitWhen(history[0].at)).not.toContain("T15:12");
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
    expect(panel).toContain("WITHDRAW AUTHORIZATION");
    expect(panel).toContain("Plant Link must be READY before authorization can be withdrawn.");
    expect(panel).toContain("withdrawPlantAuthorization");
    expect(panel).toContain("Permit Requires Correction");
    expect(panel).toContain("View authorization history");
    expect(panel).toContain("Reason: {item.reason}");
    expect(detail).toContain("Suspend Permit");
    const readiness = panel.indexOf('className="detail-readiness"');
    const visible = panel.slice(readiness, panel.indexOf("{confirming && shown.action", readiness));
    expect(visible).not.toContain("PERMIT_AUTHORIZED");
    expect(visible).not.toContain("PERMIT_AUTHORIZATION_WITHDRAWN");
    expect(visible).not.toContain("ATTENDANT,AUTHORIZED_ENTRANT");
    expect(panel).toContain("useState(false)");
    expect(panel).toContain("historyOpen ? (");
    expect(panel).not.toContain('item.at ?? ""');
    expect(panel).toContain('className="auth-summary"');
    const summary = panel.slice(panel.indexOf('className="auth-summary"'), panel.indexOf("form-error"));
    expect(summary).toContain("authorizationFacts");
    expect(summary).not.toContain("permitUserCode");
    expect(panel).toContain("item.permitUserCode");
    expect(panel).toContain("item.userId");
    expect(css).toContain(".composition-desktop .detail-head");
    expect(css).toContain("minmax(0, 0.82fr) minmax(0, 1.18fr)");
    expect(css).toContain(".composition-desktop .detail-actions");
    expect(css).toContain("max-width: none");
    expect(css).toContain(".composition-portrait .detail-head");
    expect(css).toContain("grid-template-columns: 1fr;");
    expect(css).toContain(".composition-landscape .detail-head");
    expect(css).toContain("minmax(280px, 1.08fr)");
    expect(css).toContain("--space-2: 8px");
    expect(css).toContain("--space-6: 32px");
    expect(css).toContain(".composition-desktop .detail-readiness { gap: var(--space-6); }");
    expect(css).toContain(".composition-desktop .auth-summary");
    expect(css).toContain(".composition-desktop .next-action p");
    expect(css).toContain(".composition-portrait .next-action { align-items: flex-start; text-align: left; }");
    expect(panel).toContain("Permit actions");
    expect(panel).toContain("Required before activation");
    expect(panel).toContain("personnelReadiness");
  });
});
