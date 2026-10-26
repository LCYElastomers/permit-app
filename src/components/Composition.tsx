import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { resolveComposition, type Composition } from "../lib/composition";
import { fieldNeedsReveal, installTouchInput, isTextEntry } from "../services/touchInput";

const CompositionContext = createContext<Composition>("desktop");

export function useComposition(): Composition {
  return useContext(CompositionContext);
}

function readOrientation(): "portrait" | "landscape" {
  const type = window.screen?.orientation?.type ?? "";
  if (type.startsWith("portrait")) return "portrait";
  if (type.startsWith("landscape")) return "landscape";
  return window.innerHeight > window.innerWidth ? "portrait" : "landscape";
}

export function readCurrentComposition(): Composition {
  return resolveComposition({
    width: window.innerWidth,
    height: window.innerHeight,
    orientation: readOrientation(),
    coarsePointer: window.matchMedia("(pointer: coarse)").matches,
  });
}

function applyVisibleHeight(): void {
  const viewport = window.visualViewport;
  const height = viewport?.height ?? window.innerHeight;
  document.documentElement.style.setProperty("--vvh", `${Math.round(height)}px`);
}

export function CompositionProvider({ children }: { children: ReactNode }) {
  const [composition, setComposition] = useState<Composition>(readCurrentComposition);

  useEffect(() => {
    const update = () => setComposition(readCurrentComposition());
    update();
    applyVisibleHeight();
    window.addEventListener("resize", update);
    window.screen?.orientation?.addEventListener("change", update);
    const coarse = window.matchMedia("(pointer: coarse)");
    coarse.addEventListener("change", update);
    const viewport = window.visualViewport;

    const reveal = (target: HTMLElement) => {
      if (!isTextEntry(target)) return;
      const viewport = window.visualViewport;
      const rect = target.getBoundingClientRect();
      const top = viewport?.offsetTop ?? 0;
      const height = viewport?.height ?? window.innerHeight;
      if (!fieldNeedsReveal({ top: rect.top, bottom: rect.bottom, visibleTop: top + 8, visibleBottom: top + height - 120 })) return;
      target.scrollIntoView({ block: "nearest", inline: "nearest" });
    };
    const onFocus = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      window.setTimeout(() => {
        if (target.isConnected) reveal(target);
      }, 160);
    };
    const onViewport = () => {
      applyVisibleHeight();
      const active = document.activeElement;
      if (active instanceof HTMLElement) reveal(active);
    };
    document.addEventListener("focusin", onFocus);
    viewport?.addEventListener("resize", onViewport);
    viewport?.addEventListener("scroll", applyVisibleHeight);
    const removeTouch = installTouchInput();

    return () => {
      window.removeEventListener("resize", update);
      window.screen?.orientation?.removeEventListener("change", update);
      coarse.removeEventListener("change", update);
      viewport?.removeEventListener("resize", onViewport);
      viewport?.removeEventListener("scroll", applyVisibleHeight);
      document.removeEventListener("focusin", onFocus);
      removeTouch();
    };
  }, []);

  return <CompositionContext.Provider value={composition}>{children}</CompositionContext.Provider>;
}
