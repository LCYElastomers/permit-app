import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { resolveComposition, type Composition } from "../lib/composition";

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
    viewport?.addEventListener("resize", applyVisibleHeight);
    viewport?.addEventListener("scroll", applyVisibleHeight);

    const onFocus = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (!target.matches("input, textarea, select")) return;
      window.setTimeout(() => target.scrollIntoView({ block: "center", inline: "nearest" }), 160);
    };
    document.addEventListener("focusin", onFocus);

    return () => {
      window.removeEventListener("resize", update);
      window.screen?.orientation?.removeEventListener("change", update);
      coarse.removeEventListener("change", update);
      viewport?.removeEventListener("resize", applyVisibleHeight);
      viewport?.removeEventListener("scroll", applyVisibleHeight);
      document.removeEventListener("focusin", onFocus);
    };
  }, []);

  return <CompositionContext.Provider value={composition}>{children}</CompositionContext.Provider>;
}
