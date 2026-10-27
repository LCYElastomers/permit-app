import { useEffect, useState } from "react";
import { PinInput } from "../components/PinInput";
import { useDevice } from "../services/device";
import { useIdentity } from "../services/identity";
import { changePin, pinMessage, updateOwnProfile, type PlantUser } from "../services/plantDirectory";
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_TOPICS,
  normalizeEmail,
  normalizePhone,
  preferenceEnabled,
  preferencePayload,
  type NotificationChoice,
} from "../services/profileContact";

const QUALIFICATIONS: Record<string, string> = {
  GAS_TESTER: "Gas Tester",
  FIRE_WATCH: "Fire Watch",
  ATTENDANT: "Confined Space Attendant",
  AUTHORIZED_ENTRANT: "Authorized Entrant",
  COMPETENT_PERSON: "Competent Person",
  QUALIFIED_ELECTRICAL_WORKER: "Qualified Electrical Worker",
  SAFETY_WATCH: "Safety Watch",
};

function windowsAccount(user: PlantUser) {
  return user.windowsDomain ? `${user.windowsDomain}\\${user.windowsUsername}` : user.windowsUsername;
}

function qualificationStatus(item: PlantUser["qualifications"][number]) {
  if (!item.enabled) return "Not current";
  if (!item.expirationDate) return "Current";
  const date = new Date(item.expirationDate);
  const label = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  return `Current through ${label}`;
}

function pinWhen(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" }) + " UTC";
}

