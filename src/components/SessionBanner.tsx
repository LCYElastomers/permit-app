import { useState } from "react";
import { useIdentity } from "../services/identity";
import { changePin, completePinEnrollment, pinMessage, showCreatePinForm } from "../services/plantDirectory";

export function SessionBanner() {
  const identity = useIdentity();
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [current, setCurrent] = useState("");
  const [selected, setSelected] = useState("");
  const [message, setMessage] = useState("");
  const [switching, setSwitching] = useState(false);
  const [enrollmentSaved, setEnrollmentSaved] = useState(false);
  const user = identity.user;

  const enroll = async () => {
    if (!identity.token) return;
    setMessage("");
    const finish = await completePinEnrollment(identity.token, pin, confirm);
    if (finish.kind === "failed") {
      setMessage(finish.message);
      return;
    }
    setPin("");
    setConfirm("");
    if (finish.kind === "active") {
      identity.replaceUser(finish.user);
      setEnrollmentSaved(false);
      return;
    }
    setEnrollmentSaved(true);
    setMessage("Your Permit Control PIN is saved. Permit Control could not refresh your session.");
  };

  const refreshSession = async () => {
    setMessage("");
    try {
      await identity.refresh();
      setEnrollmentSaved(false);
    } catch {
      setMessage("Your Permit Control PIN is saved. Permit Control could not refresh your session.");
    }
  };

  const replace = async () => {
    if (!identity.token) return;
    setMessage("");
    try {
      await changePin(identity.token, current, pin, confirm);
    } catch (error) {
      setMessage(pinMessage(error));
      return;
    }
    setCurrent("");
    setPin("");
    setConfirm("");
    try {
      await identity.refresh();
    } catch {
      setMessage("Your Permit Control PIN was changed. Permit Control could not refresh your session.");
    }
  };

  const choose = async () => {
    setMessage("");
    try {
      await identity.selectUser(selected, pin);
      setPin("");
    } catch (error) {
      setMessage(pinMessage(error));
    }
  };

  const switchWithPin = async () => {
    setMessage("");
    try {
      await identity.selectUser(selected, pin);
      setSwitching(false);
      setPin("");
    } catch (error) {
      setMessage(pinMessage(error));
    }
  };

  if (!identity.ready) return null;
  if (!user && identity.needsSelection) {
    return (
      <section className="notice">
        <div className="kicker">SELECT PERMIT CONTROL USER</div>
        <p>This Windows account is not mapped to one enabled Permit Control user. Choose the person at this device and confirm with that person's PIN.</p>
        <label className="confirm-field">
          <span>Permit Control user</span>
          <select value={selected} onChange={(event) => setSelected(event.target.value)}>
            <option value="">Select</option>
            {identity.choices.map((choice) => (
              <option key={choice.id} value={choice.id}>
                {choice.permitUserCode} · {choice.displayName}
              </option>
            ))}
          </select>
        </label>
        <PinField label="PIN" value={pin} onChange={setPin} />
        <button type="button" className="btn" onClick={() => void choose()}>Use this user</button>
        {message ? <p className="form-error">{message}</p> : null}
      </section>
    );
  }

  if (!user) return null;

  const enrollment = showCreatePinForm(user.pinState, enrollmentSaved);
  const changeRequired = user.pinState === "CHANGE_REQUIRED";
  return (
    <section className="notice">
      <div className="kicker">PERMIT CONTROL ID {user.permitUserCode}</div>
      <p>{user.displayName} · {user.jobTitle || "No job title"} · {user.windowsUsername}</p>
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => {
          setSwitching(true);
          void identity.loadChoices();
        }}
      >
        Switch user
      </button>
      {enrollment ? (
        <>
          <h2>Welcome to LCY Permit Control</h2>
          <p>Create your Permit Control PIN. Plant Link must be connected. The PIN is not required to view or prepare a draft.</p>
          <PinField label="PIN" value={pin} onChange={setPin} />
          <PinField label="Confirm PIN" value={confirm} onChange={setConfirm} />
          <button type="button" className="btn" onClick={() => void enroll()}>Create PIN</button>
        </>
      ) : null}
      {enrollmentSaved && needsRefresh(user.pinState) ? (
        <button type="button" className="btn" onClick={() => void refreshSession()}>Refresh session</button>
      ) : null}
      {changeRequired ? (
        <>
          <p>Your Permit Control PIN must be changed before an authorization action.</p>
          <PinField label="Current PIN" value={current} onChange={setCurrent} />
          <PinField label="New PIN" value={pin} onChange={setPin} />
          <PinField label="Confirm PIN" value={confirm} onChange={setConfirm} />
          <button type="button" className="btn" onClick={() => void replace()}>Change PIN</button>
        </>
      ) : null}
      {switching ? (
        <>
          <label className="confirm-field">
            <span>Switch user</span>
            <select value={selected} onChange={(event) => setSelected(event.target.value)}>
              <option value="">Select</option>
              {identity.choices.map((choice) => (
                <option key={choice.id} value={choice.id}>{choice.permitUserCode} · {choice.displayName}</option>
              ))}
            </select>
          </label>
          <PinField label="That user's PIN" value={pin} onChange={setPin} />
          <button type="button" className="btn" onClick={() => void switchWithPin()}>Confirm switch</button>
        </>
      ) : null}
      {message ? <p className="form-error">{message}</p> : null}
    </section>
  );
}

function needsRefresh(pinState: string): boolean {
  return pinState !== "ACTIVE";
}

function PinField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="confirm-field">
      <span>{label}</span>
      <input inputMode="numeric" autoComplete="off" maxLength={6} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
