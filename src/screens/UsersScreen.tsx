import { useEffect, useState } from "react";
import {
  AdminButton,
  AdminEditorModal,
  AdminEmptyState,
  AdminError,
  AdminField,
  AdminFieldGroup,
  AdminStatus,
} from "../components/admin";
import { ScreenHead } from "../components/ui";
import { useIdentity } from "../services/identity";
import {
  addPlantQualification,
  canPerform,
  createPlantUser,
  listPlantUsers,
  pinMessage,
  plantPinAction,
  savePlantUser,
  setPlantEnabled,
  setPlantRoles,
  type PlantUser,
} from "../services/plantDirectory";

const ROLES: { code: string; label: string }[] = [
  { code: "SUPER_ADMIN", label: "Super Admin" },
  { code: "ADMIN", label: "Admin" },
  { code: "REQUESTER", label: "Requester" },
  { code: "PERMIT_AUTHORIZER", label: "Permit Authorizer" },
  { code: "SHIFT_SUPERVISOR", label: "Shift Supervisor" },
  { code: "CRAFT_RECEIVER", label: "Craft / Permit Receiver" },
  { code: "SAFETY", label: "Safety" },
  { code: "VIEWER", label: "Viewer" },
];

const QUALIFICATIONS: { code: string; label: string }[] = [
  { code: "GAS_TESTER", label: "Gas Tester" },
  { code: "FIRE_WATCH", label: "Fire Watch" },
  { code: "ATTENDANT", label: "Confined Space Attendant" },
  { code: "AUTHORIZED_ENTRANT", label: "Authorized Entrant" },
  { code: "COMPETENT_PERSON", label: "Competent Person" },
  { code: "QUALIFIED_ELECTRICAL_WORKER", label: "Qualified Electrical Worker" },
  { code: "SAFETY_WATCH", label: "Safety Watch" },
];

type UserTab = "profile" | "access" | "qualifications" | "security";
type Notice = { title: string; body: string } | null;

const blank = (): PlantUser => ({
  id: "",
  permitUserCode: "",
  displayName: "",
  windowsUsername: "",
  windowsDomain: "",
  personnelReference: "",
  personnelCode: "",
  jobTitle: "",
  department: "",
  enabled: true,
  pinState: "NOT_ENROLLED",
  pinChangedAt: null,
  failedAttempts: null,
  lockedUntil: null,
  roles: ["REQUESTER"],
  qualifications: [],
});

function roleLabel(code: string) {
  return ROLES.find((item) => item.code === code)?.label ?? code;
}

function sameRoles(left: string[], right: string[]) {
  return [...left].sort().join("|") === [...right].sort().join("|");
}

function profileSignature(user: PlantUser) {
  return JSON.stringify({
    displayName: user.displayName,
    windowsUsername: user.windowsUsername,
    windowsDomain: user.windowsDomain ?? "",
    personnelReference: user.personnelReference,
    personnelCode: user.personnelCode,
    jobTitle: user.jobTitle,
    department: user.department ?? "",
  });
}

function contextual(message: string, fallback: string) {
  if (!message || message === "Permit Control could not complete that action.") return fallback;
  return message;
}

