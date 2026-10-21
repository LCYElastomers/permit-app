import { usePermits } from "../state/PermitStore";
import { kindShort } from "../workflow";
import { ScreenHead } from "../components/ui";

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
          const place = [permit.area, permit.location || permit.equipment].filter(Boolean).join(" / ");
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
                    SUSPENDED {permit.suspension?.time}
                  </span>
                </span>
              </div>
              <div className="hold-place mono">{place}</div>
              <div className="reason">
                <div className="k">Reason</div>
                <p>{permit.suspension?.reason}</p>
              </div>
              <div className="hold-meta">
                <span>Suspended by {permit.suspension?.by}</span>
                <span className="mono">Previous status {permit.suspension?.previous}</span>
              </div>
            </button>
          );
        })
      )}
    </div>
  );
}
