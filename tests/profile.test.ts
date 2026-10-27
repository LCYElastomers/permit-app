import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizeEmail, normalizePhone, preferencePayload } from "../src/services/profileContact";
import { screenLabel } from "../src/workflow";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("self-service profile", () => {
  it("opens the signed-in profile from the identity menu", () => {
    const menu = source("../src/components/SessionBanner.tsx");
    expect(menu).toContain('go("profile")');
    expect(source("../src/components/Shell.tsx")).toContain('screen === "profile" && <ProfileScreen />');
    expect(screenLabel("profile")).toBe("My Profile");
    const screen = source("../src/screens/ProfileScreen.tsx");
    expect(screen).toContain("user.permitUserCode");
    expect(screen).toContain("user.displayName");
    expect(screen).toContain("Work email");
    expect(screen).toContain("Mobile phone");
    expect(screen).toContain("Alternate phone");
    expect(screen).toContain("NOT VERIFIED");
    expect(screen).toContain("SMS contact not verified");
    expect(screen).toContain("Save changes");
    expect(screen).toContain("Profile updated.");
    expect(screen).toContain("identity.refresh()");
    expect(screen).toContain('link.link === "ready"');
    expect(screen).toContain("Plant Link is offline. Profile changes require a plant connection.");
    expect(screen).toContain("changePin(");
    expect(screen).toContain("<PinInput");
    expect(screen).toContain("Windows account");
    expect(screen).not.toContain("setPlantRoles");
    expect(screen).not.toContain("addPlantQualification");
    expect(screen).not.toContain("SUPER_ADMIN");
    expect(screen).not.toContain("outbox");
    expect(screen).not.toContain("{user.id}");
  });

  it("keeps contact off permit records and inside the admin user editor", () => {
    const directory = source("../src/services/plantDirectory.ts");
    const permit = directory.slice(directory.indexOf("export interface PlantPermit"), directory.indexOf("const TOKEN"));
    expect(permit).not.toContain("email");
    expect(permit).not.toContain("mobilePhone");
    expect(directory).toContain('"/api/v1/identity/profile"');
    expect(directory).toContain("updateContact: true");
    const users = source("../src/screens/UsersScreen.tsx");
    expect(users).toContain("Work email");
    expect(users).toContain("Mobile phone");
    expect(users).toContain("NOT VERIFIED");
    expect(users).toContain('canPerform(identity.user, "ADMIN")');
    const service = source("../server/PermitControl.Infrastructure/Directory/DirectoryService.cs");
    expect(service).toContain("CredentialAuditType.USER_PROFILE_UPDATED");
    expect(service).toContain("ReasonCode = summary");
    expect(service).toContain("UpdateOwnProfileAsync");
    const own = service.slice(service.indexOf("UpdateOwnProfileAsync"), service.indexOf("SetRolesAsync"));
    expect(own).not.toContain("ADMIN");
    const admin = service.slice(service.indexOf("UpdateUserAsync"), service.indexOf("UpdateOwnProfileAsync"));
    expect(admin).toContain("nameof(AppRole.ADMIN)");
  });

  it("normalizes email and stores US numbers as E.164", () => {
    expect(normalizeEmail("  Bobby.Fitzgerald@LCY.Example ").email).toBe("Bobby.Fitzgerald@lcy.example");
    expect(normalizeEmail("not-an-email").error).toBe("Enter a valid work email.");
    expect(normalizePhone("281-555-0142").e164).toBe("+12815550142");
    expect(normalizePhone("(281) 555-0142").e164).toBe("+12815550142");
    expect(normalizePhone("2815550142").e164).toBe("+12815550142");
    expect(normalizePhone("+1 281 555 0142").e164).toBe("+12815550142");
    expect(normalizePhone("+44 20 7946 0958").e164).toBe("+442079460958");
    expect(normalizePhone("555").error).toBe("Enter a valid phone number.");
    const saved = preferencePayload([{ channel: "SMS", topic: "PERMIT_SUSPENDED", enabled: true }], null, "");
    expect(saved.find((item) => item.channel === "SMS")?.enabled).toBe(false);
    expect(saved.find((item) => item.channel === "IN_APP")?.enabled).toBe(false);
  });
});