export function UsersScreen({ embedded = false, focus = "directory" }: { embedded?: boolean; focus?: "directory" | "roles" | "qualifications" } = {}) {
  const identity = useIdentity();
  const [users, setUsers] = useState<PlantUser[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "enabled" | "disabled">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [loaded, setLoaded] = useState(false);
  const [savedNote, setSavedNote] = useState("");
  const allowed = canPerform(identity.user, "ADMIN");
  const openingTab: UserTab = focus === "roles" ? "access" : focus === "qualifications" ? "qualifications" : "profile";

  const load = async () => {
    if (!identity.token || !allowed) return [];
    const rows = await listPlantUsers(identity.token, search, filter);
    setUsers(rows);
    return rows;
  };

  useEffect(() => {
    if (!identity.token || !allowed) return;
    let stopped = false;
    void listPlantUsers(identity.token, search, filter)
      .then((rows) => {
        if (!stopped) {
          setUsers(rows);
          setLoaded(true);
        }
      })
      .catch((error) => {
        if (!stopped) setNotice({ title: "USERS UNAVAILABLE", body: contextual(pinMessage(error), "Permit Control could not read the user directory.") });
      });
    return () => {
      stopped = true;
    };
  }, [identity.token, identity.user, allowed, filter, search]);

  if (!allowed) return <div className="screen"><p className="empty">User administration requires a Permit Control administrator.</p></div>;

  const selected = creating ? null : users.find((user) => user.id === selectedId) ?? null;
  const index = selected ? users.findIndex((user) => user.id === selected.id) : -1;
  const openEditor = creating || selected !== null;

  return (
    <div className={embedded ? "admin-users" : "screen"}>
      <div className={embedded ? undefined : "admin-console"}>
        {embedded ? null : <ScreenHead kicker="ADMINISTRATION" title="Users" meta={`${users.length} SHOWN`} />}
        {embedded && focus === "roles" ? <p className="admin-inline-note">Open a person to assign the roles that allow them to act. The stored role code is unchanged.</p> : null}
        {embedded && focus === "qualifications" ? <p className="admin-inline-note">Open a person to record specialty qualifications a rule can require.</p> : null}
        <div className="admin-list-tools">
          <AdminField label="Search" width="standard">
            <input value={search} onChange={(event) => setSearch(event.target.value)} />
          </AdminField>
          <AdminField label="Status" width="small">
            <select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}>
              <option value="all">All</option>
              <option value="enabled">Enabled</option>
              <option value="disabled">Disabled</option>
            </select>
          </AdminField>
          <AdminButton variant="primary" onClick={() => { setCreating(true); setSelectedId(null); setSavedNote(""); }}>New user</AdminButton>
        </div>
        {savedNote ? <p className="admin-inline-note">{savedNote}</p> : null}
        {notice && !openEditor ? <AdminError title={notice.title} onRetry={() => void load().catch(() => undefined)}>{notice.body}</AdminError> : null}
        {loaded && users.length === 0 ? (
          <AdminEmptyState title="NO PEOPLE MATCH" action={<AdminButton variant="primary" onClick={() => { setCreating(true); setSelectedId(null); }}>New user</AdminButton>}>
            Adjust the search or add the first account for this plant.
          </AdminEmptyState>
        ) : (
          <div className="admin-list">
            {users.map((user) => (
              <button key={user.id} type="button" id={`admin-user-${user.id}`} className="admin-user-row" onClick={() => { setCreating(false); setSelectedId(user.id); setNotice(null); }}>
                <span className="mono">{user.permitUserCode}</span>
                <strong>{user.displayName}</strong>
                <span>{user.jobTitle || "No job title"}</span>
                <AdminStatus tone={user.enabled ? "ok" : "warn"}>{user.enabled ? "Enabled" : "Disabled"}</AdminStatus>
                <span>{user.roles.map(roleLabel).join(" · ") || "No roles"}</span>
              </button>
            ))}
          </div>
        )}
        {openEditor ? (
          <UserEditor
            key={creating ? "new" : selected?.id}
            user={creating ? blank() : selected ?? blank()}
            tab={openingTab}
            token={identity.token}
            restoreId={selected ? `admin-user-${selected.id}` : undefined}
            onPrevious={index > 0 ? () => setSelectedId(users[index - 1].id) : undefined}
            onNext={index >= 0 && index < users.length - 1 ? () => setSelectedId(users[index + 1].id) : undefined}
            onClose={() => { setCreating(false); setSelectedId(null); }}
            onSaved={async (saved) => {
              setCreating(false);
              setSelectedId(null);
              setSavedNote(`${saved.displayName || "User"} saved.`);
              await load();
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

function UserEditor({
  user,
  tab,
  token,
  restoreId,
  onPrevious,
  onNext,
  onClose,
  onSaved,
}: {
  user: PlantUser;
  tab: UserTab;
  token: string | null;
  restoreId?: string;
  onPrevious?: () => void;
  onNext?: () => void;
  onClose: () => void;
  onSaved: (user: PlantUser) => Promise<void>;
}) {
  const [draft, setDraft] = useState(user);
  const [enabled, setEnabled] = useState(user.enabled);
  const [added, setAdded] = useState<string[]>([]);
  const [pin, setPin] = useState("");
  const [active, setActive] = useState<UserTab>(tab);
  const [notice, setNotice] = useState<Notice>(null);
  const [securityNote, setSecurityNote] = useState("");
  const held = new Set(draft.qualifications.filter((item) => item.enabled).map((item) => item.qualificationType));
  const dirty = profileSignature(draft) !== profileSignature(user)
    || !sameRoles(draft.roles, user.roles)
    || enabled !== user.enabled
    || added.length > 0
    || pin.length > 0;

  const patch = (next: Partial<PlantUser>) => setDraft((current) => ({ ...current, ...next }));
  const fail = (error: unknown, title: string, fallback: string) => {
    setNotice({ title, body: `${contextual(pinMessage(error), fallback)} Your changes remain in the editor.` });
  };

  const save = async () => {
    if (!token) return;
    if (!draft.displayName.trim() || !draft.windowsUsername.trim()) {
      setNotice({ title: "USER NOT SAVED", body: "Enter a display name and Windows username. Your changes remain in the editor." });
      setActive("profile");
      return;
    }
    setNotice(null);
    try {
      let saved = { ...draft, enabled: user.enabled };
      if (!draft.id) {
        saved = await createPlantUser(token, { ...draft, enabled });
      } else {
        await savePlantUser(token, { ...draft, enabled: user.enabled });
        if (!sameRoles(draft.roles, user.roles)) await setPlantRoles(token, draft.id, draft.roles, pin);
        if (enabled !== user.enabled) await setPlantEnabled(token, draft.id, enabled, pin);
      }
      const userId = saved.id || draft.id;
      if (!draft.id) setDraft(saved);
      for (const qualification of added) {
        await addPlantQualification(token, userId, qualification);
      }
      setPin("");
      setAdded([]);
      document.body.dataset.adminRestore = `admin-user-${userId}`;
      await onSaved(saved.id ? saved : { ...draft, id: userId });
    } catch (error) {
      fail(error, "USER NOT SAVED", "Permit Control could not save this user.");
    }
  };

  const security = async (action: "require-change" | "reset-enrollment" | "unlock", label: string) => {
    if (!token || !draft.id) return;
    setNotice(null);
    setSecurityNote("");
    try {
      await plantPinAction(token, draft.id, action, pin);
      setPin("");
      setSecurityNote(`${label} completed. Profile edits in this window are still here.`);
    } catch (error) {
      fail(error, "SECURITY ACTION NOT COMPLETED", "Permit Control could not complete that security action.");
    }
  };

  return (
    <AdminEditorModal
      title={draft.id ? "Edit user" : "New user"}
      code={draft.permitUserCode || undefined}
      subtitle={draft.id ? `${draft.displayName}${draft.jobTitle ? ` · ${draft.jobTitle}` : ""}` : "Create a Permit Control identity."}
      subject="this user"
      wide
      dirty={dirty}
      primaryLabel={draft.id ? "Save changes" : "Create user"}
      restoreId={draft.id ? `admin-user-${draft.id}` : restoreId}
      recordLabel={draft.permitUserCode || "New user"}
      onPrevious={onPrevious}
      onNext={onNext}
      onClose={onClose}
      onSave={() => void save()}
      error={notice ? <AdminError title={notice.title}>{notice.body}</AdminError> : null}
    >
      <div className="admin-tabs" role="tablist" aria-label="User editor">
        {(["profile", "access", "qualifications", "security"] as const).map((item) => (
          <button key={item} type="button" role="tab" aria-selected={active === item} className={active === item ? "is-active" : undefined} onClick={() => setActive(item)}>
            {item === "profile" ? "Profile" : item === "access" ? "Access" : item === "qualifications" ? "Qualifications" : "Security"}
          </button>
        ))}
      </div>
      {active === "profile" ? (
        <div role="tabpanel">
          <AdminFieldGroup>
            <AdminField label="Permit Control ID" width="medium" help={draft.id ? "Assigned by Permit Control and kept with the account." : "Assigned when the account is created."}>
              <input value={draft.permitUserCode} readOnly />
            </AdminField>
            <AdminField label="Display name" width="standard"><input value={draft.displayName} onChange={(event) => patch({ displayName: event.target.value })} /></AdminField>
            <AdminField label="Windows username" width="medium"><input value={draft.windowsUsername} onChange={(event) => patch({ windowsUsername: event.target.value })} /></AdminField>
            <AdminField label="Windows domain" width="medium"><input value={draft.windowsDomain ?? ""} onChange={(event) => patch({ windowsDomain: event.target.value })} /></AdminField>
            <AdminField label="Personnel reference" width="medium"><input value={draft.personnelReference} onChange={(event) => patch({ personnelReference: event.target.value })} /></AdminField>
            <AdminField label="Personnel code" width="small"><input value={draft.personnelCode} onChange={(event) => patch({ personnelCode: event.target.value })} /></AdminField>
            <AdminField label="Job title" width="standard"><input value={draft.jobTitle} onChange={(event) => patch({ jobTitle: event.target.value })} /></AdminField>
            <AdminField label="Department" width="standard"><input value={draft.department ?? ""} onChange={(event) => patch({ department: event.target.value })} /></AdminField>
            <label className="admin-check">
              <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
              <span>Enabled</span>
            </label>
          </AdminFieldGroup>
          {draft.id && enabled !== user.enabled ? <p className="admin-inline-note">Changing enabled state is confirmed with your administrator PIN when you save.</p> : null}
        </div>
      ) : null}
      {active === "access" ? (
        <div role="tabpanel">
          <p className="admin-inline-note">Roles decide who can request, authorize, accept, and administer permits.</p>
          <div className="admin-checks">
            {ROLES.map((role) => (
              <label key={role.code} className="admin-check">
                <input
                  type="checkbox"
                  checked={draft.roles.includes(role.code)}
                  onChange={(event) => {
                    const roles = event.target.checked ? [...draft.roles, role.code] : draft.roles.filter((item) => item !== role.code);
                    patch({ roles });
                  }}
                />
                <span>{role.label}</span>
              </label>
            ))}
          </div>
        </div>
      ) : null}
      {active === "qualifications" ? (
        <div role="tabpanel">
          <p className="admin-inline-note">Qualifications already on the account stay recorded. New selections are added when you save.</p>
          <div className="admin-checks">
            {QUALIFICATIONS.map((item) => {
              const recorded = held.has(item.code);
              return (
                <label key={item.code} className="admin-check">
                  <input
                    type="checkbox"
                    checked={recorded || added.includes(item.code)}
                    disabled={recorded}
                    onChange={(event) => setAdded((current) => event.target.checked ? [...current, item.code] : current.filter((code) => code !== item.code))}
                  />
                  <span>{item.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      ) : null}
      {active === "security" ? (
        <div role="tabpanel">
          <dl className="admin-facts">
            <div><dt>PIN status</dt><dd>{draft.pinState}</dd></div>
            <div><dt>Last changed</dt><dd>{draft.pinChangedAt ?? "—"}</dd></div>
            <div><dt>Failed attempts</dt><dd>{draft.failedAttempts ?? "—"}</dd></div>
            <div><dt>Lockout</dt><dd>{draft.lockedUntil ?? "None"}</dd></div>
          </dl>
          {securityNote ? <p className="admin-inline-note">{securityNote}</p> : null}
          {draft.id ? (
            <div className="admin-toolbar">
              <AdminButton variant="secondary" onClick={() => void security("require-change", "Require PIN change")}>Require PIN change</AdminButton>
              <AdminButton variant="danger" onClick={() => void security("reset-enrollment", "Reset PIN enrollment")}>Reset PIN enrollment</AdminButton>
              <AdminButton variant="secondary" onClick={() => void security("unlock", "Unlock PIN")}>Unlock PIN</AdminButton>
            </div>
          ) : <p className="admin-inline-note">PIN actions are available after the account is created.</p>}
        </div>
      ) : null}
      {draft.id ? (
        <AdminField label="Administrator PIN" width="small" help="Used to confirm role changes, enabled state, and security actions. The PIN is not stored in this editor.">
          <input type="text" inputMode="numeric" autoComplete="off" value={pin} onChange={(event) => setPin(event.target.value)} />
        </AdminField>
      ) : null}
    </AdminEditorModal>
  );
}
