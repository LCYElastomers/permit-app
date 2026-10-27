import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  administrationReturn,
  applyMemory,
  backPresentation,
  blankMemory,
  defaultSort,
  resolveNavigationOrigin,
  statusMoveNotice,
  stillListed,
  type ListMemory,
  type NavigationOrigin,
} from "../src/services/navigationContext";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

function origin(from: Parameters<typeof resolveNavigationOrigin>[0], memory?: Partial<ListMemory>, scroll = 240): NavigationOrigin {
  const key = from === "expiring" ? "expiring" : from === "active" || from === "pending" || from === "suspended" || from === "drafts" || from === "archive" ? from : "active";
  const stored = { ...blankMemory(defaultSort(key)), ...memory, scroll };
  const memories = key === "active" || key === "pending" || key === "suspended" || key === "expiring" || key === "drafts" || key === "archive"
    ? { [key]: stored }
    : {};
  return resolveNavigationOrigin(from, memories, scroll);
}

describe("contextual back navigation", () => {
  it("returns pending, active, suspended, and expiring permits to the list that opened them", () => {
    expect(backPresentation(origin("pending"), false)).toMatchObject({ label: "BACK TO PENDING PERMITS", route: "pending", permitStatus: "pending" });
    expect(backPresentation(origin("active"), false)).toMatchObject({ label: "BACK TO ACTIVE PERMITS", route: "active", permitStatus: "active" });
    expect(backPresentation(origin("suspended"), false)).toMatchObject({ label: "BACK TO SUSPENDED PERMITS", route: "suspended", permitStatus: "suspended" });
    expect(backPresentation(origin("expiring"), false)).toMatchObject({ label: "BACK TO EXPIRING PERMITS", route: "active", permitStatus: "expiring" });
    expect(backPresentation(origin("pending"), true).label).toBe("PENDING PERMITS");
  });

  it("keeps search, area, permit type, and sort with the originating list", () => {
    const pending = origin("pending", { query: "gauge", area: "Unit 2", kind: "hot-work", company: "Gulf", sort: "id-desc" });
    expect(pending.memory).toMatchObject({ query: "gauge", area: "Unit 2", kind: "hot-work", company: "Gulf", sort: "id-desc" });
    const changed = { ...pending, memory: applyMemory(pending.memory, { query: "gauge" }) };
    expect(changed.permitStatus).toBe("pending");
    expect(changed.memory.sort).toBe("id-desc");
    expect(backPresentation(changed, false).route).toBe("pending");
  });

  it("keeps the original list after the permit becomes active", () => {
    const pending = origin("pending", { query: "tank", area: "Unit 1" });
    const activated = "ACTIVE";
    expect(stillListed("pending", activated)).toBe(false);
    expect(statusMoveNotice(pending, activated)).toEqual({ message: "Permit moved to Active.", label: "VIEW ACTIVE PERMITS" });
    expect(backPresentation(pending, false).label).toBe("BACK TO PENDING PERMITS");
    expect(pending.memory.query).toBe("tank");
    expect(pending.memory.area).toBe("Unit 1");
  });

  it("returns command center, drafts, and archive to those workspaces", () => {
    expect(backPresentation(origin("command"), false).label).toBe("BACK TO COMMAND CENTER");
    expect(backPresentation(origin("drafts", { query: "local" }), false)).toMatchObject({ label: "BACK TO DRAFTS", route: "drafts" });
    expect(origin("drafts", { query: "local" }).memory.query).toBe("local");
    const archive = origin("archive", { query: "PTW", area: "Tank Farm", kind: "excavation", year: "2026", status: "closed", sort: "issued-desc" });
    expect(backPresentation(archive, false)).toMatchObject({ label: "BACK TO ARCHIVE", route: "archive" });
    expect(archive.memory).toMatchObject({ query: "PTW", area: "Tank Farm", kind: "excavation", year: "2026", status: "closed", sort: "issued-desc" });
  });

  it("uses Permits when detail has no parent context", () => {
    expect(backPresentation(null, false)).toMatchObject({ label: "BACK TO PERMITS", route: "active" });
    expect(backPresentation(null, false).label).not.toContain("PENDING");
  });

  it("gives administration pages a parent return and leaves modals in place", () => {
    expect(administrationReturn({ section: "types", typeCode: "HOT_WORK", formSection: null })).toEqual({ label: "Permit Types", target: "types" });
    expect(administrationReturn({ section: "types", typeCode: null, formSection: null })).toEqual({ label: "Administration", target: "home" });
    expect(administrationReturn({ section: "home", typeCode: null, formSection: null })).toBeNull();
    const admin = source("../src/screens/AdministrationScreen.tsx");
    const detail = source("../src/screens/PermitDetail.tsx");
    const css = source("../src/index.css");
    const store = source("../src/state/PermitStore.tsx");
    expect(admin).toContain("AdminEditorModal");
    expect(admin).toContain("administrationReturn");
    expect(detail).toContain("<ContextualBack");
    expect(detail).not.toContain("history.back");
    expect(store).not.toContain("history.back");
    const returning = store.slice(store.indexOf("const returnToOrigin"), store.indexOf("const listMemory"));
    expect(returning).not.toContain("setPermits");
    expect(css).toContain(".composition-portrait .context-back");
    expect(css).toContain("min-height: 48px;");
    expect(css).toContain(".context-back,\n.context-shift");
    expect(css).toContain("min-height: 32px;");
    expect(css).not.toContain(".context-back { background: var(--red)");
  });
});
