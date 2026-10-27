import { useEffect, useState } from "react";
import {
  AdminBreadcrumbs,
  AdminButton,
  AdminEditorModal,
  AdminEmptyState,
  AdminError,
  AdminField,
  AdminFieldGroup,
  AdminHeader,
  AdminPage,
  AdminSection,
  AdminStatus,
  AdminToolbar,
} from "../components/admin";
import { UsersScreen } from "./UsersScreen";
import { useDevice } from "../services/device";
import { useIdentity } from "../services/identity";
import { administrationReturn } from "../services/navigationContext";
import { canPerform, listPlantUsers, pinMessage } from "../services/plantDirectory";
import { PinInput } from "../components/PinInput";
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
import {
  FORM_SECTIONS,
  PERMIT_TYPE_PROFILES,
  RULE_ACTIONS,
  actionPhrase,
  adminRoleLine,
  choiceCount,
  configurationChanges,
  displayOrder,
  displayValue,
  fieldTypeLabel,
  fieldsInSection,
  moduleTitle,
  parseModuleCodes,
  permitTypeProfile,
  rulesForPermitType,
  ruleSentence,
  sectionForOrder,
  sectionPosition,
  suggestFieldCode,
  versionState,
  type FormSectionId,
} from "../services/adminPresentation";

type Section = "home" | "users" | "roles" | "qualifications" | "areas" | "equipment" | "contractors" | "work-types" | "templates" | "hazards" | "controls" | "ppe" | "types" | "forms" | "rules" | "system";
type SystemFocus = "link" | "api" | "database" | "sync" | "diagnostics";
type Notice = { title: string; body: string } | null;

const CATALOGS = new Set(["areas", "equipment", "contractors", "work-types", "templates", "hazards", "controls", "ppe"]);
const QUALIFICATIONS = ["GAS_TESTER", "FIRE_WATCH", "ATTENDANT", "AUTHORIZED_ENTRANT", "COMPETENT_PERSON", "QUALIFIED_ELECTRICAL_WORKER", "SAFETY_WATCH"];
const MODULES = ["CORE", "JSA", "PROCEDURE", "HAZARD_ASSESSMENT", "PPE", "LOTO_ISOLATION", "ATMOSPHERIC_MONITORING", "HOT_WORK", "FIRE_WATCH", "CONFINED_SPACE", "RESCUE", "EXCAVATION", "OPENING_BLINDING", "LIVE_ELECTRICAL", "WORKING_AT_HEIGHT"];

const CATALOG_COPY: Record<string, { title: string; purpose: string; name: string; code: string; detail: string }> = {
  areas: { title: "Areas", purpose: "Plant areas used to place a permit.", name: "Area name", code: "Area code", detail: "Description" },
  equipment: { title: "Equipment", purpose: "Equipment tags that can be named on a permit.", name: "Equipment name", code: "Equipment tag", detail: "Description" },
  contractors: { title: "Contractors", purpose: "Companies that can appear as the work party.", name: "Company name", code: "Company code", detail: "Description" },
  "work-types": { title: "Work Types", purpose: "The kinds of work a permit can describe.", name: "Work type", code: "Code", detail: "Description" },
  templates: { title: "Templates", purpose: "Starting points for a permit type. The system permit type itself is not renamed.", name: "Template name", code: "Permit type", detail: "Description" },
  hazards: { title: "Hazards", purpose: "Hazard labels that can be selected on a permit.", name: "Hazard", code: "Code", detail: "Description" },
  controls: { title: "Controls", purpose: "Control labels that can be required on a permit.", name: "Control", code: "Code", detail: "Description" },
  ppe: { title: "PPE", purpose: "Protective equipment that can be required on a permit.", name: "PPE item", code: "Code", detail: "Description" },
};

interface Bundle {
  types: { code: string; modules: string }[];
  fields: FieldRecord[];
  rules: RuleRecord[];
  version: number;
  users: number | null;
  catalogs: Record<string, CatalogItem[]>;
}

const EMPTY_BUNDLE: Bundle = { types: [], fields: [], rules: [], version: 0, users: null, catalogs: {} };

export function AdministrationScreen() {
  const identity = useIdentity();
  const [section, setSection] = useState<Section>("home");
  const [systemFocus, setSystemFocus] = useState<SystemFocus>("link");
  const [typeCode, setTypeCode] = useState<string | null>(null);
  const [formType, setFormType] = useState("GENERAL_WORK");
  const [formSection, setFormSection] = useState<FormSectionId | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [bundle, setBundle] = useState<Bundle>(EMPTY_BUNDLE);
  const [notice, setNotice] = useState<Notice>(null);
  const load = async () => {
    if (!identity.token) return;
    const token = identity.token;
    const catalogs = [...CATALOGS];
    const settled = await Promise.allSettled([
      listPermitTypes(token),
      listFields(token),
      listRules(token),
      publishedVersion(token),
      listPlantUsers(token, "", "all"),
      ...catalogs.map((catalog) => listCatalog(token, catalog)),
    ]);
    const next = { ...EMPTY_BUNDLE, catalogs: {} as Record<string, CatalogItem[]> };
    if (settled[0].status === "fulfilled") next.types = settled[0].value;
    if (settled[1].status === "fulfilled") next.fields = settled[1].value;
    if (settled[2].status === "fulfilled") next.rules = settled[2].value;
    if (settled[3].status === "fulfilled") next.version = settled[3].value;
    if (settled[4].status === "fulfilled") next.users = settled[4].value.length;
    catalogs.forEach((catalog, index) => {
      const result = settled[index + 5];
      next.catalogs[catalog] = result?.status === "fulfilled" ? (result.value as CatalogItem[]) : [];
    });
    setBundle(next);
    if (settled.some((item) => item.status === "rejected")) {
      setNotice({ title: "SOME ADMINISTRATION DATA IS UNAVAILABLE", body: "Permit Control could not read every administration list. The pages below use the records that did load." });
    } else {
      setNotice(null);
    }
  };
  useEffect(() => {
    void load().catch(() => setNotice({ title: "ADMINISTRATION DATA IS UNAVAILABLE", body: "Permit Control could not read the administration lists. Plant Link does not remove records already stored." }));
  }, [identity.token]);

  if (!canPerform(identity.user, "ADMIN")) {
    return (
      <div className="screen">
        <AdminPage>
          <AdminEmptyState title="ADMINISTRATION IS LIMITED">This Permit Control account does not have administration access.</AdminEmptyState>
        </AdminPage>
      </div>
    );
  }

  const context = adminRoleLine(identity.user);
  const open = (next: Section) => {
    setSection(next);
    setTypeCode(null);
    setFormSection(null);
    setEditingField(null);
    setNotice(null);
  };
  const crumbs = breadcrumbs(section, typeCode, formType, formSection);
  const back = administrationReturn({ section, typeCode, formSection });
  const followBack = () => {
    if (!back) return;
    if (back.target === "home") open("home");
    if (back.target === "types") {
      setSection("types");
      setTypeCode(null);
      setFormSection(null);
      setEditingField(null);
    }
    if (back.target === "forms") {
      setFormSection(null);
      setEditingField(null);
    }
  };

  return (
    <div className="screen">
      <AdminPage>
        <AdminHeader title={pageTitle(section, typeCode, formSection, false)} purpose={pagePurpose(section, typeCode, formSection, false)} context={context} backLabel={back?.label} onBack={back ? followBack : undefined} />
        <AdminBreadcrumbs items={crumbs} onSelect={(id) => followCrumb(id, open, setTypeCode, setFormType, setFormSection, setEditingField, setSection)} />
        {notice ? <AdminError title={notice.title} onRetry={() => void load()}>{notice.body}</AdminError> : null}
        {section === "home" ? <Home bundle={bundle} onOpen={(id) => { if (id === "system") setSystemFocus("link"); open(id); }} onSystem={(focus) => { setSystemFocus(focus); open("system"); }} /> : null}
        {section === "users" || section === "roles" || section === "qualifications" ? (
          <UsersScreen embedded focus={section === "roles" ? "roles" : section === "qualifications" ? "qualifications" : "directory"} />
        ) : null}
        {CATALOGS.has(section) ? <CatalogPanel catalog={section} token={identity.token} rows={bundle.catalogs[section] ?? []} areas={bundle.catalogs.areas ?? []} onSaved={load} /> : null}
        {section === "types" && !typeCode ? <PermitTypeList bundle={bundle} onOpen={setTypeCode} onConfigure={(code) => { setFormType(code); open("forms"); }} /> : null}
        {section === "types" && typeCode ? <PermitTypeDetail code={typeCode} bundle={bundle} onConfigure={() => { setFormType(typeCode); setSection("forms"); setTypeCode(null); }} /> : null}
        {section === "forms" ? (
          <FormDesigner
            token={identity.token}
            bundle={bundle}
            permitType={formType}
            sectionId={formSection}
            editing={editingField}
            onType={(code) => { setFormType(code); setFormSection(null); setEditingField(null); }}
            onSection={(id) => { setFormSection(id); setEditingField(null); }}
            onEdit={setEditingField}
            onSaved={load}
          />
        ) : null}
        {section === "rules" ? <RulesPanel token={identity.token} bundle={bundle} onSaved={load} /> : null}
        {section === "system" ? <SystemStatus focus={systemFocus} /> : null}
      </AdminPage>
    </div>
  );
}

