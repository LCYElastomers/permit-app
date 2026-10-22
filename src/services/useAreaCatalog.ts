import { useDevice } from "./device";
import type { AreaCatalog } from "./areas";

export function useAreaCatalog(): AreaCatalog {
  return useDevice().areas;
}
