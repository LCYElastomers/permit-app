export type FieldWidth = "small" | "medium" | "standard" | "wide" | "full";

export const FORM_SECTIONS = [
  { id: "scope", number: "01", title: "Scope", base: 0 },
  { id: "hazards", number: "02", title: "Hazards", base: 100 },
  { id: "controls", number: "03", title: "Controls", base: 200 },
  { id: "details", number: "04", title: "Permit Details", base: 300 },
  { id: "review", number: "05", title: "Review", base: 400 },
  { id: "authorization", number: "06", title: "Authorization", base: 500 },
] as const;

export type FormSectionId = (typeof FORM_SECTIONS)[number]["id"];

export const FIELD_TYPE_LABELS: Record<string, string> = {
  TEXT: "Single-line Text",
  MULTILINE_TEXT: "Long Text",
  YES_NO: "Yes / No",
  SINGLE_SELECT: "Single Choice",
  MULTI_SELECT: "Multiple Choice",
  NUMBER: "Whole Number",
  DECIMAL: "Decimal Number",
  DATE: "Date",
  TIME: "Time",
  DATETIME: "Date & Time",
};

export const RULE_ACTIONS = [
  { code: "REQUIRE_MODULE", label: "Require module" },
  { code: "SHOW_FIELD", label: "Show field" },
  { code: "REQUIRE_FIELD", label: "Require field" },
  { code: "REQUIRE_QUALIFICATION", label: "Require qualification" },
  { code: "REQUIRE_CONTROL", label: "Require control" },
  { code: "REQUIRE_PPE", label: "Require PPE" },
] as const;

const MODULE_TITLES: Record<string, string> = {
  CORE: "Core",
  JSA: "Job safety analysis",
  PROCEDURE: "Procedure",
  HAZARD_ASSESSMENT: "Hazard assessment",
  PPE: "PPE",
  LOTO_ISOLATION: "Lockout / isolation",
  ATMOSPHERIC_MONITORING: "Atmospheric monitoring",
  HOT_WORK: "Hot work",
  FIRE_WATCH: "Fire watch",
  CONFINED_SPACE: "Confined space",
  RESCUE: "Rescue",
  EXCAVATION: "Excavation",
  OPENING_BLINDING: "Opening / blinding",
  LIVE_ELECTRICAL: "Live electrical",
  WORKING_AT_HEIGHT: "Working at height",
};

export const PERMIT_TYPE_PROFILES = [
  {
    code: "GENERAL_WORK",
    title: "General Work",
    description: "General plant work. Specialty work stays out of this permit until a rule or the work scope brings it in.",
    conditional: ["PROCEDURE", "WORKING_AT_HEIGHT"],
  },
  {
    code: "HOT_WORK",
    title: "Hot Work",
    description: "Work that can ignite flammable material, including welding, cutting, and grinding.",
    conditional: ["LOTO_ISOLATION"],
  },
  {
    code: "CONFINED_SPACE",
    title: "Confined Space Entry",
    description: "Entry into a confined space, including atmosphere, attendant, and rescue requirements.",
    conditional: ["HOT_WORK", "FIRE_WATCH"],
  },
  {
    code: "OPENING_BLINDING",
    title: "Opening / Blinding",
    description: "Opening process equipment or changing blinds, including isolation and line opening.",
    conditional: ["ATMOSPHERIC_MONITORING"],
  },
  {
    code: "EXCAVATION",
    title: "Excavation",
    description: "Ground disturbance, excavation, and the controls that go with buried services.",
    conditional: ["ATMOSPHERIC_MONITORING"],
  },
  {
    code: "LIVE_ELECTRICAL",
    title: "Live Electrical Work",
    description: "Work on or near energized electrical equipment by a qualified electrical worker.",
    conditional: ["WORKING_AT_HEIGHT"],
  },
] as const;

export function fieldTypeLabel(code: string): string {
  return FIELD_TYPE_LABELS[code] ?? humanize(code);
}

export function moduleTitle(code: string): string {
  return MODULE_TITLES[code] ?? humanize(code);
}

export function permitTypeProfile(code: string) {
  return PERMIT_TYPE_PROFILES.find((item) => item.code === code) ?? {
    code,
    title: humanize(code),
    description: "System permit type.",
    conditional: [] as readonly string[],
  };
}