function Home({ bundle, onOpen, onSystem }: { bundle: Bundle; onOpen: (section: Section) => void; onSystem: (focus: SystemFocus) => void }) {
  const version = versionState(bundle.version, []);
  const groups: { title: string; items: { id: string; title: string; purpose: string; meta: string; open: () => void }[] }[] = [
    {
      title: "People & access",
      items: [
        { id: "users", title: "Users", purpose: "People who can request, authorize, receive, and supervise permits.", meta: bundle.users === null ? "Directory" : `${bundle.users} people`, open: () => onOpen("users") },
        { id: "roles", title: "Roles / Access", purpose: "Assign the roles that allow a person to act on a permit.", meta: "Role assignment", open: () => onOpen("roles") },
        { id: "qualifications", title: "Qualifications", purpose: "Specialty qualifications a rule can require before work proceeds.", meta: "Qualifications", open: () => onOpen("qualifications") },
        { id: "user-management", title: "User Management", purpose: "Create an account, require a PIN change, or clear a lockout.", meta: "Accounts", open: () => onOpen("users") },
      ],
    },
    {
      title: "Permit configuration",
      items: [
        { id: "types", title: "Permit Types", purpose: "The six system permit types and the modules each one carries.", meta: `${PERMIT_TYPE_PROFILES.length} system types`, open: () => onOpen("types") },
        ...["areas", "equipment", "contractors", "work-types", "templates", "hazards", "controls", "ppe"].map((id) => ({
          id,
          title: CATALOG_COPY[id].title,
          purpose: CATALOG_COPY[id].purpose,
          meta: `${(bundle.catalogs[id] ?? []).length} records`,
          open: () => onOpen(id as Section),
        })),
      ],
    },
    {
      title: "Form & workflow",
      items: [
        { id: "forms", title: "Form Designer", purpose: "Configure the information collected by each permit type.", meta: `${bundle.fields.length} fields · ${version.publishedLabel}`, open: () => onOpen("forms") },
        { id: "rules", title: "Rules", purpose: "Require a module, field, control, or qualification from a controlled answer.", meta: `${bundle.rules.length} rules`, open: () => onOpen("rules") },
      ],
    },
    {
      title: "System",
      items: [
        { id: "link", title: "Plant Link", purpose: "Whether this workstation can reach the plant record.", meta: "Connection", open: () => onSystem("link") },
        { id: "api", title: "API / Server", purpose: "Whether the Permit Control API process answered.", meta: "Service", open: () => onSystem("api") },
        { id: "database", title: "Database", purpose: "Whether the plant database is ready for permit work.", meta: "Readiness", open: () => onSystem("database") },
        { id: "sync", title: "Synchronization", purpose: "Local save state and the last successful plant synchronization.", meta: "Outbox", open: () => onSystem("sync") },
        { id: "diagnostics", title: "Diagnostics", purpose: "A short status reading. This screen does not run commands.", meta: "Status", open: () => onSystem("diagnostics") },
      ],
    },
  ];
  return (
    <div className="admin-home">
      {groups.map((group) => (
        <AdminSection key={group.title} title={group.title}>
          <div className="admin-destinations">
            {group.items.map((item) => (
              <button key={item.id} type="button" className="admin-destination" onClick={item.open}>
                <strong>{item.title}</strong>
                <span>{item.purpose}</span>
                <em>{item.meta}</em>
              </button>
            ))}
          </div>
        </AdminSection>
      ))}
    </div>
  );
}

