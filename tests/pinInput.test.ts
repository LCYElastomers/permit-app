import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { pinDigits } from "../src/components/PinInput";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("PIN entry", () => {
  it("keeps six digits and does not store mask characters", () => {
    expect(pinDigits("482931")).toBe("482931");
    expect(pinDigits("48-29 31")).toBe("482931");
    expect(pinDigits("48293199")).toBe("482931");
    expect(pinDigits("••••••")).toBe("");
  });

  it("masks every PIN field and keeps numeric entry", () => {
    const pin = source("../src/components/PinInput.tsx");
    expect(pin).toContain('type="password"');
    expect(pin).toContain('inputMode="numeric"');
    expect(pin).toContain('pattern="[0-9]*"');
    expect(pin).toContain('autoComplete={purpose === "new" ? "new-password" : "off"}');
    expect(pin).not.toContain("localStorage");
    expect(pin).not.toContain("sessionStorage");
    const banner = source("../src/components/SessionBanner.tsx");
    expect(banner).toContain('label="PIN" purpose="new"');
    expect(banner).toContain('label="Confirm PIN" purpose="new"');
    expect(banner).toContain('label="Current PIN" purpose="current"');
    expect(banner).toContain('label="New PIN" purpose="new"');
    const auth = source("../src/components/AuthorizationPanel.tsx");
    expect(auth).toContain('label="PIN" purpose="current"');
    expect(auth).toContain('setPin(""); setMessage("");');
    expect(auth).toContain("setPin(\"\");\n      setConfirming(false);");
    const users = source("../src/screens/UsersScreen.tsx");
    expect(users).toContain("<PinInput");
    expect(users).toContain('setPin(""); onClose();');
    const admin = source("../src/screens/AdministrationScreen.tsx");
    expect(admin.match(/<PinInput/g)?.length).toBe(2);
    expect(admin).not.toContain('autoComplete="off" value={pin}');
  });
});
