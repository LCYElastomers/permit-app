import { useEffect, useState } from "react";
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

const ROLES = ["SUPER_ADMIN", "ADMIN", "REQUESTER", "PERMIT_AUTHORIZER", "SHIFT_SUPERVISOR", "CRAFT_RECEIVER", "SAFETY", "VIEWER"];
const QUALIFICATIONS = ["GAS_TESTER", "FIRE_WATCH", "ATTENDANT", "AUTHORIZED_ENTRANT", "COMPETENT_PERSON", "QUALIFIED_ELECTRICAL_WORKER", "SAFETY_WATCH"];

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

export function UsersScreen() {
  const identity = useIdentity();
  const [users, setUsers] = useState<PlantUser[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "enabled" | "disabled">("all");
  const [selected, setSelected] = useState<PlantUser | null>(null);
  const [pin, setPin] = useState("");
  const [qualification, setQualification] = useState(QUALIFICATIONS[0]);
  const [message, setMessage] = useState("");
  const allowed = canPerform(identity.user, "ADMIN");

  const load = async () => {
    if (!identity.token || !allowed) return;
    setUsers(await listPlantUsers(identity.token, search, filter));
  };

  useEffect(() => {
    if (!identity.token || !allowed) return;
    let stopped = false;
    void listPlantUsers(identity.token, search, filter)
      .then((rows) => {
        if (!stopped) setUsers(rows);
      })
      .catch((error) => {
        if (!stopped) setMessage(pinMessage(error));
      });
    return () => {
      stopped = true;
    };
  }, [identity.token, identity.user, allowed, filter, search]);

  const run = async (action: () => Promise<void>) => {
    setMessage("");
    try {
      await action();
      await load();
    } catch (error) {
      setMessage(pinMessage(error));
    }
  };

  if (!allowed) return <div className="screen"><p className="empty">User administration requires a Permit Control administrator.</p></div>;

  return (
    <div className="screen">
      <ScreenHead kicker="ADMINISTRATION" title="Users" meta={`${users.length} SHOWN`} />
      <div className="list-filter">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, ID, Windows account, title" />
        <button type="button" className="btn" onClick={() => void load()}>Search</button>
        <select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}>
          <option value="all">All</option>
          <option value="enabled">Enabled</option>
          <option value="disabled">Disabled</option>
        </select>
        <button type="button" className="btn" onClick={() => setSelected(blank())}>New user</button>
      </div>
      {users.map((user) => (
        <button key={user.id} type="button" className="permit-row" onClick={() => setSelected(user)}>
          <div className="row-top">
            <span className="pid mono">{user.permitUserCode}</span>
            <span className="kind">{user.displayName}</span>
            <span className="row-status"><span className="screen-meta">{user.enabled ? "ENABLED" : "DISABLED"}</span></span>
          </div>
          <div className="row-work">{user.windowsUsername} · {user.jobTitle || "No job title"} · {user.roles.join(", ")}</div>
        </button>
      ))}
      {selected ? (
        <form className="blocker" onSubmit={(event) => event.preventDefault()}>
          <div className="kicker">PROFILE {selected.permitUserCode || "NEW"}</div>
          <Text label="Display name" value={selected.displayName} onChange={(displayName) => setSelected({ ...selected, displayName })} />
          <Text label="Windows username" value={selected.windowsUsername} onChange={(windowsUsername) => setSelected({ ...selected, windowsUsername })} />
          <Text label="Windows domain" value={selected.windowsDomain ?? ""} onChange={(windowsDomain) => setSelected({ ...selected, windowsDomain })} />
          <Text label="Personnel reference" value={selected.personnelReference} onChange={(personnelReference) => setSelected({ ...selected, personnelReference })} />
          <Text label="Personnel code" value={selected.personnelCode} onChange={(personnelCode) => setSelected({ ...selected, personnelCode })} />
          <Text label="Job title" value={selected.jobTitle} onChange={(jobTitle) => setSelected({ ...selected, jobTitle })} />
          <Text label="Department" value={selected.department ?? ""} onChange={(department) => setSelected({ ...selected, department })} />
          <div className="kicker">ACCESS / ROLES</div>
          {ROLES.map((role) => (
            <label key={role}>
              <input
                type="checkbox"
                checked={selected.roles.includes(role)}
                onChange={(event) => {
                  const roles = event.target.checked ? [...selected.roles, role] : selected.roles.filter((item) => item !== role);
                  setSelected({ ...selected, roles });
                }}
              />
              {role.replaceAll("_", " ")}
            </label>
          ))}
          <div className="kicker">SECURITY / PIN</div>
          <p>Status {selected.pinState}. Last changed {selected.pinChangedAt ?? "—"}. Failed attempts {selected.failedAttempts ?? "—"}. Lockout {selected.lockedUntil ?? "none"}.</p>
          <Text label="Administrator PIN" value={pin} onChange={setPin} numeric />
          <div className="confirm-actions">
            <button
              type="button"
              className="btn"
              onClick={() => void run(async () => {
                if (!identity.token) return;
                if (!selected.id) {
                  const created = await createPlantUser(identity.token, selected);
                  setSelected(created);
                  return;
                }
                await savePlantUser(identity.token, selected);
                await setPlantRoles(identity.token, selected.id, selected.roles, pin);
              })}
            >
              Save profile
            </button>
            {selected.id ? (
              <>
                <button type="button" className="btn" onClick={() => void run(async () => { if (identity.token) await setPlantEnabled(identity.token, selected.id, !selected.enabled, pin); })}>{selected.enabled ? "Disable user" : "Enable user"}</button>
                <button type="button" className="btn" onClick={() => void run(async () => { if (identity.token) await plantPinAction(identity.token, selected.id, "require-change", pin); })}>Require PIN change</button>
                <button type="button" className="btn" onClick={() => void run(async () => { if (identity.token) await plantPinAction(identity.token, selected.id, "reset-enrollment", pin); })}>Reset PIN enrollment</button>
                <button type="button" className="btn" onClick={() => void run(async () => { if (identity.token) await plantPinAction(identity.token, selected.id, "unlock", pin); })}>Unlock PIN</button>
              </>
            ) : null}
          </div>
          {selected.id ? (
            <>
              <div className="kicker">QUALIFICATIONS</div>
              <ul>{selected.qualifications.map((item) => <li key={item.id}>{item.qualificationType}</li>)}</ul>
              <select value={qualification} onChange={(event) => setQualification(event.target.value)}>
                {QUALIFICATIONS.map((item) => <option key={item}>{item}</option>)}
              </select>
              <button type="button" className="btn" onClick={() => void run(async () => { if (identity.token) await addPlantQualification(identity.token, selected.id, qualification); })}>Add qualification</button>
            </>
          ) : null}
          {message ? <p className="form-error">{message}</p> : null}
        </form>
      ) : null}
    </div>
  );
}

function Text({ label, value, onChange, numeric = false }: { label: string; value: string; onChange: (value: string) => void; numeric?: boolean }) {
  return (
    <label className="confirm-field">
      <span>{label}</span>
      <input value={value} inputMode={numeric ? "numeric" : "text"} autoComplete="off" onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
