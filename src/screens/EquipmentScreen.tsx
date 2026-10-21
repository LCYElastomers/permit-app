import { useState } from "react";
import { assets } from "../data/mock";
import { usePermits } from "../state/PermitStore";
import { ScreenHead } from "../components/ui";

const STATUS_LABEL = {
  "in-service": "IN SERVICE",
  isolated: "ISOLATED",
  "out-of-service": "OUT OF SERVICE",
} as const;

export function EquipmentScreen() {
  const { permits, openPermit } = usePermits();
  const [selected, setSelected] = useState(assets[0]?.id ?? "");
  const asset = assets.find((item) => item.id === selected) ?? assets[0];
  const linked = asset
    ? permits.filter(
        (permit) =>
          permit.equipment === asset.id &&
          (permit.status === "active" || permit.status === "pending" || permit.status === "suspended"),
      )
    : [];

  return (
    <div className="screen fill">
      <ScreenHead kicker="ADMINISTRATION" title="Equipment" meta={`${assets.length} ASSETS`} />
      <div className="split">
        <div className="table-scroll">
          <table className="reg">
            <thead>
              <tr>
                <th>ID</th>
                <th>Asset</th>
                <th>Area</th>
                <th>Service</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((item) => (
                <tr
                  key={item.id}
                  className={item.id === asset?.id ? "is-selected" : ""}
                  tabIndex={0}
                  onClick={() => setSelected(item.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelected(item.id);
                    }
                  }}
                >
                  <td className="mono">{item.id}</td>
                  <td>{item.name}</td>
                  <td>{item.area}</td>
                  <td>{item.service}</td>
                  <td className={item.status === "in-service" ? "pass" : "warn"}>{STATUS_LABEL[item.status]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {asset ? (
          <aside className="spec">
            <div className="kicker">{asset.area}</div>
            <h2 className="mono">{asset.id}</h2>
            <p className="spec-copy">{asset.name}</p>
            <dl className="spec-list">
              <div>
                <dt>Service</dt>
                <dd>{asset.service}</dd>
              </div>
              <div>
                <dt>Isolation</dt>
                <dd className="mono">{asset.isolation}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{STATUS_LABEL[asset.status]}</dd>
              </div>
            </dl>
            <div className="subhead">LINKED PERMITS</div>
            {linked.length === 0 ? (
              <p className="empty tight">No open permit references this asset.</p>
            ) : (
              linked.map((permit) => (
                <button key={permit.id} type="button" className="attach" onClick={() => openPermit(permit.id, "equipment")}>
                  <span className="mono">{permit.id}</span>
                  <span className="muted">{permit.work}</span>
                </button>
              ))
            )}
          </aside>
        ) : null}
      </div>
    </div>
  );
}
