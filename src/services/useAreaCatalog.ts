import { useEffect, useState } from "react";
import { loadAreaCatalog } from "./loadAreas";
import type { AreaCatalog } from "./areas";

export function useAreaCatalog(): AreaCatalog {
  const [catalog, setCatalog] = useState<AreaCatalog>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    void loadAreaCatalog().then((result) => {
      if (!cancelled) setCatalog(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return catalog;
}
