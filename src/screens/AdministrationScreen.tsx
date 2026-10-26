import { useEffect, useState } from "react";
import { ScreenHead } from "../components/ui";
import { UsersScreen } from "./UsersScreen";
import { useDevice } from "../services/device";
import { useIdentity } from "../services/identity";
import { canPerform, pinMessage } from "../services/plantDirectory";
import { safeDiagnostic } from "../services/lifecyclePrompt";
import {
  listCatalog,
  listFields,
  listPermitTypes,
  listRules,
  publishForm,
  publishedVersion,
  saveCatalog,
  saveChoice,
  saveField,
  saveRule,
  type CatalogItem,
  type FieldRecord,
  type RuleRecord,
} from "../services/administration";

const GROUPS: { title: string; items: { id: Section; label: string }[] }[] = [
  { title: "PEOPLE & ACCESS", items: [{ id: "users", label: "Users" }, { id: "users", label: "Roles and qualifications" }] },
  {
    title: "PERMIT CONFIGURATION",
    items: [
      { id: "areas", label: "Areas" },
      { id: "equipment", label: "Equipment" },
      { id: "contractors", label: "Contractors" },
      { id: "work-types", label: "Work Types" },
      { id: "templates", label: "Templates" },
      { id: "hazards", label: "Hazards" },
      { id: "controls", label: "Controls" },
      { id: "ppe", label: "PPE" },
    ],
  },
  { title: "FORM / WORKFLOW", items: [{ id: "types", label: "Permit Types" }, { id: "forms", label: "Form Configuration" }, { id: "rules", label: "Rules" }] },
  { title: "SYSTEM", items: [{ id: "system", label: "Plant Link and diagnostics" }] },
];

type Section = "home" | "users" | "areas" | "equipment" | "contractors" | "work-types" | "templates" | "hazards" | "controls" | "ppe" | "types" | "forms" | "rules" | "system";

const CATALOGS = new Set(["areas", "equipment", "contractors", "work-types", "templates", "hazards", "controls", "ppe"]);

export function AdministrationScreen() {
  const identity = useIdentity();
  const [section, setSection] = useState<Section>("home");
  if (!canPerform(identity.user, "ADMIN")) {
    return <div className="screen"><p className="empty">Administration requires a Permit Control administrator.</p></div>;
  }
  return (
    <div className="screen">
      <ScreenHead kicker="ADMINISTRATION" title={section === "home" ? "Administration" : section.replaceAll("-", " ")} meta={identity.user?.permitUserCode ?? ""} />
      {section !== "home" ? <button type="button" className="btn btn-ghost" onClick={() => setSection("home")}>Administration home</button> : null}
      {section === "home" ? <Home onOpen={setSection} /> : null}
      {section === "users" ? <UsersScreen /> : null}
      {CATALOGS.has(section) ? <CatalogPanel catalog={section} token={identity.token} /> : null}
      {section === "types" ? <PermitTypes token={identity.token} /> : null}
      {section === "forms" ? <Forms token={identity.token} /> : null}
      {section === "rules" ? <Rules token={identity.token} /> : null}
      {section === "system" ? <SystemStatus /> : null}
    </div>
  );
}

function Home({ onOpen }: { onOpen: (section: Section) => void }) {
  return (
    <div className="detail-layout">
      {GROUPS.map((group) => (
        <section key={group.title}>
          <div className="kicker">{group.title}</div>
          {group.items.map((item) => (
            <button key={`${group.title}-${item.label}`} type="button" className="permit-row" onClick={() => onOpen(item.id)}>
              <div className="row-work">{item.label}</div>
            </button>
          ))}
        </section>
      ))}
    </div>
  );
}

