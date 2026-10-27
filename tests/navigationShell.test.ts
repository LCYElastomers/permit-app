import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { screenLabel } from "../src/workflow";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("navigation shell", () => {
  it("keeps one operations list and leaves permit status routes in place", () => {
    const shell = source("../src/components/Shell.tsx");
    expect(shell).toContain('label: "Permits"');
    expect(shell).toContain('label: "Command Center"');
    expect(shell).toContain('label: "Drafts"');
    expect(shell).toContain('label: "Archive"');
    expect(shell).not.toContain('label: "Active Permits"');
    expect(shell).not.toContain('label: "Pending Review"');
    expect(shell).not.toContain('label: "Users"');
    expect(shell).toContain('screen === "pending"');
    expect(shell).toContain('screen === "suspended"');
    expect(shell).toContain('label: "DRAFTS"');
    expect(shell).toContain("IdentityMenu");
    expect(screenLabel("pending")).toBe("Permits");
    expect(screenLabel("active")).toBe("Permits");
  });

  it("selects a permit type before the workflow and does not keep type tabs on every step", () => {
    const workflow = source("../src/screens/NewPermit.tsx");
    expect(workflow).toContain("Select Permit Type");
    expect(workflow).toContain("Change permit type");
    expect(workflow).not.toContain('aria-label="Permit type"');
    expect(workflow).toContain("PERMIT READINESS");
    const detail = source("../src/screens/PermitDetail.tsx");
    expect(detail).toContain("NEXT ACTION");
  });
});
