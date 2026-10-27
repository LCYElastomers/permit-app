/** Presentation only. The value stays the digits; the password control masks them. */
export function pinDigits(value: string): string {
  return value.replace(/\D/g, "").slice(0, 6);
}

export function PinInput({
  label,
  value,
  onChange,
  purpose = "current",
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  purpose?: "new" | "current";
}) {
  const field = (
    <input
      type="password"
      inputMode="numeric"
      pattern="[0-9]*"
      autoComplete={purpose === "new" ? "new-password" : "off"}
      autoCapitalize="off"
      spellCheck={false}
      maxLength={6}
      value={value}
      onChange={(event) => onChange(pinDigits(event.target.value))}
      data-lpignore="true"
      data-1p-ignore="true"
    />
  );
  if (!label) return field;
  return (
    <label className="confirm-field">
      <span>{label}</span>
      {field}
    </label>
  );
}