export function parseModuleCodes(modules: string): string[] {
  return modules.split(",").map((item) => item.trim()).filter((item) => item.length > 0);
}

export function sectionForOrder(order: number) {
  const match = [...FORM_SECTIONS].reverse().find((section) => order >= section.base);
  return match ?? FORM_SECTIONS[0];
}

export function sectionPosition(order: number): number {
  return Math.max(0, order - sectionForOrder(order).base);
}

export function displayOrder(sectionId: string, position: number): number {
  const section = FORM_SECTIONS.find((item) => item.id === sectionId) ?? FORM_SECTIONS[0];
  const local = Number.isFinite(position) ? Math.max(0, Math.min(99, Math.trunc(position))) : 0;
  return section.base + local;
}

export function fieldsInSection<T extends { displayOrder: number }>(fields: T[], sectionId: string): T[] {
  return fields.filter((field) => sectionForOrder(field.displayOrder).id === sectionId);
}

export function choiceCount<T extends { choices?: unknown[] }>(fields: T[]): number {
  return fields.reduce((total, field) => total + (field.choices?.length ?? 0), 0);
}

export function versionState(published: number, versions: number[]) {
  const highest = versions.reduce((max, version) => Math.max(max, version), published);
  const draft = highest > published;
  return {
    published,
    working: draft ? highest : null,
    publishedLabel: published > 0 ? String(published) : "No published configuration yet",
    workingLabel: draft ? `${highest} - DRAFT` : "No working draft",
  };
}

export function configurationChanges(
  fields: { permitType: string; code: string; configurationVersion: number }[],
  rules: { configurationVersion: number }[],
  published: number,
) {
  const workingFields = fields.filter((field) => field.configurationVersion > published);
  const added = workingFields.filter(
    (field) => !fields.some((other) => other.permitType === field.permitType && other.code === field.code && other.configurationVersion <= published),
  ).length;
  const updated = workingFields.length - added;
  const changedRules = rules.filter((rule) => rule.configurationVersion > published).length;
  return { added, updated, changedRules, total: added + updated + changedRules };
}

export function ruleSentence(
  rule: { conditionCode: string; conditionValue: string; action: string; actionTarget: string },
  fields: { code: string; label: string }[] = [],
): string {
  const field = fields.find((item) => item.code === rule.conditionCode);
  const subject = field?.label ?? humanize(rule.conditionCode);
  const value = displayValue(rule.conditionValue);
  return `When "${subject}" is ${value}, ${actionPhrase(rule.action, rule.actionTarget, fields)}.`;
}

export function actionPhrase(action: string, target: string, fields: { code: string; label: string }[] = []): string {
  const field = fields.find((item) => item.code === target);
  const named = field?.label ?? (action === "REQUIRE_MODULE" ? moduleTitle(target) : humanize(target));
  switch (action) {
    case "REQUIRE_MODULE":
      return `require the ${named} module`;
    case "SHOW_FIELD":
      return `show "${named}"`;
    case "REQUIRE_FIELD":
      return `require "${named}"`;
    case "REQUIRE_QUALIFICATION":
      return `require the ${named} qualification`;
    case "REQUIRE_CONTROL":
      return `require the ${named} control`;
    case "REQUIRE_PPE":
      return `require ${named}`;
    default:
      return `${humanize(action)} ${named}`;
  }
}

export function suggestFieldCode(label: string): string {
  const code = label
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return code.length >= 2 ? code : "";
}

export function humanize(code: string): string {
  const text = code.replaceAll("_", " ").trim().toLowerCase();
  if (!text) return code;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function displayValue(value: string): string {
  if (value === "YES") return "Yes";
  if (value === "NO") return "No";
  return value;
}

export function adminRoleLine(user: { permitUserCode?: string | null; roles?: string[] } | null): string {
  if (!user) return "";
  const role = user.roles?.includes("SUPER_ADMIN") ? "Super Admin" : humanize(user.roles?.[0] ?? "Administrator");
  return [user.permitUserCode, role].filter(Boolean).join(" · ");
}

export function rulesForPermitType(
  rules: { actionTarget: string; conditionCode: string }[],
  permitCode: string,
  modules: string[],
): number {
  const tokens = new Set([permitCode, ...modules]);
  return rules.filter((rule) => tokens.has(rule.actionTarget) || tokens.has(rule.conditionCode)).length;
}
