import type { Permit, PermitDraft, PermitKind } from "./types";

export interface DetailField {
  key: string;
  label: string;
  wide?: boolean;
}

export interface PersonnelSlot {
  role: string;
  source: "attendant" | "entrants" | "fireWatch" | "condition";
  conditionLabel?: string;
  empty: string;
}

export interface ExtraRole {
  id: string;
  label: string;
  required: boolean;
}

export interface PermitTypeDef {
  id: PermitKind;
  title: string;
  short: string;
  place: "equipment" | "location";
  fields: DetailField[];
  roles: ExtraRole[];
  personnel: PersonnelSlot[];
}

export interface ScopeExclusion {
  key: string;
  label: string;
  recommends: PermitKind;
}

export interface TypeRecommendation {
  kind: PermitKind;
  reasons: string[];
}

const field = (key: string, label: string, wide = false): DetailField => ({ key, label, wide });

export const GENERAL_EXCLUSIONS: ScopeExclusion[] = [
  { key: "excludeOpening", label: "Process opening", recommends: "opening-blinding" },
  { key: "excludeContainment", label: "Containment break", recommends: "opening-blinding" },
  { key: "excludeEntry", label: "Confined-space entry", recommends: "confined-space" },
  { key: "excludeIsolation", label: "Energy isolation", recommends: "opening-blinding" },
  { key: "excludeHotWork", label: "Hot work", recommends: "hot-work" },
];

const HAZARD_TYPE: Record<string, PermitKind> = {
  "fire/hot work": "hot-work",
  engulfment: "confined-space",
  "excavation/cave-in": "excavation",
  "underground utilities": "excavation",
  electrical: "live-electrical",
  "stored energy": "opening-blinding",
};

const TYPES: Record<PermitKind, PermitTypeDef> = {
  general: {
    id: "general",
    title: "GENERAL WORK",
    short: "GENERAL",
    place: "equipment",
    fields: [
      field("taskType", "Task type"),
      field("equipmentSystem", "Equipment / system"),
      field("serviceProcess", "Service / process"),
      field("materialInService", "Material in service"),
      field("coordination", "Operational coordination", true),
      field("heightControls", "Working-at-height controls", true),
      field("ppe", "PPE"),
    ],
    roles: [],
    personnel: [],
  },
  "hot-work": {
    id: "hot-work",
    title: "HOT WORK",
    short: "HOT WORK",
    place: "equipment",
    fields: [
      field("previousService", "Material previously in service"),
      field("loto", "LOTO / energy control"),
      field("lockBox", "Lock box"),
      field("blindRequirements", "Blind requirements"),
      field("initialTest", "Initial atmosphere test"),
      field("retests", "Periodic atmosphere retests"),
      field("hotWorkEquipment", "Hot-work equipment"),
      field("areaPrep", "Area preparation"),
      field("combustibleClearance", "Combustible clearance"),
      field("ignitionControls", "Ignition controls"),
      field("extinguishing", "Fire extinguishing equipment"),
      field("fireWatch", "Fire watch"),
      field("postFireWatch", "Post-work fire watch"),
      field("ppe", "PPE"),
    ],
    roles: [{ id: "firewatch", label: "Fire Watch", required: false }],
    personnel: [{ role: "Fire Watch", source: "fireWatch", empty: "Not assigned" }],
  },
  "confined-space": {
    id: "confined-space",
    title: "CONFINED SPACE ENTRY",
    short: "CONFINED SPACE",
    place: "equipment",
    fields: [
      field("vesselId", "Vessel / space ID"),
      field("previousService", "Material previously in service"),
      field("energyIsolation", "Isolation / LOTO"),
      field("blinds", "Blind locations"),
      field("mechanical", "Mechanical / process isolation"),
      field("atmospheric", "Atmospheric testing"),
      field("continuous", "Continuous / periodic monitoring"),
      field("preparation", "Space preparation"),
      field("entrant", "Entrant"),
      field("attendant", "Attendant"),
      field("rescue", "Rescue availability"),
      field("hotWorkInside", "Hot work inside space"),
      field("ppe", "PPE"),
    ],
    roles: [
      { id: "attendant", label: "Attendant", required: true },
      { id: "rescue", label: "Rescue", required: true },
    ],
    personnel: [
      { role: "Attendant", source: "attendant", empty: "Not assigned" },
      { role: "Authorized Entrants", source: "entrants", empty: "None listed" },
      { role: "Fire Watch", source: "fireWatch", empty: "Not required" },
    ],
  },
  "opening-blinding": {
    id: "opening-blinding",
    title: "OPENING & BLINDING",
    short: "OPENING & BLINDING",
    place: "equipment",
    fields: [
      field("previousService", "Material previously in service"),
      field("loto", "LOTO / energy control"),
      field("lockBox", "Lock box"),
      field("zeroEnergy", "Zero-energy verification"),
      field("initialTest", "Initial atmosphere test"),
      field("retests", "Periodic retests"),
      field("flushing", "Flushing"),
      field("flushMaterial", "Flush material"),
      field("depressured", "Depressured / drained"),
      field("blinded", "Blinded / disconnected"),
      field("cleaned", "Cleaned / steamed"),
      field("nitrogen", "Nitrogen purge"),
      field("sump", "Sump condition"),
      field("barricades", "Barricades"),
      field("ignitionControls", "Ignition controls"),
      field("ppe", "PPE"),
    ],
    roles: [],
    personnel: [],
  },
  excavation: {
    id: "excavation",
    title: "EXCAVATION",
    short: "EXCAVATION",
    place: "location",
    fields: [
      field("digLocation", "Excavation location"),
      field("depth", "Expected depth"),
      field("competentPerson", "Competent person"),
      field("utilityLocate", "Utility locate"),
      field("locateTicket", "Locate ticket"),
      field("drawings", "Underground drawings"),
      field("undergroundHazards", "Underground hazards"),
      field("isolationProtection", "Isolation / protection"),
      field("atmospheric", "Atmospheric requirements"),
      field("protectiveSystem", "Protective system"),
      field("soil", "Soil classification"),
      field("access", "Access / egress"),
      field("spoil", "Spoil-pile controls"),
      field("setback", "Equipment setback"),
      field("traffic", "Traffic controls"),
      field("water", "Water conditions"),
      field("ppe", "PPE"),
    ],
    roles: [{ id: "competent", label: "Competent Person", required: true }],
    personnel: [{ role: "Competent Person", source: "condition", conditionLabel: "Competent person", empty: "Not listed" }],
  },
  "live-electrical": {
    id: "live-electrical",
    title: "LIVE ELECTRICAL WORK",
    short: "LIVE ELECTRICAL",
    place: "equipment",
    fields: [
      field("panel", "Equipment / panel / circuit"),
      field("voltage", "Voltage"),
      field("qualifiedWorker", "Qualified electrical worker"),
      field("nfpa70e", "NFPA 70E training verification"),
      field("shockTraining", "Shock / arc-flash training"),
      field("cpr", "CPR / first-aid availability"),
      field("justification", "Energized-work justification", true),
      field("inspection", "Equipment inspection"),
      field("labeling", "Arc-flash labeling"),
      field("adjacentIsolation", "Adjacent-energy isolation"),
      field("limitedBoundary", "Limited approach boundary"),
      field("restrictedBoundary", "Restricted approach boundary"),
      field("arcBoundary", "Arc-flash boundary"),
      field("ppeCategory", "Arc-flash PPE category"),
      field("tools", "Electrical tools"),
      field("observer", "Observer / safety watch"),
      field("disconnect", "Emergency disconnect"),
      field("rescuePlan", "Rescue planning"),
      field("electricalPpe", "Electrical PPE"),
    ],
    roles: [
      { id: "qualified", label: "Qualified Electrical Worker", required: false },
      { id: "observer", label: "Observer / Safety Watch", required: false },
    ],
    personnel: [
      { role: "Qualified Electrical Worker", source: "condition", conditionLabel: "Qualified electrical worker", empty: "Not listed" },
      { role: "Observer / Safety Watch", source: "condition", conditionLabel: "Observer / safety watch", empty: "Not listed" },
    ],
  },
};