function CatalogPanel({ catalog, token }: { catalog: string; token: string | null }) {
  const { link } = useDevice();
  const [rows, setRows] = useState<CatalogItem[]>([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [detail, setDetail] = useState("");
  const [parentId, setParentId] = useState("");
  const [message, setMessage] = useState("");
  const load = async () => {
    if (!token) return;
    setRows(await listCatalog(token, catalog));
  };
  useEffect(() => {
    void load().catch((error) => setMessage(pinMessage(error)));
  }, [catalog, token]);
  const save = async (edit: { id?: string; name: string; code: string; detail: string; enabled: boolean; parentId: string }) => {
    if (!token) return;
    if (link.link !== "ready") {
      setMessage("Administration changes require Plant Link ready.");
      return;
    }
    setMessage("");
    try {
      await saveCatalog(token, catalog, { id: edit.id, code: edit.code || edit.name, name: edit.name, detail: edit.detail, enabled: edit.enabled, displayOrder: rows.length, parentId: edit.parentId || null });
      setName("");
      setCode("");
      setDetail("");
      await load();
    } catch (error) {
      setMessage(pinMessage(error));
    }
  };
  return (
    <section>
      <p>Changes are saved to the plant record while Plant Link is ready. A referenced area, equipment item, or contractor is disabled instead of deleted.</p>
      {rows.map((row) => (
        <button key={row.id} type="button" className="permit-row" onClick={() => void save({ id: row.id, name: row.name, code: row.code, detail: row.detail ?? "", enabled: !row.enabled, parentId: row.parentId ?? "" })}>
          <div className="row-top"><span className="pid mono">{row.code}</span><span className="kind">{row.name}</span><span className="screen-meta">{row.enabled ? "ENABLED" : "DISABLED"}</span></div>
        </button>
      ))}
      <label className="confirm-field"><span>Name</span><input value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label className="confirm-field"><span>Code or permit type</span><input value={code} onChange={(event) => setCode(event.target.value)} /></label>
      <label className="confirm-field"><span>Detail</span><input value={detail} onChange={(event) => setDetail(event.target.value)} /></label>
      {catalog === "equipment" ? <label className="confirm-field"><span>Area id</span><input value={parentId} onChange={(event) => setParentId(event.target.value)} /></label> : null}
      <button type="button" className="btn" onClick={() => void save({ name, code, detail, enabled: true, parentId })}>Save</button>
      {message ? <p className="form-error">{message}</p> : null}
    </section>
  );
}

function PermitTypes({ token }: { token: string | null }) {
  const [rows, setRows] = useState<{ code: string; modules: string }[]>([]);
  useEffect(() => {
    if (!token) return;
    void listPermitTypes(token).then(setRows).catch(() => setRows([]));
  }, [token]);
  return (
    <section>
      <p>These six permit types are system codes. Administration can inspect their module composition. It cannot rename or delete them.</p>
      {rows.map((row) => <p key={row.code}><strong>{row.code}</strong> · {row.modules}</p>)}
    </section>
  );
}

function Forms({ token }: { token: string | null }) {
  const { link } = useDevice();
  const [fields, setFields] = useState<FieldRecord[]>([]);
  const [version, setVersion] = useState(0);
  const [label, setLabel] = useState("");
  const [code, setCode] = useState("");
  const [fieldType, setFieldType] = useState("TEXT");
  const [choice, setChoice] = useState("");
  const [pin, setPin] = useState("");
  const [message, setMessage] = useState("");
  const load = async () => {
    if (!token) return;
    setFields(await listFields(token));
    setVersion(await publishedVersion(token));
  };
  useEffect(() => { void load().catch((error) => setMessage(pinMessage(error))); }, [token]);
  return (
    <section>
      <p>Published form version {version}. A published field is revised into the next version. Historical permits keep the version they were submitted against.</p>
      {fields.map((field) => <p key={field.id}>{field.permitType} · {field.code} · {field.label} · {field.fieldType} · v{field.configurationVersion}</p>)}
      <label className="confirm-field"><span>Label</span><input value={label} onChange={(event) => setLabel(event.target.value)} /></label>
      <label className="confirm-field"><span>Code</span><input value={code} onChange={(event) => setCode(event.target.value)} /></label>
      <label className="confirm-field"><span>Field type</span>
        <select value={fieldType} onChange={(event) => setFieldType(event.target.value)}>
          {["TEXT", "MULTILINE_TEXT", "YES_NO", "NUMBER", "DECIMAL", "DATE", "TIME", "DATETIME", "SINGLE_SELECT", "MULTI_SELECT"].map((item) => <option key={item}>{item}</option>)}
        </select>
      </label>
      <button type="button" className="btn" onClick={() => {
        if (link.link !== "ready") { setMessage("Administration changes require Plant Link ready."); return; }
        void saveField(token ?? "", { permitType: "GENERAL_WORK", code, label, fieldType, required: false, displayOrder: fields.length, enabled: true }).then(load).catch((error) => setMessage(pinMessage(error)));
      }}>Save field</button>
      <label className="confirm-field"><span>Choice label</span><input value={choice} onChange={(event) => setChoice(event.target.value)} /></label>
      <button type="button" className="btn" onClick={() => {
        if (link.link !== "ready") { setMessage("Administration changes require Plant Link ready."); return; }
        const field = fields.find((item) => item.fieldType === "SINGLE_SELECT" || item.fieldType === "MULTI_SELECT");
        if (!token || !field) { setMessage("Add a select field before adding a choice."); return; }
        void saveChoice(token, { fieldId: field.id, code: choice.toUpperCase().replaceAll(" ", "_"), label: choice, displayOrder: 0, enabled: true }).then(load).catch((error) => setMessage(pinMessage(error)));
      }}>Add choice</button>
      <label className="confirm-field"><span>PIN to publish</span><input inputMode="numeric" autoComplete="off" value={pin} onChange={(event) => setPin(event.target.value)} /></label>
      <button type="button" className="btn" onClick={() => {
        if (link.link !== "ready") { setMessage("Administration changes require Plant Link ready."); return; }
        void publishForm(token ?? "", pin).then(() => { setPin(""); return load(); }).catch((error) => setMessage(pinMessage(error)));
      }}>Publish form configuration</button>
      {message ? <p className="form-error">{message}</p> : null}
    </section>
  );
}

function Rules({ token }: { token: string | null }) {
  const { link } = useDevice();
  const [rules, setRules] = useState<RuleRecord[]>([]);
  const [action, setAction] = useState("REQUIRE_MODULE");
  const [target, setTarget] = useState("HOT_WORK");
  const [condition, setCondition] = useState("FIELD_X");
  const [value, setValue] = useState("YES");
  const [pin, setPin] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => { if (token) void listRules(token).then(setRules).catch(() => setRules([])); }, [token]);
  return (
    <section>
      <p>Rules use a fixed condition and action. They do not accept scripts.</p>
      {rules.map((rule) => <p key={rule.id}>v{rule.configurationVersion} · IF {rule.conditionCode} = {rule.conditionValue} THEN {rule.action} {rule.actionTarget}</p>)}
      <label className="confirm-field"><span>Condition code</span><input value={condition} onChange={(event) => setCondition(event.target.value)} /></label>
      <label className="confirm-field"><span>Condition value</span><input value={value} onChange={(event) => setValue(event.target.value)} /></label>
      <label className="confirm-field"><span>Action</span>
        <select value={action} onChange={(event) => setAction(event.target.value)}>
          {["REQUIRE_MODULE", "SHOW_FIELD", "REQUIRE_FIELD", "REQUIRE_QUALIFICATION", "REQUIRE_CONTROL", "REQUIRE_PPE"].map((item) => <option key={item}>{item}</option>)}
        </select>
      </label>
      <label className="confirm-field"><span>Action target</span><input value={target} onChange={(event) => setTarget(event.target.value)} /></label>
      <label className="confirm-field"><span>PIN</span><input inputMode="numeric" autoComplete="off" value={pin} onChange={(event) => setPin(event.target.value)} /></label>
      <button type="button" className="btn" onClick={() => {
        if (link.link !== "ready") { setMessage("Administration changes require Plant Link ready."); return; }
        void saveRule(token ?? "", { conditionCode: condition, conditionValue: value, action, actionTarget: target, enabled: true }, pin).then(() => token ? listRules(token) : []).then(setRules).catch((error) => setMessage(pinMessage(error)));
      }}>Save rule</button>
      {message ? <p className="form-error">{message}</p> : null}
    </section>
  );
}

function SystemStatus() {
  const { link, local } = useDevice();
  const rows = safeDiagnostic([
    { label: "Plant Link", value: link.link === "ready" ? "CONNECTED" : link.link === "api-online" ? "NOT READY" : "OFFLINE" },
    { label: "API", value: link.link === "unreachable" ? "OFFLINE" : "ONLINE" },
    { label: "Database", value: link.link === "ready" ? "READY" : "NOT READY" },
    { label: "Last plant contact", value: local.status === "available" ? local.lastPlantContactAt ?? "—" : "—" },
    { label: "Last reference sync", value: local.status === "available" ? local.lastReferenceSyncAt ?? "—" : "—" },
    { label: "Last permit sync", value: local.status === "available" ? local.lastPermitSyncAt ?? "—" : "—" },
    { label: "Local SQLite", value: local.status === "available" ? "AVAILABLE" : local.status === "failed" ? "UNAVAILABLE" : "CHECKING" },
    { label: "Pending outbox", value: local.status === "available" ? String(local.pendingCount) : "—" },
    { label: "App version", value: "0.0.0" },
  ]);
  return (
    <section>
      <p>Refresh reads the current Plant Link and local sync status. This screen does not run SQL or shell commands.</p>
      {rows.map((row) => <p key={row.label}><strong>{row.label}</strong> · {row.value}</p>)}
    </section>
  );
}
