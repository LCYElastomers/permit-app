import { usePlantClock } from "../plantClock";
import { attentionItems, plantSnapshot } from "../plantStatus";
import { plantLinkLabel, plantLinkLamp } from "../lib/connectivity";
import { useDevice } from "../services/device";
import { usePermits } from "../state/PermitStore";

export function FieldHome() {
  const { permits, drafts, go, showActive, openPermit } = usePermits();
  const { link, local } = useDevice();
  const clock = usePlantClock();
  const snap = plantSnapshot(permits, clock.hm);
  const pendingSync = local.status === "available" ? local.pendingCount : 0;
  const attention = attentionItems(permits, clock.hm).slice(0, 4);

  return (
    <div className="screen field-home">
      <section className="field-home-link" aria-label="Plant Link">
        <div className="kicker">PLANT LINK</div>
        <div className="field-home-state">
          <span className={`lamp lamp-${plantLinkLamp(link.link)}`} />
          <strong>{plantLinkLabel(link.link)}</strong>
        </div>
        <div className="field-home-sync mono">SYNC · {pendingSync} PENDING</div>
      </section>
      <button type="button" className="btn field-home-create" onClick={() => go("new")}>
        + Create New Permit
      </button>
      <section aria-label="My work">
        <div className="kicker">MY WORK</div>
        <div className="field-home-work">
          <button type="button" onClick={() => go("drafts")}>
            <span className="n">{drafts.length}</span> Drafts
          </button>
          <button type="button" onClick={() => go("pending")}>
            <span className="n">{snap.pending}</span> Pending Review
          </button>
          <button type="button" onClick={() => showActive("all")}>
            <span className="n">{snap.active}</span> Active
          </button>
        </div>
      </section>
      <section aria-label="Attention">
        <div className="kicker">ATTENTION</div>
        {attention.length === 0 ? <p className="empty">No operational attention items.</p> : null}
        {attention.map((item) => (
          <button key={item.id} type="button" className="permit-row" onClick={() => openPermit(item.id, "command")}>
            <div className="row-top">
              <span className="pid mono">{item.id}</span>
              <span className="kind">{item.kicker}</span>
            </div>
            <div className="row-work">{item.summary}</div>
            <div className="screen-meta">{item.place}</div>
          </button>
        ))}
      </section>
    </div>
  );
}
