import { usePermits } from "../state/PermitStore";
import { permitType } from "../permitTypes";
import { kindShort } from "../workflow";
import { Kv, ScreenHead } from "../components/ui";

export function SuspendedScreen() {
  const { permits, openPermit } = usePermits();
  const held = permits.filter((permit) => permit.status === "suspended");

  return (
    <div className="screen">
      <ScreenHead kicker="OPERATIONS" title="Suspended" meta={`${held.length} HELD`} />
      {held.length === 0 ? (
        <p className="empty">No permits are suspended.</p>
      ) : (
        held.map((permit) => {
          const placeLabel = permitType(permit.kind).place === "location" ? "Location" : "Equipment";
          const place =
            permitType(permit.kind).place === "location"
              ? permit.location || permit.equipment
              : permit.equipment || permit.location;
          return (
            <button
              key={permit.id}
              type="button"
              className="permit-row is-hold"
              onClick={() => openPermit(permit.id, "suspended")}
            >
              <div className="row-top">
                <span className="pid mono">{permit.id}</span>
                <span className="kind">{kindShort(permit.kind)}</span>
                <span className="row-status">
                  <span className="state state-alert">
                    <span className="lamp lamp-alert" />
                    SUSPENDED <span className="mono">{permit.suspension?.time}</span>
                  </span>
                </span>
              </div>
              <div className="row-work">{permit.work}</div>
              <div className="row-fields">
                <div className="row-band">
                  <Kv label="Area" value={permit.area} />
                  <Kv label={placeLabel} value={place} mono />
                  <Kv label="Work Order" value={permit.workOrder} mono />
                </div>
                <div className="row-band">
                  <Kv label="Company" value={permit.company} />
                  <Kv label="Requester" value={permit.requesterGroup || permit.requester} />
                </div>
                <div className="row-band row-window">
                  <Kv label="Started" value={permit.started} mono />
                  <Kv label="Expires" value={permit.expires} mono />
                </div>
              </div>
              <div className="reason">
                <div className="k">Reason</div>
                <p>{permit.suspension?.reason}</p>
              </div>
              <div className="hold-meta">
                <span>Suspended by {permit.suspension?.by}</span>
                <span>Previous status {permit.suspension?.previous}</span>
              </div>
            </button>
          );
        })
      )}
    </div>
  );
}
