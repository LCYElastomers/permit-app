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