export function ProfileScreen() {
  const identity = useIdentity();
  const { link } = useDevice();
  const user = identity.user;
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [alternate, setAlternate] = useState("");
  const [preferences, setPreferences] = useState<NotificationChoice[]>([]);
  const [message, setMessage] = useState("");
  const [changingPin, setChangingPin] = useState(false);
  const [currentPin, setCurrentPin] = useState("");
  const [nextPin, setNextPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [saving, setSaving] = useState(false);
  const ready = link.link === "ready";
  const offline = link.link === "unreachable" || link.link === "api-online";

  useEffect(() => {
    if (!user) return;
    setEmail(user.email ?? "");
    setMobile(user.mobilePhone ?? "");
    setAlternate(user.alternatePhone ?? "");
    setPreferences(user.notificationPreferences ?? []);
    setCurrentPin("");
    setNextPin("");
    setConfirmPin("");
  }, [user]);

  if (!user) return <div className="screen"><p className="empty">Sign in to view your profile.</p></div>;

  const toggle = (channel: string, topic: string, enabled: boolean) => {
    setPreferences((current) => [
      ...current.filter((item) => item.channel !== channel || item.topic !== topic),
      { channel, topic, enabled },
    ]);
  };

  const save = async () => {
    if (!identity.token || !ready) {
      setMessage("Plant Link is offline. Profile changes require a plant connection.");
      return;
    }
    const nextEmail = normalizeEmail(email);
    if (nextEmail.error) {
      setMessage(nextEmail.error);
      return;
    }
    const nextMobile = normalizePhone(mobile);
    if (nextMobile.error) {
      setMessage(nextMobile.error);
      return;
    }
    const nextAlternate = normalizePhone(alternate);
    if (nextAlternate.error) {
      setMessage(nextAlternate.error);
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      await updateOwnProfile(identity.token, {
        email: nextEmail.email,
        mobilePhone: nextMobile.e164 ?? "",
        alternatePhone: nextAlternate.e164 ?? "",
        preferences: preferencePayload(preferences, nextMobile.e164, nextEmail.email),
      });
      try {
        await identity.refresh();
      } catch {
        /* the profile is already stored; the next session read picks it up */
      }
      setMessage("Profile updated.");
    } catch (error) {
      setMessage(pinMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const replacePin = async () => {
    if (!identity.token || !ready) {
      setMessage("Plant Link is offline. Profile changes require a plant connection.");
      return;
    }
    setMessage("");
    try {
      await changePin(identity.token, currentPin, nextPin, confirmPin);
      setCurrentPin("");
      setNextPin("");
      setConfirmPin("");
      setChangingPin(false);
      setMessage("Your Permit Control PIN was changed.");
      await identity.refresh();
    } catch (error) {
      setCurrentPin("");
      setNextPin("");
      setConfirmPin("");
      setMessage(pinMessage(error));
    }
  };

  const mobileReady = normalizePhone(mobile).e164 !== null;
  const emailReady = normalizeEmail(email).email.length > 0;

  return (
    <div className="screen profile-sheet">
      <div className="screen-head">
        <div>
          <div className="kicker">My Profile</div>
          <h1>{user.displayName}</h1>
          <div className="mono profile-code">{user.permitUserCode}</div>
        </div>
      </div>
      {!ready ? <p className="form-error">{offline ? "Plant Link is offline. Profile changes require a plant connection." : "Plant Link is still connecting. Profile changes wait until the plant connection is ready."}</p> : null}
      {message ? <p className="profile-note" role="status">{message}</p> : null}

      <section className="block">
        <h2>Profile</h2>
        <dl className="profile-facts">
          <div><dt>Permit Control ID</dt><dd className="mono">{user.permitUserCode}</dd></div>
          <div><dt>Display name</dt><dd>{user.displayName}</dd></div>
          <div><dt>Job title</dt><dd>{user.jobTitle || "—"}</dd></div>
          <div><dt>Department</dt><dd>{user.department || "—"}</dd></div>
          {user.personnelReference ? <div><dt>Personnel reference</dt><dd>{user.personnelReference}</dd></div> : null}
          {user.personnelCode ? <div><dt>Personnel code</dt><dd>{user.personnelCode}</dd></div> : null}
          <div><dt>Windows account</dt><dd>{windowsAccount(user)}</dd></div>
        </dl>
      </section>

      <section className="block">
        <h2>Contact information</h2>
        <div className="field-grid">
          <label className="form-field span-2">
            <span>Work email</span>
            <input value={email} inputMode="email" autoComplete="email" onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label className="form-field">
            <span>Mobile phone</span>
            <input value={mobile} type="tel" autoComplete="tel" onChange={(event) => setMobile(event.target.value)} />
          </label>
          <label className="form-field">
            <span>Alternate phone</span>
            <input value={alternate} type="tel" autoComplete="tel" onChange={(event) => setAlternate(event.target.value)} />
          </label>
        </div>
        <p className="profile-note">Mobile verification <strong>NOT VERIFIED</strong></p>
      </section>

      {user.qualifications.length > 0 ? (
        <section className="block">
          <h2>Qualifications</h2>
          <dl className="profile-facts">
            {user.qualifications.map((item) => (
              <div key={item.id}>
                <dt>{QUALIFICATIONS[item.qualificationType] ?? item.qualificationType}</dt>
                <dd>{qualificationStatus(item)}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <section className="block">
        <h2>Notification preferences</h2>
        <p className="profile-note">These choices are saved for later delivery. Permit Control is not sending SMS or email from this screen.</p>
        <p className="profile-note">SMS contact not verified</p>
        <table className="profile-prefs">
          <thead>
            <tr>
              <th>Notice</th>
              {NOTIFICATION_CHANNELS.map((channel) => <th key={channel.code}>{channel.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {NOTIFICATION_TOPICS.map((topic) => (
              <tr key={topic.code}>
                <td>{topic.label}</td>
                {NOTIFICATION_CHANNELS.map((channel) => {
                  const blocked = (channel.code === "SMS" && !mobileReady) || (channel.code === "EMAIL" && !emailReady);
                  return (
                    <td key={channel.code}>
                      <input
                        type="checkbox"
                        aria-label={`${channel.label} ${topic.label}`}
                        checked={!blocked && preferenceEnabled(preferences, channel.code, topic.code)}
                        disabled={blocked}
                        onChange={(event) => toggle(channel.code, topic.code, event.target.checked)}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="block">
        <h2>Security</h2>
        <dl className="profile-facts">
          <div><dt>Permit Control PIN</dt><dd>{user.pinState}</dd></div>
          <div><dt>Last changed</dt><dd>{pinWhen(user.pinChangedAt)}</dd></div>
        </dl>
        {changingPin ? (
          <div className="profile-pin">
            <PinInput label="Current PIN" purpose="current" value={currentPin} onChange={setCurrentPin} />
            <PinInput label="New PIN" purpose="new" value={nextPin} onChange={setNextPin} />
            <PinInput label="Confirm PIN" purpose="new" value={confirmPin} onChange={setConfirmPin} />
            <div className="profile-actions">
              <button type="button" className="btn btn-next" onClick={() => void replacePin()}>Change PIN</button>
              <button type="button" className="btn btn-ghost" onClick={() => { setChangingPin(false); setCurrentPin(""); setNextPin(""); setConfirmPin(""); }}>Cancel</button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn" onClick={() => { setChangingPin(true); setCurrentPin(""); setNextPin(""); setConfirmPin(""); }}>Change PIN</button>
        )}
      </section>

      <div className="profile-actions">
        <button type="button" className="btn btn-next" disabled={!ready || saving} onClick={() => void save()}>Save changes</button>
      </div>
    </div>
  );
}
