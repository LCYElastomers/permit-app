import { useState } from "react";
import { templates } from "../data/mock";
import { usePermits } from "../state/PermitStore";
import { kindTitle } from "../workflow";
import { ScreenHead } from "../components/ui";

export function TemplatesScreen() {
  const { applyTemplate } = usePermits();
  const [selected, setSelected] = useState(templates[0]?.id ?? "");
  const template = templates.find((item) => item.id === selected) ?? templates[0];

  return (
    <div className="screen fill">
      <ScreenHead kicker="ADMINISTRATION" title="Templates" meta={`${templates.length} CONTROLLED`} />
      <div className="split">
        <div className="table-scroll">
          <table className="reg">
            <thead>
              <tr>
                <th>Template</th>
                <th>Type</th>
                <th>Rev</th>
                <th>Owner</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((item) => (
                <tr
                  key={item.id}
                  className={item.id === template?.id ? "is-selected" : ""}
                  tabIndex={0}
                  onClick={() => setSelected(item.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelected(item.id);
                    }
                  }}
                >
                  <td>
                    <div className="mono">{item.id}</div>
                    {item.name}
                  </td>
                  <td>{kindTitle(item.kind)}</td>
                  <td className="mono">{item.revision}</td>
                  <td>{item.owner}</td>
                  <td className="mono">{item.updated}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {template ? (
          <aside className="spec">
            <div className="kicker">{template.id}</div>
            <h2>{template.name}</h2>
            <p className="spec-copy">{template.summary}</p>
            <div className="subhead">DEFAULT HAZARDS</div>
            <ul className="taglist hazard">
              {template.hazards.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div className="subhead">DEFAULT CONTROLS</div>
            <ul className="taglist">
              {template.controls.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <button type="button" className="btn" onClick={() => applyTemplate(template.id)}>
              Use Template
            </button>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
