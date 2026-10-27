import { useEffect, useRef, useState } from "react";
import { adminRoleLine } from "../services/adminPresentation";
import { useIdentity } from "../services/identity";
import { canPerform, changePin, completePinEnrollment, pinMessage, showCreatePinForm } from "../services/plantDirectory";
import { PinInput } from "./PinInput";
import { usePermits } from "../state/PermitStore";

export function SessionBanner() {
  const identity = useIdentity();
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [current, setCurrent] = useState("");
  const [selected, setSelected] = useState("");
  const [message, setMessage] = useState("");
  const [enrollmentSaved, setEnrollmentSaved] = useState(false);
  const user = identity.user;

  useEffect(() => {
    setPin("");
    setConfirm("");
    setCurrent("");
  }, [user?.id]);

  const enroll = async () => {
    if (!identity.token) return;
    setMessage("");
    const finish = await completePinEnrollment(identity.token, pin, confirm);
    if (finish.kind === "failed") {
      setPin("");
      setConfirm("");
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
      setCurrent("");
      setPin("");
      setConfirm("");
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
      setPin("");
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
        <PinInput label="PIN" purpose="current" value={pin} onChange={setPin} />
        <button type="button" className="btn" onClick={() => void choose()}>Use this user</button>
        {message ? <p className="form-error">{message}</p> : null}
      </section>
    );
  }

  if (!user) return null;

  const enrollment = showCreatePinForm(user.pinState, enrollmentSaved);
  const changeRequired = user.pinState === "CHANGE_REQUIRED";
  if (!enrollment && !changeRequired && !(enrollmentSaved && needsRefresh(user.pinState))) return null;
  return (
    <section className="notice">
      {enrollment ? (
        <>
          <h2>Welcome to LCY Permit Control</h2>
          <p>Create your Permit Control PIN. Plant Link must be connected. The PIN is not required to view or prepare a draft.</p>
          <PinInput label="PIN" purpose="new" value={pin} onChange={setPin} />
          <PinInput label="Confirm PIN" purpose="new" value={confirm} onChange={setConfirm} />
          <button type="button" className="btn" onClick={() => void enroll()}>Create PIN</button>
        </>
      ) : null}
      {enrollmentSaved && needsRefresh(user.pinState) ? (
        <button type="button" className="btn" onClick={() => void refreshSession()}>Refresh session</button>
      ) : null}
      {changeRequired ? (
        <>
          <p>Your Permit Control PIN must be changed before an authorization action.</p>
          <PinInput label="Current PIN" purpose="current" value={current} onChange={setCurrent} />
          <PinInput label="New PIN" purpose="new" value={pin} onChange={setPin} />
          <PinInput label="Confirm PIN" purpose="new" value={confirm} onChange={setConfirm} />
          <button type="button" className="btn" onClick={() => void replace()}>Change PIN</button>
        </>
      ) : null}
      {message ? <p className="form-error">{message}</p> : null}
    </section>
  );
}

export function IdentityMenu() {
  const identity = useIdentity();
  const { go } = usePermits();
  const user = identity.user;
  const [open, setOpen] = useState(false);
  const [security, setSecurity] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [selected, setSelected] = useState("");
  const [pin, setPin] = useState("");
  const [current, setCurrent] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    setPin("");
    setCurrent("");
    setConfirm("");
  }, [user?.id]);

  useEffect(() => {
    if (open) return;
    setPin("");
    setCurrent("");
    setConfirm("");
    setSecurity(false);
    setSwitching(false);
  }, [open]);

  if (!identity.ready || !user) return null;
  const role = adminRoleLine(user);

  const replace = async () => {
    if (!identity.token) {
      setMessage("Plant Link is required to change a PIN.");
      return;
    }
    setMessage("");
    try {
      await changePin(identity.token, current, pin, confirm);
    } catch (error) {
      setCurrent("");
      setPin("");
      setConfirm("");
      setMessage(pinMessage(error));
      return;
    }
    setCurrent("");
    setPin("");
    setConfirm("");
    setMessage("Your Permit Control PIN was changed.");
    try {
      await identity.refresh();
    } catch {
      setMessage("Your Permit Control PIN was changed. Permit Control could not refresh your session.");
    }
  };

  const switchWithPin = async () => {
    setMessage("");
    try {
      await identity.selectUser(selected, pin);
      setSwitching(false);
      setOpen(false);
      setPin("");
      setCurrent("");
      setConfirm("");
    } catch (error) {
      setPin("");
      setMessage(pinMessage(error));
    }
  };

  return (
    <div className="identity" ref={root}>
      <button
        type="button"
        className="identity-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="identity-name">{user.displayName}</span>
        <span className="identity-meta">{role}</span>
      </button>
      {open ? (
        <div className="identity-menu" role="menu">
          <div className="kicker">CURRENT USER</div>
          <strong>{user.displayName}</strong>
          <div className="mono">{user.permitUserCode}</div>
          <div>{user.jobTitle || role}</div>
          <button type="button" role="menuitem" onClick={() => { setOpen(false); setSecurity(false); setSwitching(false); setPin(""); setCurrent(""); setConfirm(""); go("profile"); }}>Profile</button>
          <button type="button" role="menuitem" onClick={() => { setSecurity(true); setSwitching(false); setPin(""); setCurrent(""); setConfirm(""); setMessage(""); }}>Security / Change PIN</button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setSwitching(true);
              setSecurity(false);
              setPin("");
              setCurrent("");
              setConfirm("");
              setMessage("");
              void identity.loadChoices();
            }}
          >
            Switch User
          </button>
          {canPerform(user, "ADMIN") ? (
            <button type="button" role="menuitem" onClick={() => { setOpen(false); go("administration"); }}>Administration</button>
          ) : null}
          {security ? (
            <>
              <PinInput label="Current PIN" purpose="current" value={current} onChange={setCurrent} />
              <PinInput label="New PIN" purpose="new" value={pin} onChange={setPin} />
              <PinInput label="Confirm PIN" purpose="new" value={confirm} onChange={setConfirm} />
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
              <PinInput label="That user's PIN" purpose="current" value={pin} onChange={setPin} />
              <button type="button" className="btn" onClick={() => void switchWithPin()}>Confirm switch</button>
            </>
          ) : null}
          {message ? <p className="form-error">{message}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function needsRefresh(pinState: string): boolean {
  return pinState !== "ACTIVE";
}
