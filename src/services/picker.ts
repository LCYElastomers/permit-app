export interface PickerOption {
  id: string;
  label: string;
}

/** Search narrows by the visible label. The stored value stays the option id. */
export function visiblePickerOptions<T extends PickerOption>(options: T[], query: string): T[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return options;
  return options.filter((option) => option.label.toLowerCase().includes(needle));
}

export function pickerIsMounted(open: boolean): boolean {
  return open;
}

/** A short fixed catalog can stay readable without a search field. Larger catalogs keep search. */
export const PICKER_SEARCH_MINIMUM = 12;

export function pickerShowsSearch(searchable: boolean, optionCount: number, minimum = PICKER_SEARCH_MINIMUM): boolean {
  return searchable && optionCount >= minimum;
}

/** The dialog tracks the visible viewport so a touch keyboard can shrink it without covering Close. */
export function pickerViewportFrame(
  viewport: { height: number; offsetTop: number } | null,
  windowHeight: number,
): { top: number; height: number } {
  const visible = viewport && viewport.height > 0 ? viewport.height : windowHeight;
  const top = viewport && viewport.height > 0 ? viewport.offsetTop : 0;
  return { top: Math.max(0, top), height: Math.max(0, visible) };
}
