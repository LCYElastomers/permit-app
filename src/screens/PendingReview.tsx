import { usePermits } from "../state/PermitStore";
import { permitType } from "../permitTypes";
import { kindShort } from "../workflow";
import { Kv, ScreenHead, StateMark } from "../components/ui";

export function PendingReview() {
  const { permits, openPermit } = usePermits();
  const pending = permits
    .filter((permit) => permit.status === "pending")
    .slice()
    .sort((a, b) => b.id.localeCompare(a.id));

  return (
    <div className="screen">
      <ScreenHead
        kicker="OPERATIONS"
        title="Pending Review"
        meta={`${pending.length} AWAITING SIGN-OFF`}
      />
      {pending.length === 0 ? (
        <p className="empty">No permits are waiting for review.</p>
      ) : (
        pending.map((permit) => {
          const outstanding = permit.signoffs.filter((signoff) => signoff.state === "outstanding");
          const signed = permit.signoffs.filter((signoff) => signoff.state === "signed");
          const place =
            permitType(permit.kind).place === "location" ? permit.location || permit.equipment : permit.equipment || permit.location;
          return (
            <button
              key={permit.id}
              type="button"
              className="permit-row is-pending"
              onClick={() => openPermit(permit.id, "pending")}
            >
              <div className="row-top">
                <span className="pid mono">{permit.id}</span>
                <span className="kind">{kindShort(permit.kind)}</span>
                <span className="row-status">
                  <span className="soon-tag">
                    {outstanding.length} OUTSTANDING
                  </span>
                  <StateMark status={permit.status} />
                </span>
              </div>
              <div className="row-work">{permit.work}</div>
              <div className="row-fields">
                <div className="row-band">
                  <Kv label="Area" value={permit.area} />
                  <Kv label={permitType(permit.kind).place === "location" ? "Location" : "Equipment"} value={place} mono />
                  <Kv label="Work Order" value={permit.workOrder} mono />
                </div>
                <div className="row-band">
                  <Kv label="Company" value={permit.company} />
                  <Kv label="Requester" value={permit.requester || permit.requesterGroup} />
                  <Kv label="Signed" value={`${signed.length} of ${permit.signoffs.length}`} />
                </div>
              </div>
              <div className="sig-row">
                {permit.signoffs.map((signoff) => (
                  <span key={signoff.role} className={signoff.state === "signed" ? "sig ok" : "sig wait"}>
                    {signoff.role}
                    {signoff.state === "signed" ? ` ${signoff.time}` : " — OUTSTANDING"}
                  </span>
                ))}
              </div>
            </button>
          );
        })
      )}
    </div>
  );
}
