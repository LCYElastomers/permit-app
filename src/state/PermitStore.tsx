/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { initialDrafts, initialPermits, templates } from "../data/mock";
import { plantClock } from "../plantClock";
import type { ListScreen, Permit, PermitDraft, Screen } from "../types";
import {
  authorizationRoles,
  emptyDraft,
  shiftTime,
  statusFromLabel,
  statusLabel,
  titleCase,
} from "../workflow";

interface PermitStoreValue {
  permits: Permit[];
  drafts: PermitDraft[];
  screen: Screen;
  origin: ListScreen;
  selectedId: string | null;
  readonlyDetail: boolean;
  form: PermitDraft;
  updateForm: Dispatch<SetStateAction<PermitDraft>>;
  go: (screen: ListScreen) => void;
  openPermit: (id: string, from: ListScreen, readonly?: boolean) => void;
  suspendPermit: (id: string, reason: string) => void;
  extendPermit: (id: string) => string;
  closePermit: (id: string) => void;
  reinstatePermit: (id: string) => void;
  saveDraft: () => string;
  loadDraft: (code: string) => void;
  applyTemplate: (id: string) => void;
  issuePermit: () => string;
  resetForm: () => void;
}

const PermitStore = createContext<PermitStoreValue | null>(null);

function nextPermitId(permits: Permit[]): string {
  let max = 0;
  for (const permit of permits) {
    const match = /^PTW-2026-(\d+)$/.exec(permit.id);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `PTW-2026-${String(max + 1).padStart(5, "0")}`;
}

function nextDraftCode(drafts: PermitDraft[]): string {
  let max = 0;
  for (const draft of drafts) {
    const match = /^DFT-2026-(\d+)$/.exec(draft.code);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `DFT-2026-${String(max + 1).padStart(3, "0")}`;
}

function permitFromDraft(draft: PermitDraft, id: string, time: string): Permit {
  const confined = draft.kind === "confined-space";
  const fields = draft.fields;
  const equipment = confined ? fields.vesselId || draft.place : "";
  const location = confined ? "" : fields.digLocation || draft.place;
  const roles = authorizationRoles(draft);
  const signoffs = roles.map((role) => {
    const signature = draft.signatures[role.id];
    return signature
      ? { role: role.label, name: signature.name, state: "signed" as const, time: signature.time }
      : { role: role.label, name: "", state: "outstanding" as const, time: "" };
  });
  const signedEvents = roles
    .filter((role) => draft.signatures[role.id])
    .map((role) => ({
      time: draft.signatures[role.id].time,
      label: `SIGNED - ${role.label.toUpperCase()}`,
      tone: "ok" as const,
    }))
    .sort((a, b) => a.time.localeCompare(b.time));

  const conditions = (confined
    ? [
        ["Material previously in service", fields.previousService],
        ["Mechanical isolation", fields.mechanical],
        ["Continuous monitoring", fields.continuous],
        ["Rescue availability", fields.rescue],
        ["Hot work controls", fields.hotWork],
        ["Initial atmosphere test", fields.initialTest],
      ]
    : [
        ["Excavation location", fields.digLocation],
        ["Expected depth", fields.depth],
        ["Competent person", fields.competentPerson],
        ["One-call / locate ticket", fields.locateTicket],
        ["Underground drawings", fields.drawings],
        ["Underground hazards", fields.undergroundHazards],
        ["Protective system", fields.protectiveSystem],
        ["Soil classification", fields.soil],
        ["Access / egress", fields.access],
        ["Barricades", fields.barricades],
        ["Traffic control", fields.traffic],
        ["Atmospheric monitoring", fields.monitoring],
      ]
  )
    .filter((entry): entry is [string, string] => Boolean(entry[1]?.trim()))
    .map(([label, value]) => ({ label, value }));

  if (draft.fields.otherHazard?.trim()) {
    conditions.push({ label: "Other hazard", value: draft.fields.otherHazard.trim() });
  }
  if (draft.fields.otherControl?.trim()) {
    conditions.push({ label: "Other controls", value: draft.fields.otherControl.trim() });
  }

  return {
    id,
    kind: draft.kind,
    status: "active",
    revision: "01",
    area: draft.area,
    equipment,
    location,
    work: draft.description.trim(),
    jobDescription: draft.description.trim(),
    workOrder: draft.workOrder.trim(),
    company: draft.company.trim(),
    companyType: draft.companyType,
    requester: draft.requester.trim(),
    requesterGroup: "",
    craft: draft.craft.trim(),
    shiftSupervisor: draft.signatures.supervisor?.name ?? "",
    attendant: draft.signatures.attendant?.name || fields.attendant || "",
    entrants: [],
    fireWatch: draft.signatures.firewatch?.name ?? "",
    started: time,
    expires: draft.plannedEnd,
    issued: "21 Oct 2026",
    closed: "",
    issuedKey: "20261021",
    year: 2026,
    isolation: {
      required: fields.energyIsolation || (draft.controls.includes("LOTO") ? "Yes" : confined ? "Yes" : "No"),
      plan: confined ? "Assigned at issue" : "—",
      lockBox: fields.lockBox || "—",
      zeroEnergy: confined ? time : "—",
      blinds: fields.blinds || "—",
    },
    readings: [],
    hazards: draft.hazards.map(titleCase),
    ppe: fields.ppe ? [fields.ppe] : draft.controls.includes("PPE") ? ["As stated on the JSA"] : [],
    precautions: draft.controls.map(titleCase),
    attachments: [{ name: "JSA.pdf", note: "Job safety analysis referenced by this permit." }],
    history: [
      { time, label: "CREATED", tone: "neutral" },
      ...signedEvents,
      { time, label: "ACTIVE", tone: "alert" },
    ],
    suspension: null,
    signoffs,
    conditions,
  };
}

export function PermitProvider({ children }: { children: ReactNode }) {
  const [permits, setPermits] = useState<Permit[]>(() => structuredClone(initialPermits));
  const [drafts, setDrafts] = useState<PermitDraft[]>(() => structuredClone(initialDrafts));
  const [screen, setScreen] = useState<Screen>("active");
  const [origin, setOrigin] = useState<ListScreen>("active");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [readonlyDetail, setReadonlyDetail] = useState(false);
  const [form, setForm] = useState<PermitDraft>(() => emptyDraft());

  const go = (next: ListScreen) => {
    setScreen(next);
    setOrigin(next);
    setSelectedId(null);
  };

  const openPermit = (id: string, from: ListScreen, readonly = false) => {
    const permit = permits.find((item) => item.id === id);
    const locked = readonly || permit?.status === "closed" || permit?.status === "expired";
    setOrigin(from);
    setSelectedId(id);
    setReadonlyDetail(locked);
    setScreen("detail");
  };

  const suspendPermit = (id: string, reason: string) => {
    const time = plantClock().hm;
    setPermits((list) =>
      list.map((permit) => {
        if (permit.id !== id || permit.status === "suspended") return permit;
        return {
          ...permit,
          status: "suspended",
          suspension: {
            time,
            reason,
            by: "Shift Supervisor",
            previous: statusLabel(permit.status),
          },
          history: [...permit.history, { time, label: "SUSPENDED", tone: "alert" }],
        };
      }),
    );
  };

  const extendPermit = (id: string) => {
    const time = plantClock().hm;
    const current = permits.find((permit) => permit.id === id);
    const nextExpires = current?.expires ? shiftTime(current.expires, 120) : "";
    if (!current || !nextExpires) return current?.expires ?? "";
    setPermits((list) =>
      list.map((permit) =>
        permit.id === id
          ? {
              ...permit,
              expires: nextExpires,
              history: [...permit.history, { time, label: `EXTENDED TO ${nextExpires}`, tone: "neutral" }],
            }
          : permit,
      ),
    );
    return nextExpires;
  };

  const closePermit = (id: string) => {
    const time = plantClock().hm;
    setPermits((list) =>
      list.map((permit) => {
        if (permit.id !== id) return permit;
        return {
          ...permit,
          status: "closed",
          closed: permit.closed || "21 Oct 2026",
          issued: permit.issued || "21 Oct 2026",
          year: 2026,
          issuedKey: permit.issuedKey || "20261021",
          history: [...permit.history, { time, label: "CLOSED", tone: "alert" }],
        };
      }),
    );
    setReadonlyDetail(true);
  };

  const reinstatePermit = (id: string) => {
    const time = plantClock().hm;
    setPermits((list) =>
      list.map((permit) => {
        if (permit.id !== id || permit.status !== "suspended") return permit;
        return {
          ...permit,
          status: statusFromLabel(permit.suspension?.previous ?? "ACTIVE"),
          suspension: null,
          history: [...permit.history, { time, label: "REINSTATED", tone: "ok" }],
        };
      }),
    );
  };

  const saveDraft = () => {
    const time = plantClock().hm;
    const code = form.code || nextDraftCode(drafts);
    const saved: PermitDraft = { ...form, code, updated: time };
    setDrafts((list) => {
      const exists = list.some((draft) => draft.code === code);
      return exists ? list.map((draft) => (draft.code === code ? saved : draft)) : [saved, ...list];
    });
    setForm(saved);
    return code;
  };

  const loadDraft = (code: string) => {
    const draft = drafts.find((item) => item.code === code);
    if (!draft) return;
    setForm(structuredClone(draft));
    setScreen("new");
    setOrigin("new");
  };

  const applyTemplate = (id: string) => {
    const template = templates.find((item) => item.id === id);
    if (!template) return;
    setForm({
      ...emptyDraft(template.kind),
      hazards: [...template.hazards],
      controls: [...template.controls],
      updated: plantClock().hm,
    });
    setScreen("new");
    setOrigin("new");
  };

  const issuePermit = () => {
    const time = plantClock().hm;
    const id = nextPermitId(permits);
    const permit = permitFromDraft(form, id, time);
    setPermits((list) => [permit, ...list]);
    if (form.code) {
      setDrafts((list) => list.filter((draft) => draft.code !== form.code));
    }
    setForm(emptyDraft());
    setOrigin("active");
    setSelectedId(id);
    setReadonlyDetail(false);
    setScreen("detail");
    return id;
  };

  const resetForm = () => setForm(emptyDraft());

  return (
    <PermitStore.Provider
      value={{
        permits,
        drafts,
        screen,
        origin,
        selectedId,
        readonlyDetail,
        form,
        updateForm: setForm,
        go,
        openPermit,
        suspendPermit,
        extendPermit,
        closePermit,
        reinstatePermit,
        saveDraft,
        loadDraft,
        applyTemplate,
        issuePermit,
        resetForm,
      }}
    >
      {children}
    </PermitStore.Provider>
  );
}

export function usePermits(): PermitStoreValue {
  const store = useContext(PermitStore);
  if (!store) throw new Error("usePermits must be used within PermitProvider");
  return store;
}