function CatalogPanel({ catalog, token, rows, areas, onSaved }: { catalog: string; token: string | null; rows: CatalogItem[]; areas: CatalogItem[]; onSaved: () => Promise<void> }) {
  const copy = CATALOG_COPY[catalog];
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [restoreId, setRestoreId] = useState<string | null>(null);
  const visible = rows.filter((row) => `${row.name} ${row.code} ${row.detail ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()));
  const editing = editingId === "new" ? "new" : visible.find((row) => row.id === editingId) ?? rows.find((row) => row.id === editingId) ?? null;
  const index = typeof editing === "object" && editing ? visible.findIndex((row) => row.id === editing.id) : -1;
  return (
    <AdminSection title={copy.title} purpose={copy.purpose}>
      <p className="admin-inline-note">A referenced area, equipment item, or contractor is disabled rather than deleted, so historical permits keep their name.</p>
      <div className="admin-list-tools">
        <AdminField label="Search" width="standard">
          <input value={query} onChange={(event) => setQuery(event.target.value)} />
        </AdminField>
        <AdminButton variant="primary" onClick={() => { setRestoreId(null); setEditingId("new"); }}>Add {copy.title.replace(/s$/, "").toLowerCase()}</AdminButton>
      </div>
      {visible.length === 0 ? (
        <AdminEmptyState title="NOTHING CONFIGURED YET" action={<AdminButton variant="primary" onClick={() => setEditingId("new")}>Add {copy.title.replace(/s$/, "").toLowerCase()}</AdminButton>}>
          Add the first {copy.title.toLowerCase()} record for the plant.
        </AdminEmptyState>
      ) : (
        <div className="admin-list">
          {visible.map((row) => (
            <button key={row.id} type="button" id={`admin-catalog-${row.id}`} className="admin-row" onClick={() => { setRestoreId(`admin-catalog-${row.id}`); setEditingId(row.id); }}>
              <div>
                <strong>{row.name}</strong>
                <span>{row.code}</span>
                {row.detail ? <p>{row.detail}</p> : null}
              </div>
              <AdminStatus tone={row.enabled ? "ok" : "warn"}>{row.enabled ? "Enabled" : "Disabled"}</AdminStatus>
            </button>
          ))}
        </div>
      )}
      {editing ? (
        <CatalogEditor
          key={editing === "new" ? "new" : editing.id}
          catalog={catalog}
          token={token}
          row={editing === "new" ? null : editing}
          areas={areas}
          restoreId={restoreId}
          onPrevious={index > 0 ? () => setEditingId(visible[index - 1].id) : undefined}
          onNext={index >= 0 && index < visible.length - 1 ? () => setEditingId(visible[index + 1].id) : undefined}
          onClose={() => setEditingId(null)}
          onRefresh={onSaved}
          onSaved={async (id) => {
            setRestoreId(`admin-catalog-${id}`);
            setEditingId(null);
            await onSaved();
          }}
        />
      ) : null}
    </AdminSection>
  );
}

function CatalogEditor({
  catalog,
  token,
  row,
  areas,
  restoreId,
  onPrevious,
  onNext,
  onClose,
  onRefresh,
  onSaved,
}: {
  catalog: string;
  token: string | null;
  row: CatalogItem | null;
  areas: CatalogItem[];
  restoreId: string | null;
  onPrevious?: () => void;
  onNext?: () => void;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onSaved: (id: string) => Promise<void>;
}) {
  const { link } = useDevice();
  const copy = CATALOG_COPY[catalog];
  const [name, setName] = useState(row?.name ?? "");
  const [code, setCode] = useState(row?.code ?? (catalog === "templates" ? "GENERAL_WORK" : ""));
  const [detail, setDetail] = useState(row?.detail ?? "");
  const [parentId, setParentId] = useState(row?.parentId ?? "");
  const [enabled, setEnabled] = useState(row?.enabled ?? true);
  const [notice, setNotice] = useState<Notice>(null);
  const dirty = name !== (row?.name ?? "") || code !== (row?.code ?? (catalog === "templates" ? "GENERAL_WORK" : "")) || detail !== (row?.detail ?? "") || parentId !== (row?.parentId ?? "") || enabled !== (row?.enabled ?? true);
  const save = async (nextEnabled = enabled, close = true) => {
    if (!token) return;
    if (!name.trim()) {
      setNotice({ title: "CHANGE NOT SAVED", body: "Enter a name. Your changes remain in the editor." });
      return;
    }
    if (link.link !== "ready") {
      setNotice({ title: "PLANT LINK OFFLINE", body: "This change stays in the editor. Permit Control will save it to the plant record when Plant Link is ready." });
      return;
    }
    setNotice(null);
    try {
      const saved = await saveCatalog(token, catalog, { id: row?.id, code: code || name, name: name.trim(), detail, enabled: nextEnabled, displayOrder: row?.displayOrder ?? 0, parentId: parentId || null });
      if (close) {
        document.body.dataset.adminRestore = `admin-catalog-${saved.id}`;
        await onSaved(saved.id);
      } else {
        setEnabled(saved.enabled);
        await onRefresh();
      }
    } catch (error) {
      setNotice({ title: "CHANGE NOT SAVED", body: `${contextual(pinMessage(error), "Permit Control could not save this catalog change.")} Your changes remain in the editor.` });
    }
  };
  return (
    <AdminEditorModal
      title={row ? `Edit ${copy.title.replace(/s$/, "").toLowerCase()}` : `New ${copy.title.replace(/s$/, "").toLowerCase()}`}
      code={row?.code}
      subtitle={row?.name}
      subject={`this ${copy.title.replace(/s$/, "").toLowerCase()}`}
      dirty={dirty}
      primaryLabel={row ? "Save changes" : `Create ${copy.title.replace(/s$/, "").toLowerCase()}`}
      restoreId={row ? `admin-catalog-${row.id}` : restoreId}
      recordLabel={row?.code ?? "New"}
      onPrevious={onPrevious}
      onNext={onNext}
      onClose={onClose}
      onSave={() => void save()}
      error={notice ? <AdminError title={notice.title} onRetry={() => void save()}>{notice.body}</AdminError> : null}
    >
      <AdminFieldGroup>
        <AdminField label={copy.name} width="standard"><input value={name} onChange={(event) => setName(event.target.value)} /></AdminField>
        {catalog === "templates" ? (
          <AdminField label="Permit type" width="standard" help="Templates point at a system permit type. They do not create a new one.">
            <select value={code} onChange={(event) => setCode(event.target.value)}>
              {PERMIT_TYPE_PROFILES.map((item) => <option key={item.code} value={item.code}>{item.title}</option>)}
            </select>
          </AdminField>
        ) : (
          <AdminField label={copy.code} width="medium"><input value={code} onChange={(event) => setCode(event.target.value)} /></AdminField>
        )}
        <AdminField label={copy.detail} width="wide"><input value={detail} onChange={(event) => setDetail(event.target.value)} /></AdminField>
        {catalog === "equipment" ? (
          <AdminField label="Area" width="standard" help="The area this equipment belongs to.">
            <select value={parentId} onChange={(event) => setParentId(event.target.value)}>
              <option value="">No area selected</option>
              {areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
            </select>
          </AdminField>
        ) : null}
      </AdminFieldGroup>
      {row ? (
        <AdminToolbar>
          <AdminButton variant="danger" onClick={() => void save(!enabled, false)}>{enabled ? "Disable" : "Enable"}</AdminButton>
        </AdminToolbar>
      ) : null}
    </AdminEditorModal>
  );
}

function PermitTypeList({ bundle, onOpen, onConfigure }: { bundle: Bundle; onOpen: (code: string) => void; onConfigure: (code: string) => void }) {
  const versions = versionState(bundle.version, bundle.fields.map((field) => field.configurationVersion));
  return (
    <AdminSection title="System permit types" purpose="These six types are the Permit Control identity. Administration can inspect and configure them. It cannot rename or delete the system code.">
      <div className="admin-type-list">
        {PERMIT_TYPE_PROFILES.map((profile) => {
          const server = bundle.types.find((item) => item.code === profile.code);
          const required = parseModuleCodes(server?.modules ?? "");
          const fields = bundle.fields.filter((field) => field.permitType === profile.code);
          const rules = rulesForPermitType(bundle.rules, profile.code, [...required, ...profile.conditional]);
          return (
            <article key={profile.code} className="admin-type-card">
              <div>
                <h3>{profile.title}</h3>
                <p>{profile.description}</p>
              </div>
              <dl>
                <div><dt>System code</dt><dd>{profile.code}</dd></div>
                <div><dt>Status</dt><dd>System · Enabled</dd></div>
                <div><dt>Published configuration</dt><dd>{versions.publishedLabel}</dd></div>
                <div><dt>Required modules</dt><dd>{required.length}</dd></div>
                <div><dt>Conditional modules</dt><dd>{profile.conditional.length}</dd></div>
                <div><dt>Related rules</dt><dd>{rules}</dd></div>
                <div><dt>Configured fields</dt><dd>{fields.length}</dd></div>
              </dl>
              <AdminToolbar>
                <button type="button" className="btn" onClick={() => onOpen(profile.code)}>View configuration</button>
                <button type="button" className="btn" onClick={() => onConfigure(profile.code)}>Configure</button>
              </AdminToolbar>
            </article>
          );
        })}
      </div>
    </AdminSection>
  );
}

function PermitTypeDetail({ code, bundle, onConfigure }: { code: string; bundle: Bundle; onConfigure: () => void }) {
  const profile = permitTypeProfile(code);
  const server = bundle.types.find((item) => item.code === code);
  const required = parseModuleCodes(server?.modules ?? "");
  const versions = versionState(bundle.version, bundle.fields.filter((field) => field.permitType === code).map((field) => field.configurationVersion));
  const templates = (bundle.catalogs.templates ?? []).filter((item) => item.code === code);
  const rules = bundle.rules.filter((rule) => rulesForPermitType([rule], code, [...required, ...profile.conditional]) > 0);
  return (
    <>
      <AdminSection title={profile.title} purpose={profile.description}>
        <dl className="admin-facts">
          <div><dt>Permit type</dt><dd>{profile.title}</dd></div>
          <div><dt>System code</dt><dd>{profile.code}</dd></div>
          <div><dt>Published configuration</dt><dd>{versions.publishedLabel}</dd></div>
          <div><dt>Working version</dt><dd>{versions.workingLabel}</dd></div>
          <div><dt>Status</dt><dd>System type · Enabled</dd></div>
        </dl>
        <p className="admin-inline-note">The system code stays fixed so existing permits, rules, and documents keep the same identity.</p>
      </AdminSection>
      <AdminSection title="Required modules" purpose="These modules are part of this permit type.">
        <ul className="admin-pills">{required.map((item) => <li key={item}>{moduleTitle(item)} <span>{item}</span></li>)}</ul>
      </AdminSection>
      <AdminSection title="Conditional modules" purpose="These modules are added when the work scope calls for them.">
        {profile.conditional.length === 0 ? <p className="admin-inline-note">No additional conditional module is defined for this type.</p> : (
          <ul className="admin-pills">{profile.conditional.map((item) => <li key={item}>{moduleTitle(item)} <span>{item}</span></li>)}</ul>
        )}
      </AdminSection>
      <AdminSection title="Form configuration" purpose="Fields configured for this permit type.">
        <p className="admin-inline-note">{bundle.fields.filter((field) => field.permitType === code).length} configured fields. Published configuration: {versions.publishedLabel}.</p>
        <button type="button" className="btn" onClick={onConfigure}>Open Form Designer</button>
      </AdminSection>
      <AdminSection title="Rules" purpose="Rules whose target or condition names this permit type or one of its modules.">
        {rules.length === 0 ? <AdminEmptyState title="NO RELATED RULES">Plant-wide rules still apply. Create one from Rules when an answer should change this permit type.</AdminEmptyState> : rules.map((rule) => <p key={rule.id} className="admin-statement">{ruleSentence(rule, bundle.fields)}</p>)}
      </AdminSection>
      <AdminSection title="Templates" purpose="Templates that start from this permit type.">
        {templates.length === 0 ? <p className="admin-inline-note">No template is saved for this permit type.</p> : templates.map((item) => <p key={item.id}>{item.name}</p>)}
      </AdminSection>
    </>
  );
}

function FormDesigner({
  token,
  bundle,
  permitType,
  sectionId,
  editing,
  onType,
  onSection,
  onEdit,
  onSaved,
}: {
  token: string | null;
  bundle: Bundle;
  permitType: string;
  sectionId: FormSectionId | null;
  editing: string | null;
  onType: (code: string) => void;
  onSection: (id: FormSectionId) => void;
  onEdit: (fieldId: string | null) => void;
  onSaved: () => Promise<void>;
}) {
  const fields = bundle.fields.filter((field) => field.permitType === permitType);
  const versions = versionState(bundle.version, fields.map((field) => field.configurationVersion).concat(bundle.rules.map((rule) => rule.configurationVersion)));
  const [preview, setPreview] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const profile = permitTypeProfile(permitType);
  return (
    <>
      <AdminSection title="Configuration" purpose="Configure the information collected by each permit type. Historical permits remain on the version they were submitted against.">
        <AdminFieldGroup>
          <AdminField label="Permit type" width="standard">
            <select value={permitType} onChange={(event) => onType(event.target.value)}>
              {PERMIT_TYPE_PROFILES.map((item) => <option key={item.code} value={item.code}>{item.title}</option>)}
            </select>
          </AdminField>
        </AdminFieldGroup>
        <div className="admin-versions">
          <div><span>Published version</span><strong>{versions.publishedLabel}</strong></div>
          <div><span>Working version</span><strong>{versions.workingLabel}</strong></div>
        </div>
        <p className="admin-inline-note">Publishing creates a new immutable version for future permit work. Permits already submitted stay on their existing version.</p>
        <AdminToolbar>
          <AdminButton variant="secondary" onClick={() => { setPreview((value) => !value); setPublishing(false); }}>{preview ? "Close preview" : "Preview"}</AdminButton>
          <AdminButton variant="primary" onClick={() => { setPublishing(true); setPreview(false); }}>Publish</AdminButton>
        </AdminToolbar>
      </AdminSection>
      {preview ? <FormPreview permitTitle={profile.title} fields={fields} /> : null}
      {publishing ? <PublishReview token={token} bundle={bundle} permitTitle={profile.title} onClose={() => setPublishing(false)} onSaved={onSaved} /> : null}
      {!sectionId ? (
        <AdminSection title="Workflow sections" purpose={`${profile.title} collects information in the same six steps used on the permit.`}>
          <div className="admin-sections">
            {FORM_SECTIONS.map((section) => {
              const rows = fieldsInSection(fields, section.id);
              const choices = choiceCount(rows);
              return (
                <article key={section.id}>
                  <div>
                    <span>{section.number}</span>
                    <strong>{section.title}</strong>
                    <em>{rows.length === 0 ? "No fields configured" : `${rows.length} fields`}{choices ? ` · ${choices} choices` : ""}</em>
                  </div>
                  <AdminButton variant="secondary" onClick={() => onSection(section.id)}>Edit</AdminButton>
                </article>
              );
            })}
          </div>
        </AdminSection>
      ) : (
        <SectionEditor fields={fieldsInSection(fields, sectionId)} onAdd={() => onEdit("new")} onEdit={onEdit} />
      )}
      {editing !== null && sectionId ? (
        <FieldEditor token={token} permitType={permitType} sectionId={sectionId} published={bundle.version} fields={fieldsInSection(fields, sectionId)} initialId={editing === "new" ? "" : editing} onNavigate={onEdit} onClose={() => onEdit(null)} onRefresh={onSaved} />
      ) : null}
    </>
  );
}

function FormPreview({ permitTitle, fields }: { permitTitle: string; fields: FieldRecord[] }) {
  return (
    <AdminSection title={`${permitTitle} preview`} purpose="The labels an administrator has configured. This is not a live permit.">
      {FORM_SECTIONS.map((section) => {
        const rows = fieldsInSection(fields, section.id);
        return (
          <div key={section.id} className="admin-preview-block">
            <h3>{section.number} {section.title}</h3>
            {rows.length === 0 ? <p>No fields configured.</p> : rows.map((field) => <p key={field.id}>{field.label} <span>{fieldTypeLabel(field.fieldType)}{field.required ? " · Required" : ""}</span></p>)}
          </div>
        );
      })}
    </AdminSection>
  );
}

function SectionEditor({ fields, onAdd, onEdit }: { fields: FieldRecord[]; onAdd: () => void; onEdit: (id: string) => void }) {
  return (
    <AdminSection title="Fields in this section">
      {fields.length === 0 ? (
        <AdminEmptyState title="NO FIELDS CONFIGURED" action={<AdminButton variant="primary" id="admin-add-field" onClick={onAdd}>Add field</AdminButton>}>
          Add the first field to this section.
        </AdminEmptyState>
      ) : (
        <>
          <div className="admin-list">
            {fields.map((field) => (
              <article key={field.id} className="admin-row">
                <div>
                  <strong>{field.label}</strong>
                  <span>{fieldTypeLabel(field.fieldType)} · {field.choices.length} choices</span>
                </div>
                <AdminStatus tone={field.enabled ? "ok" : "warn"}>{field.required ? "Required" : "Optional"}</AdminStatus>
                <AdminButton variant="secondary" id={`admin-field-${field.id}`} onClick={() => onEdit(field.id)}>Edit</AdminButton>
              </article>
            ))}
          </div>
          <AdminToolbar><AdminButton variant="primary" id="admin-add-field" onClick={onAdd}>Add field</AdminButton></AdminToolbar>
        </>
      )}
    </AdminSection>
  );
}

function FieldEditor({ token, permitType, sectionId, published, fields, initialId, onNavigate, onClose, onRefresh }: { token: string | null; permitType: string; sectionId: FormSectionId; published: number; fields: FieldRecord[]; initialId: string; onNavigate: (fieldId: string | null) => void; onClose: () => void; onRefresh: () => Promise<void> }) {
  const { link } = useDevice();
  const starting = fields.find((field) => field.id === initialId);
  const [selected, setSelected] = useState(starting?.id ?? "");
  const current = fields.find((field) => field.id === selected);
  const [label, setLabel] = useState(starting?.label ?? "");
  const [fieldType, setFieldType] = useState(starting?.fieldType ?? "TEXT");
  const [helpText, setHelpText] = useState(starting?.helpText ?? "");
  const [required, setRequired] = useState(starting?.required ?? false);
  const [section, setSection] = useState(sectionId);
  const [position, setPosition] = useState(starting ? sectionPosition(starting.displayOrder) : fields.length);
  const [enabled, setEnabled] = useState(starting?.enabled ?? true);
  const [code, setCode] = useState(starting?.code ?? "");
  const [choice, setChoice] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const choose = (id: string) => {
    if (!id || id === "new") {
      setSelected("");
      setLabel("");
      setFieldType("TEXT");
      setHelpText("");
      setRequired(false);
      setSection(sectionId);
      setPosition(fields.length);
      setEnabled(true);
      setCode("");
      setNotice(null);
      return;
    }
    const field = fields.find((item) => item.id === id);
    setSelected(id);
    setLabel(field?.label ?? "");
    setFieldType(field?.fieldType ?? "TEXT");
    setHelpText(field?.helpText ?? "");
    setRequired(field?.required ?? false);
    setSection(field ? sectionForOrder(field.displayOrder).id : sectionId);
    setPosition(field ? sectionPosition(field.displayOrder) : fields.length);
    setEnabled(field?.enabled ?? true);
    setCode(field?.code ?? "");
    setNotice(null);
  };
  const [seenId, setSeenId] = useState(initialId);
  if (seenId !== initialId) {
    setSeenId(initialId);
    choose(initialId || "new");
  }
  const save = async () => {
    if (!token) return;
    if (link.link !== "ready") {
      setNotice({ title: "PLANT LINK OFFLINE", body: "This field is still on the screen. Permit Control will save it when Plant Link is ready." });
      return;
    }
    const nextCode = code || suggestFieldCode(label);
    if (!label.trim() || !nextCode) {
      setNotice({ title: "FIELD NOT SAVED", body: "Enter a field label. Permit Control uses it to build the field code." });
      return;
    }
    setNotice(null);
    try {
      const saved = await saveField(token, {
        id: current?.id ?? null,
        permitType,
        code: nextCode,
        label: label.trim(),
        helpText: helpText.trim() || null,
        fieldType,
        required,
        displayOrder: displayOrder(section, position),
        enabled,
      });
      setSelected(saved.id);
      setCode(saved.code);
      document.body.dataset.adminRestore = `admin-field-${saved.id}`;
      await onRefresh();
      onClose();
    } catch (error) {
      setNotice({ title: "FIELD NOT SAVED", body: `${contextual(pinMessage(error), "Permit Control could not save this field.")} Your changes remain in the editor.` });
    }
  };
  const addChoice = async () => {
    if (!token || !current) {
      setNotice({ title: "CHOICE NOT SAVED", body: "Save the field before adding a choice." });
      return;
    }
    if (current.configurationVersion <= published) {
      setNotice({ title: "CHOICE NOT SAVED", body: "Save the field first. A published field is copied into the working version before its choices can change." });
      return;
    }
    if (link.link !== "ready") {
      setNotice({ title: "PLANT LINK OFFLINE", body: "The choice is still in the box. It will save when Plant Link is ready." });
      return;
    }
    const choiceCode = suggestFieldCode(choice);
    if (!choiceCode) {
      setNotice({ title: "CHOICE NOT SAVED", body: "Enter the choice as the person completing the permit should read it." });
      return;
    }
    try {
      await saveChoice(token, { fieldId: current.id, code: choiceCode, label: choice.trim(), displayOrder: current.choices.length, enabled: true });
      setChoice("");
      await onRefresh();
    } catch (error) {
      setNotice({ title: "CHOICE NOT SAVED", body: contextual(pinMessage(error), "Permit Control could not save this choice.") });
    }
  };
  const needsChoices = fieldType === "SINGLE_SELECT" || fieldType === "MULTI_SELECT";
  const origin = starting ?? null;
  const dirty = label !== (origin?.label ?? "") || fieldType !== (origin?.fieldType ?? "TEXT") || helpText !== (origin?.helpText ?? "") || required !== (origin?.required ?? false) || section !== (origin ? sectionForOrder(origin.displayOrder).id : sectionId) || position !== (origin ? sectionPosition(origin.displayOrder) : fields.length) || enabled !== (origin?.enabled ?? true) || code !== (origin?.code ?? "") || choice !== "";
  const index = fields.findIndex((field) => field.id === (selected || initialId));
  return (
    <AdminEditorModal
      title={current ? "Edit field" : "New field"}
      code={current?.code}
      subtitle={current?.label ?? "Add a field to this section."}
      subject="this field"
      wide
      dirty={dirty}
      primaryLabel={current ? "Save changes" : "Create field"}
      restoreId={current ? `admin-field-${current.id}` : "admin-add-field"}
      recordLabel={current?.label ?? "New field"}
      onPrevious={index > 0 ? () => onNavigate(fields[index - 1].id) : undefined}
      onNext={index >= 0 && index < fields.length - 1 ? () => onNavigate(fields[index + 1].id) : undefined}
      onClose={onClose}
      onSave={() => void save()}
      error={notice ? <AdminError title={notice.title} onRetry={() => void save()}>{notice.body}</AdminError> : null}
    >
      <h3 className="admin-subhead">Basic information</h3>
      <AdminFieldGroup>
        <AdminField label="Field label" width="standard"><input value={label} onChange={(event) => setLabel(event.target.value)} /></AdminField>
        <AdminField label="Field type" width="standard">
          <select value={fieldType} onChange={(event) => setFieldType(event.target.value)}>
            {Object.entries({ TEXT: "Single-line Text", MULTILINE_TEXT: "Long Text", YES_NO: "Yes / No", SINGLE_SELECT: "Single Choice", MULTI_SELECT: "Multiple Choice", NUMBER: "Whole Number", DECIMAL: "Decimal Number", DATE: "Date", TIME: "Time", DATETIME: "Date & Time" }).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
          </select>
        </AdminField>
        <AdminField label="Help text" width="wide" help="Shown with the field so the person completing the permit knows what to enter.">
          <textarea value={helpText} onChange={(event) => setHelpText(event.target.value)} />
        </AdminField>
      </AdminFieldGroup>
      <h3 className="admin-subhead">Behavior</h3>
      <AdminFieldGroup>
        <AdminField label="Required" width="small"><input type="checkbox" checked={required} onChange={(event) => setRequired(event.target.checked)} /></AdminField>
        <AdminField label="Section" width="standard" help="The section is stored with the field order. Scope uses 0-99, and each following section uses the next hundred.">
          <select value={section} onChange={(event) => setSection(event.target.value as FormSectionId)}>
            {FORM_SECTIONS.map((item) => <option key={item.id} value={item.id}>{item.number} {item.title}</option>)}
          </select>
        </AdminField>
        <AdminField label="Display order" width="small" help="Position inside this section.">
          <input type="text" inputMode="numeric" value={String(position)} onChange={(event) => setPosition(Number(event.target.value) || 0)} />
        </AdminField>
        <AdminField label="Enabled" width="small"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /></AdminField>
      </AdminFieldGroup>
      {needsChoices ? (
        <>
          <h3 className="admin-subhead">Choices</h3>
          {current && current.choices.length > 0 ? <ul className="admin-pills">{current.choices.map((item) => <li key={item.id}>{item.label}</li>)}</ul> : <p className="admin-inline-note">No choices yet.</p>}
          <AdminFieldGroup>
            <AdminField label="Choice label" width="standard"><input value={choice} onChange={(event) => setChoice(event.target.value)} /></AdminField>
          </AdminFieldGroup>
          <AdminToolbar><AdminButton variant="secondary" onClick={() => void addChoice()}>Add choice</AdminButton></AdminToolbar>
        </>
      ) : null}
      <details className="admin-advanced">
        <summary>System / advanced</summary>
        <AdminFieldGroup>
          <AdminField label="Field code" width="medium" help="Leave blank to build a code from the label. Published permits keep the code they were submitted with.">
            <input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} />
          </AdminField>
          <AdminField label="Configuration version" width="small">
            <input value={current ? String(current.configurationVersion) : "New"} readOnly />
          </AdminField>
        </AdminFieldGroup>
      </details>
      {current ? <p className="admin-inline-note">Saving an existing field updates its label and whether it is required. A new field also stores the type, help text, section order, and enabled state.</p> : null}
    </AdminEditorModal>
  );
}

function PublishReview({ token, bundle, permitTitle, onClose, onSaved }: { token: string | null; bundle: Bundle; permitTitle: string; onClose: () => void; onSaved: () => Promise<void> }) {
  const { link } = useDevice();
  const [pin, setPin] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const changes = configurationChanges(bundle.fields, bundle.rules, bundle.version);
  const versions = versionState(bundle.version, bundle.fields.map((field) => field.configurationVersion).concat(bundle.rules.map((rule) => rule.configurationVersion)));
  const publish = async () => {
    if (!token) return;
    if (link.link !== "ready") {
      setNotice({ title: "PLANT LINK OFFLINE", body: "Publishing waits for Plant Link. The working configuration is still here." });
      return;
    }
    setNotice(null);
    try {
      await publishForm(token, pin);
      setPin("");
      await onSaved();
      onClose();
    } catch (error) {
      setPin("");
      setNotice({ title: "CONFIGURATION NOT PUBLISHED", body: `${contextual(pinMessage(error), "Permit Control could not publish this configuration.")} Your unsaved configuration has been preserved.` });
    }
  };
  return (
    <AdminEditorModal
      title={`Publish ${permitTitle} configuration`}
      subtitle="Publishing is for the whole plant form configuration. Historical permits stay on their existing versions."
      subject="this publication"
      dirty={pin.length > 0}
      primaryLabel="Publish version"
      onClose={() => { setPin(""); onClose(); }}
      onSave={() => void publish()}
      error={notice ? <AdminError title={notice.title} onRetry={() => void publish()}>{notice.body}</AdminError> : null}
    >
      <dl className="admin-facts">
        <div><dt>Current published version</dt><dd>{versions.published > 0 ? versions.published : "No published configuration yet"}</dd></div>
        <div><dt>New version</dt><dd>{versions.working ?? bundle.version + 1}</dd></div>
      </dl>
      <ul className="admin-change-list">
        <li>{changes.added} fields added</li>
        <li>{changes.updated} fields updated</li>
        <li>{changes.changedRules} rules changed</li>
      </ul>
      <p className="admin-inline-note">Historical permits will remain on their existing versions.</p>
      <AdminField label="PIN" width="small" help="The administrator PIN confirms this publication.">
        <PinInput purpose="current" value={pin} onChange={setPin} />
      </AdminField>
    </AdminEditorModal>
  );
}

function RulesPanel({ token, bundle, onSaved }: { token: string | null; bundle: Bundle; onSaved: () => Promise<void> }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const index = bundle.rules.findIndex((rule) => rule.id === editingId);
  const seed = editingId === "new" ? null : bundle.rules.find((rule) => rule.id === editingId) ?? null;
  return (
    <AdminSection title="Automation rules" purpose="A rule is a controlled when/then statement. It cannot contain JavaScript, SQL, HTML, or an arbitrary expression.">
      {bundle.rules.length === 0 ? (
        <AdminEmptyState title="NO AUTOMATION RULES" action={<AdminButton variant="primary" id="admin-create-rule" onClick={() => setEditingId("new")}>Create rule</AdminButton>}>
          Rules can automatically require modules, fields, controls, or other permit configuration based on controlled permit responses.
        </AdminEmptyState>
      ) : (
        <div className="admin-list">
          {bundle.rules.map((rule) => (
            <button key={rule.id} type="button" id={`admin-rule-${rule.id}`} className="admin-rule" onClick={() => setEditingId(rule.id)}>
              <p>{ruleSentence(rule, bundle.fields)}</p>
              <span>Plant configuration · {rule.configurationVersion > 0 ? `Version ${rule.configurationVersion}` : "Working version"} · {rule.enabled ? "Enabled" : "Disabled"}</span>
            </button>
          ))}
        </div>
      )}
      {bundle.rules.length > 0 ? <AdminToolbar><AdminButton variant="primary" id="admin-create-rule" onClick={() => setEditingId("new")}>Create rule</AdminButton></AdminToolbar> : null}
      {editingId ? (
        <RuleEditor
          key={editingId}
          token={token}
          bundle={bundle}
          seed={seed}
          restoreId={seed ? `admin-rule-${seed.id}` : "admin-create-rule"}
          onPrevious={index > 0 ? () => setEditingId(bundle.rules[index - 1].id) : undefined}
          onNext={index >= 0 && index < bundle.rules.length - 1 ? () => setEditingId(bundle.rules[index + 1].id) : undefined}
          onClose={() => setEditingId(null)}
          onSaved={async () => { setEditingId(null); await onSaved(); }}
        />
      ) : null}
    </AdminSection>
  );
}

function RuleEditor({
  token,
  bundle,
  seed,
  restoreId,
  onPrevious,
  onNext,
  onClose,
  onSaved,
}: {
  token: string | null;
  bundle: Bundle;
  seed: RuleRecord | null;
  restoreId: string;
  onPrevious?: () => void;
  onNext?: () => void;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { link } = useDevice();
  const [conditionCode, setConditionCode] = useState(seed?.conditionCode ?? bundle.fields[0]?.code ?? "");
  const [conditionValue, setConditionValue] = useState(seed?.conditionValue ?? "YES");
  const [action, setAction] = useState(seed?.action ?? "REQUIRE_MODULE");
  const [target, setTarget] = useState(seed?.actionTarget ?? "HOT_WORK");
  const [pin, setPin] = useState("");
  useEffect(() => {
    setPin("");
  }, [seed?.id]);
  const [notice, setNotice] = useState<Notice>(null);
  const field = bundle.fields.find((item) => item.code === conditionCode);
  const dirty = conditionCode !== (seed?.conditionCode ?? bundle.fields[0]?.code ?? "") || conditionValue !== (seed?.conditionValue ?? "YES") || action !== (seed?.action ?? "REQUIRE_MODULE") || target !== (seed?.actionTarget ?? "HOT_WORK") || pin.length > 0;
  const save = async () => {
    if (!token) return;
    if (!conditionCode || !target) {
      setNotice({ title: "RULE NOT SAVED", body: "Choose the field, the answer, the action, and the target. Rules cannot contain a free expression. Your changes remain in the editor." });
      return;
    }
    if (link.link !== "ready") {
      setNotice({ title: "PLANT LINK OFFLINE", body: "This rule is still in the editor. It will be saved when Plant Link is ready." });
      return;
    }
    setNotice(null);
    try {
      await saveRule(token, { conditionCode, conditionValue, action, actionTarget: target, enabled: true }, pin);
      setPin("");
      await onSaved();
    } catch (error) {
      setPin("");
      setNotice({ title: "RULE NOT SAVED", body: `${contextual(pinMessage(error), "Permit Control could not save this rule.")} The statement is still in the editor.` });
    }
  };
  const targets = ruleTargets(action, bundle);
  return (
    <AdminEditorModal
      title={seed ? "Edit rule" : "New rule"}
      subtitle="Saving adds a working-version rule. The published rule is left in place."
      subject="this rule"
      wide
      dirty={dirty}
      primaryLabel={seed ? "Save rule" : "Create rule"}
      restoreId={restoreId}
      recordLabel={seed ? `Version ${seed.configurationVersion}` : "New rule"}
      onPrevious={onPrevious}
      onNext={onNext}
      onClose={() => { setPin(""); onClose(); }}
      onSave={() => void save()}
      error={notice ? <AdminError title={notice.title} onRetry={() => void save()}>{notice.body}</AdminError> : null}
    >
      <h3 className="admin-subhead">When</h3>
      <AdminFieldGroup>
        <AdminField label="Field" width="standard">
          <select value={conditionCode} onChange={(event) => setConditionCode(event.target.value)}>
            {bundle.fields.length === 0 ? <option value="">No configured field</option> : null}
            {bundle.fields.map((item) => <option key={item.id} value={item.code}>{item.label}</option>)}
          </select>
        </AdminField>
        <AdminField label="Condition" width="small" help="The plant record compares the answer for equality.">
          <select value="is"><option value="is">is</option></select>
        </AdminField>
        <AdminField label="Value" width="medium">
          {field?.fieldType === "YES_NO" || field?.choices.length ? (
            <select value={conditionValue} onChange={(event) => setConditionValue(event.target.value)}>
              {(field.fieldType === "YES_NO" ? [{ code: "YES", label: "Yes" }, { code: "NO", label: "No" }] : field.choices).map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
            </select>
          ) : <input value={conditionValue} onChange={(event) => setConditionValue(event.target.value)} />}
        </AdminField>
      </AdminFieldGroup>
      <h3 className="admin-subhead">Then</h3>
      <AdminFieldGroup>
        <AdminField label="Action" width="standard">
          <select value={action} onChange={(event) => { setAction(event.target.value); setTarget(ruleTargets(event.target.value, bundle)[0]?.code ?? ""); }}>
            {RULE_ACTIONS.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
          </select>
        </AdminField>
        <AdminField label="Target" width="standard">
          <select value={target} onChange={(event) => setTarget(event.target.value)}>
            {targets.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
          </select>
        </AdminField>
      </AdminFieldGroup>
      <p className="admin-statement">{conditionCode && target ? ruleSentence({ conditionCode, conditionValue, action, actionTarget: target }, bundle.fields) : "Choose a field and a target to preview the rule."}</p>
      <details className="admin-advanced">
        <summary>Advanced</summary>
        <p>{conditionCode || "FIELD"} is {displayValue(conditionValue)} → {actionPhrase(action, target, bundle.fields)} ({target || "TARGET"})</p>
      </details>
      <AdminField label="PIN" width="small" help="Saving a rule confirms with the administrator PIN and adds it to the working version.">
        <PinInput purpose="current" value={pin} onChange={setPin} />
      </AdminField>
    </AdminEditorModal>
  );
}

function SystemStatus({ focus }: { focus: SystemFocus }) {
  const { link, local } = useDevice();
  useEffect(() => {
    document.getElementById(`admin-${focus}`)?.scrollIntoView({ block: "start" });
  }, [focus]);
  const ready = link.link === "ready";
  const rows = safeDiagnostic([
    { label: "Plant Link", value: ready ? "CONNECTED" : link.link === "api-online" ? "NOT READY" : "OFFLINE" },
    { label: "API", value: link.link === "unreachable" ? "OFFLINE" : "ONLINE" },
    { label: "Database", value: ready ? "READY" : "NOT READY" },
    { label: "Last plant contact", value: local.status === "available" ? local.lastPlantContactAt ?? "No contact yet" : "Unavailable" },
    { label: "Last reference sync", value: local.status === "available" ? local.lastReferenceSyncAt ?? "No reference sync yet" : "Unavailable" },
    { label: "Last permit sync", value: local.status === "available" ? local.lastPermitSyncAt ?? "No permit sync yet" : "Unavailable" },
    { label: "Local data", value: local.status === "available" ? "AVAILABLE" : local.status === "failed" ? "UNAVAILABLE" : "CHECKING" },
    { label: "Pending changes", value: local.status === "available" ? String(local.pendingCount) : "Unavailable" },
    { label: "App version", value: "0.0.0" },
  ]);
  const value = (label: string) => rows.find((row) => row.label === label)?.value ?? "—";
  return (
    <>
      <AdminSection title="Plant Link" purpose="The only connection that can synchronize permits. General internet access is not Plant Link.">
        <p id="admin-link" className={focus === "link" ? "admin-focus" : undefined}><strong>{value("Plant Link")}</strong></p>
      </AdminSection>
      <AdminSection title="API / Server" purpose="Whether the Permit Control API process answered the last check.">
        <p id="admin-api"><strong>{value("API")}</strong></p>
      </AdminSection>
      <AdminSection title="Database" purpose="Whether the plant database accepted a readiness check.">
        <p id="admin-database"><strong>{value("Database")}</strong></p>
      </AdminSection>
      <AdminSection title="Synchronization" purpose="Local permit data remains available when the plant record cannot be reached.">
        <dl className="admin-facts" id="admin-sync">
          <div><dt>Last plant contact</dt><dd>{value("Last plant contact")}</dd></div>
          <div><dt>Last reference sync</dt><dd>{value("Last reference sync")}</dd></div>
          <div><dt>Last permit sync</dt><dd>{value("Last permit sync")}</dd></div>
          <div><dt>Pending changes</dt><dd>{value("Pending changes")}</dd></div>
        </dl>
      </AdminSection>
      <AdminSection title="Diagnostics" purpose="Status only. Administration does not run SQL or shell commands from this page.">
        <dl className="admin-facts" id="admin-diagnostics">
          <div><dt>Local data</dt><dd>{value("Local data")}</dd></div>
          <div><dt>App version</dt><dd>{value("App version")}</dd></div>
        </dl>
      </AdminSection>
    </>
  );
}

function ruleTargets(action: string, bundle: Bundle): { code: string; label: string }[] {
  if (action === "REQUIRE_MODULE") return MODULES.map((code) => ({ code, label: moduleTitle(code) }));
  if (action === "SHOW_FIELD" || action === "REQUIRE_FIELD") return bundle.fields.map((field) => ({ code: field.code, label: field.label }));
  if (action === "REQUIRE_QUALIFICATION") return QUALIFICATIONS.map((code) => ({ code, label: code.replaceAll("_", " ").toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase()) }));
  if (action === "REQUIRE_CONTROL") return (bundle.catalogs.controls ?? []).map((item) => ({ code: item.code, label: item.name }));
  return (bundle.catalogs.ppe ?? []).map((item) => ({ code: item.code, label: item.name }));
}

function pageTitle(section: Section, typeCode: string | null, formSection: FormSectionId | null, editing: boolean): string {
  if (section === "home") return "Administration";
  if (section === "types" && typeCode) return permitTypeProfile(typeCode).title;
  if (section === "types") return "Permit Types";
  if (section === "forms" && editing) return "Field";
  if (section === "forms" && formSection) return FORM_SECTIONS.find((item) => item.id === formSection)?.title ?? "Form Designer";
  if (section === "forms") return "Form Designer";
  if (section === "rules") return "Rules";
  if (section === "system") return "System";
  if (section === "roles") return "Roles / Access";
  if (section === "qualifications") return "Qualifications";
  if (section === "users") return "Users";
  return CATALOG_COPY[section]?.title ?? "Administration";
}

function groupName(section: Section): string | null {
  if (section === "home") return null;
  if (section === "users" || section === "roles" || section === "qualifications") return "People & access";
  if (section === "forms" || section === "rules") return "Form & workflow";
  if (section === "system") return "System";
  return "Permit configuration";
}

function pagePurpose(section: Section, typeCode: string | null, formSection: FormSectionId | null, editing: boolean): string {
  if (section === "home") return "Configure the people, permit types, forms, and rules used by Permit Control.";
  if (section === "forms" && editing) return "Edit one field without leaving the permit type and section you opened.";
  if (section === "forms" && formSection) return "Fields collected in this step of the permit.";
  if (section === "forms") return "Configure the fields, choices, and workflow information collected by Permit Control.";
  if (section === "types" && typeCode) return permitTypeProfile(typeCode).description;
  if (section === "types") return "Review the six system permit types and open the configuration for each one.";
  if (section === "rules") return "State what Permit Control should require when a controlled answer is given.";
  if (section === "system") return "Read Plant Link, the API, the database, and synchronization without leaving Permit Control.";
  if (CATALOGS.has(section)) return CATALOG_COPY[section].purpose;
  if (section === "roles") return "Assign the roles that allow each person to act.";
  if (section === "qualifications") return "Record specialty qualifications used by permit rules.";
  return "Manage Permit Control identities, access, and qualifications.";
}

function breadcrumbs(section: Section, typeCode: string | null, formType: string, formSection: FormSectionId | null) {
  const items: { id: string; label: string; inert?: boolean }[] = [{ id: "home", label: "Administration" }];
  if (section === "home") return items;
  const group = groupName(section);
  if (group) items.push({ id: `group:${section}`, label: group, inert: true });
  items.push({ id: section, label: pageTitle(section, null, null, false) });
  if (section === "types" && typeCode) items.push({ id: `type:${typeCode}`, label: permitTypeProfile(typeCode).title });
  if (section === "forms") {
    items.push({ id: `form:${formType}`, label: permitTypeProfile(formType).title });
    if (formSection) items.push({ id: `section:${formSection}`, label: FORM_SECTIONS.find((item) => item.id === formSection)?.title ?? "Section" });
  }
  return items;
}

function followCrumb(
  id: string,
  open: (section: Section) => void,
  setTypeCode: (code: string | null) => void,
  setFormType: (code: string) => void,
  setFormSection: (id: FormSectionId | null) => void,
  setEditingField: (fieldId: string | null) => void,
  setSection: (section: Section) => void,
) {
  if (id === "home") {
    open("home");
    return;
  }
  if (id.startsWith("type:")) {
    setSection("types");
    setTypeCode(id.slice(5));
    return;
  }
  if (id.startsWith("form:")) {
    setSection("forms");
    setFormType(id.slice(5));
    setFormSection(null);
    setEditingField(null);
    return;
  }
  if (id.startsWith("section:")) {
    setSection("forms");
    setFormSection(id.slice(8) as FormSectionId);
    setEditingField(null);
    return;
  }
  open(id as Section);
}

function contextual(message: string, fallback: string): string {
  if (!message || message === "Permit Control could not complete that action.") return fallback;
  return message;
}
