import { useState } from "react";
import { contractors } from "../data/mock";
import { usePermits } from "../state/PermitStore";
import { ScreenHead } from "../components/ui";

export function ContractorsScreen() {
  const { permits, openPermit } = usePermits();
  const [selected, setSelected] = useState(contractors[0]?.id ?? "");
  const contractor = contractors.find((item) => item.id === selected) ?? contractors[0];
  const linked = contractor
    ? permits.filter(
        (permit) =>
          permit.company === contractor.name &&
          (permit.status === "active" || permit.status === "pending" || permit.status === "suspended"),
      )
    : [];

  return (
    <div className="screen fill">
      <ScreenHead kicker="ADMINISTRATION" title="Contractors" meta={`${contractors.length} COMPANIES`} />
      <div className="split">
        <div className="table-scroll">
          <table className="reg">
            <thead>
              <tr>
                <th>ID</th>
                <th>Company</th>
                <th>Service</th>
                <th>Insurance</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {contractors.map((item) => (
                <tr
                  key={item.id}
                  className={item.id === contractor?.id ? "is-selected" : ""}
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
                  <td>{item.service}</td>
                  <td className="mono">{item.insurance}</td>
                  <td className={item.status === "hold" ? "warn" : "pass"}>{item.status === "hold" ? "HOLD" : "APPROVED"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {contractor ? (
          <aside className="spec">
            <div className="kicker">{contractor.id}</div>
            <h2>{contractor.name}</h2>
            <dl className="spec-list">
              <div>
                <dt>Service</dt>
                <dd>{contractor.service}</dd>
              </div>
              <div>
                <dt>Contact</dt>
                <dd>{contractor.contact}</dd>
              </div>
              <div>
                <dt>Phone</dt>
                <dd className="mono">{contractor.phone}</dd>
              </div>
              <div>
                <dt>Orientation</dt>
                <dd>{contractor.orientation}</dd>
              </div>
            </dl>
            <div className="subhead">OPEN PERMITS</div>
            {linked.length === 0 ? (
              <p className="empty tight">No open permits for this company.</p>
            ) : (
              linked.map((permit) => (
                <button key={permit.id} type="button" className="attach" onClick={() => openPermit(permit.id, "contractors")}>
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
