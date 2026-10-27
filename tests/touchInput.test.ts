import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fieldNeedsReveal, isTextEntry, shouldRestoreModalFocus, touchFocusAction } from "../src/services/touchInput";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("touch focus", () => {
  it("blurs an already focused text field on a later touch without blocking the gesture", () => {
    expect(touchFocusAction({ pointerType: "touch", targetIsText: true, alreadyFocused: true })).toBe("blur-for-retouch");
    expect(touchFocusAction({ pointerType: "pen", targetIsText: true, alreadyFocused: true })).toBe("blur-for-retouch");
    expect(touchFocusAction({ pointerType: "mouse", targetIsText: true, alreadyFocused: true })).toBe("allow");
    expect(touchFocusAction({ pointerType: "touch", targetIsText: true, alreadyFocused: false })).toBe("allow");
    expect(touchFocusAction({ pointerType: "touch", targetIsText: false, alreadyFocused: true })).toBe("allow");
    expect(isTextEntry(null)).toBe(false);
  });

  it("does not programmatically restore a text field on a coarse pointer", () => {
    expect(shouldRestoreModalFocus({ coarse: true, targetIsText: true })).toBe(false);
    expect(shouldRestoreModalFocus({ coarse: true, targetIsText: false })).toBe(true);
    expect(shouldRestoreModalFocus({ coarse: false, targetIsText: true })).toBe(true);
  });

  it("reveals a field only when the keyboard or footer would cover it", () => {
    expect(fieldNeedsReveal({ top: 20, bottom: 60, visibleTop: 8, visibleBottom: 400 })).toBe(false);
    expect(fieldNeedsReveal({ top: 0, bottom: 40, visibleTop: 8, visibleBottom: 400 })).toBe(true);
    expect(fieldNeedsReveal({ top: 360, bottom: 420, visibleTop: 8, visibleBottom: 400 })).toBe(true);
  });

  it("keeps the touch handler from cancelling pointer focus", () => {
    const touch = source("../src/services/touchInput.ts");
    expect(touch).toContain('document.addEventListener("pointerdown"');
    expect(touch).not.toContain("preventDefault");
    const workflow = source("../src/screens/NewPermit.tsx");
    expect(workflow).not.toContain("onPointerDown");
    expect(workflow).not.toContain("onTouchStart");
    expect(workflow).not.toContain("onMouseDown");
    expect(workflow).toContain('type="text"');
    expect(workflow).toContain("<textarea");
    expect(workflow).not.toContain(".focus(");
    const pin = source("../src/components/PinInput.tsx");
    expect(pin).toContain('type="password"');
    expect(pin).toContain('inputMode="numeric"');
    const auth = source("../src/components/AuthorizationPanel.tsx");
    expect(auth).toContain("<PinInput");
    expect(auth).not.toContain('type="text" inputMode="numeric"');
    const css = source("../src/index.css");
    expect(css).toContain("input, textarea, select { touch-action: manipulation; }");
    expect(css).toContain("scroll-margin-bottom: 160px;");
    const shell = source("../src/components/Shell.tsx");
    expect(shell).toContain("CONNECT TO PLANT");
    expect(shell).toContain("CHECK PLANT LINK");
    expect(shell).toContain("SYNC NOW");
    const modal = source("../src/components/admin.tsx");
    expect(modal).toContain("shouldRestoreModalFocus");
    const picker = source("../src/components/ui.tsx");
    expect(picker).toContain("if (searchable && !coarse) searchRef.current?.focus();");
  });
});
