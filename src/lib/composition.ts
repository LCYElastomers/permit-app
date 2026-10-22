export type Composition = "portrait" | "landscape" | "desktop";

export interface CompositionInput {
  width: number;
  height: number;
  orientation: "portrait" | "landscape";
  coarsePointer: boolean;
}

/**
 * Field portrait is the narrow or upright composition.
 * Field landscape stays a touch layout, including a wide coarse-pointer tablet.
 * Desktop is a wide fine-pointer composition.
 */
export function resolveComposition(input: CompositionInput): Composition {
  const upright = input.orientation === "portrait" || input.height > input.width;
  if (upright || input.width <= 840) return "portrait";
  if (input.coarsePointer || input.width < 1440) return "landscape";
  return "desktop";
}