export const PERMIT_TYPES: PermitTypeDef[] = [
  TYPES.general,
  TYPES["hot-work"],
  TYPES["confined-space"],
  TYPES["opening-blinding"],
  TYPES.excavation,
  TYPES["live-electrical"],
];

export function permitType(kind: PermitKind): PermitTypeDef {
  return TYPES[kind];
}

export function typeRecommendations(draft: PermitDraft): TypeRecommendation[] {
  if (draft.kind !== "general") return [];
  const reasons = new Map<PermitKind, string[]>();
  const add = (kind: PermitKind, reason: string) => {
    const list = reasons.get(kind) ?? [];
    if (!list.includes(reason)) list.push(reason);
    reasons.set(kind, list);
  };

  for (const exclusion of GENERAL_EXCLUSIONS) {
    if (draft.fields[exclusion.key] === "included") {
      add(exclusion.recommends, `Scope includes ${exclusion.label.toLowerCase()}`);
    }
  }
  for (const hazard of draft.hazards) {
    const kind = HAZARD_TYPE[hazard];
    if (kind) add(kind, `Hazard: ${hazard}`);
  }
  if (draft.controls.includes("LOTO")) {
    add("opening-blinding", "Control: LOTO");
  }

  return PERMIT_TYPES.filter((type) => reasons.has(type.id)).map((type) => ({
    kind: type.id,
    reasons: reasons.get(type.id) ?? [],
  }));
}

export function personName(permit: Permit, slot: PersonnelSlot): string {
  if (slot.source === "attendant") return permit.attendant || slot.empty;
  if (slot.source === "entrants") return permit.entrants.length ? permit.entrants.join(", ") : slot.empty;
  if (slot.source === "fireWatch") return permit.fireWatch || slot.empty;
  return permit.conditions.find((item) => item.label === slot.conditionLabel)?.value || slot.empty;
}
