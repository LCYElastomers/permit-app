const NON_TEXT_INPUTS = new Set(["button", "submit", "reset", "checkbox", "radio", "file", "range", "color", "hidden", "image"]);

export function isTextEntry(node: EventTarget | null): node is HTMLInputElement | HTMLTextAreaElement {
  if (typeof HTMLTextAreaElement !== "undefined" && node instanceof HTMLTextAreaElement) return !node.disabled && !node.readOnly;
  if (typeof HTMLInputElement === "undefined" || !(node instanceof HTMLInputElement)) return false;
  if (node.disabled || node.readOnly) return false;
  return !NON_TEXT_INPUTS.has(node.type);
}

export function textEntryForTouch(target: EventTarget | null): HTMLInputElement | HTMLTextAreaElement | null {
  if (isTextEntry(target)) return target;
  if (typeof Element === "undefined" || !(target instanceof Element)) return null;
  const label = target.closest("label");
  const field = label?.querySelector("input, textarea") ?? null;
  return isTextEntry(field) ? field : null;
}

export function touchFocusAction(input: { pointerType: string; targetIsText: boolean; alreadyFocused: boolean }): "blur-for-retouch" | "allow" {
  if (input.pointerType !== "touch" && input.pointerType !== "pen") return "allow";
  if (!input.targetIsText || !input.alreadyFocused) return "allow";
  return "blur-for-retouch";
}

export function shouldRestoreModalFocus(input: { coarse: boolean; targetIsText: boolean }): boolean {
  return !(input.coarse && input.targetIsText);
}

export function fieldNeedsReveal(input: { top: number; bottom: number; visibleTop: number; visibleBottom: number }): boolean {
  return input.top < input.visibleTop || input.bottom > input.visibleBottom;
}

export function installTouchInput(): () => void {
  const onPointerDown = (event: PointerEvent) => {
    const field = textEntryForTouch(event.target);
    const action = touchFocusAction({
      pointerType: event.pointerType,
      targetIsText: field !== null,
      alreadyFocused: field !== null && document.activeElement === field,
    });
    if (action === "blur-for-retouch") field?.blur();
  };
  document.addEventListener("pointerdown", onPointerDown, true);
  return () => document.removeEventListener("pointerdown", onPointerDown, true);
}
