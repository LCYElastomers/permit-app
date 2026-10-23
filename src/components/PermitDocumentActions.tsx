import { useState } from "react";
import { useDevice } from "../services/device";
import { requestAuthoritativePdf, type DocumentActionTarget } from "../services/permitDocumentActions";
import { PermitPdfUnavailable, type PermitPdfExportType } from "../services/permitPdf";

export function PermitDocumentActions({ target }: { target: DocumentActionTarget | null }) {
  const { link } = useDevice();
  const [message, setMessage] = useState("");
  if (!target) return null;

  const request = async (exportType: PermitPdfExportType) => {
    setMessage("");
    try {
      await requestAuthoritativePdf(
        { serverPermitId: target.permitId, kind: "general", sample: false },
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

  return (
    <section className="document-actions document-secondary" aria-label="Documents">
      <div className="kicker">DOCUMENTS</div>
      <p>Printed from the plant record. The PDF states the permit status. It does not change that status.</p>
      <div className="document-buttons">
        <button type="button" className="btn" onClick={() => void request("PRINT")}>
          Print Permit
        </button>
        <button type="button" className="btn" onClick={() => void request("SNAPSHOT")}>
          Export PDF
        </button>
      </div>
      {message ? <p className="document-note">{message}</p> : null}
    </section>
  );
}
