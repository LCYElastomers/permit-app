import { useState } from "react";
import { useComposition } from "./Composition";
import { useDevice } from "../services/device";
import {
  authoritativePdfNotice,
  documentActionPlacement,
  requestAuthoritativePdf,
  type DocumentActionPlacement,
  type DocumentActionTarget,
} from "../services/permitDocumentActions";
import { PermitPdfUnavailable, type PermitPdfExportType } from "../services/permitPdf";

export function PermitDocumentActions({
  target,
  placement,
}: {
  target: DocumentActionTarget | null;
  placement?: DocumentActionPlacement;
}) {
  const composition = useComposition();
  const { link } = useDevice();
  const [message, setMessage] = useState("");
  const resolved = placement ?? documentActionPlacement(composition);
  if (!target) return null;

  const offline = authoritativePdfNotice(link.link);
  const request = async (exportType: PermitPdfExportType) => {
    setMessage("");
    try {
      await requestAuthoritativePdf(
        {
          serverPermitId: target.permitId,
          kind: target.kind,
          authority: target.permitId ? "authoritative" : "sample",
        },
        exportType,
        link.link,
      );
      setMessage(
        exportType === "PRINT"
          ? "The server PDF is open. Print it from the PDF window. The copy shows the permit status stored on the plant record."
          : "The server PDF is open. The copy shows the permit status stored on the plant record.",
      );
    } catch (error) {
      setMessage(
        error instanceof PermitPdfUnavailable
          ? error.message
          : "The server document could not be generated. The permit on this device is unchanged.",
      );
    }
  };

  const note = message || offline;
  if (resolved === "toolbar") {
    return (
      <div className="document-toolbar" aria-label="Documents">
        <button type="button" className="btn btn-ghost" onClick={() => void request("PRINT")}>
          View PDF
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => void request("PRINT")}>
          Print Permit
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => void request("SNAPSHOT")}>
          Export PDF
        </button>
        {note ? <p className="document-note">{note}</p> : null}
      </div>
    );
  }

  return (
    <section className="document-actions document-secondary" aria-label="Documents">
      <div className="kicker">DOCUMENTS</div>
      <p>Printed from the plant record. The PDF states the permit status. It does not change that status.</p>
      <div className="document-buttons">
        <button type="button" className="btn btn-ghost" onClick={() => void request("PRINT")}>
          View Permit PDF
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => void request("PRINT")}>
          Print Permit
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => void request("SNAPSHOT")}>
          Export PDF
        </button>
      </div>
      {note ? <p className="document-note">{note}</p> : null}
    </section>
  );
}
