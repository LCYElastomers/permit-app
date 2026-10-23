import { invoke } from "@tauri-apps/api/core";
import { permitApiBaseUrl, apiRequest } from "../lib/api/client";
import { ApiError, ApiTransportError } from "../lib/api/errors";
import type { PlantLink } from "../lib/connectivity";

export type PermitPdfExportType = "PRINT" | "SNAPSHOT";

export interface PermitPdfReceipt {
  id: string;
  permitId: string;
  permitRevision: number;
  exportType: string;
  mimeType: string;
  fileSize: number;
  sha256: string;
  generatedAt: string;
  filename: string;
}

const PDF_TIMEOUT_MS = 15_000;

export class PermitPdfUnavailable extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermitPdfUnavailable";
  }
}

export async function openAuthoritativePermitPdf(input: {
  permitId: string;
  exportType: PermitPdfExportType;
  link: PlantLink;
}): Promise<void> {
  if (input.link !== "ready") {
    throw new PermitPdfUnavailable(
      "Authoritative PDF unavailable while Plant Link is offline.",
    );
  }

  const receipt = await apiRequest<PermitPdfReceipt>(
    `/api/v1/permits/${input.permitId}/exports/pdf`,
    {
      method: "POST",
      body: JSON.stringify({ exportType: input.exportType }),
    },
    PDF_TIMEOUT_MS,
  );
  if (!receipt.id || !receipt.filename || receipt.filename.includes("/") || receipt.filename.includes("\\")) {
    throw new PermitPdfUnavailable("The server document could not be generated. The permit on this device is unchanged.");
  }

  const response = await fetch(`${permitApiBaseUrl}/api/v1/permit-exports/${receipt.id}/content`, {
    headers: { Accept: "application/pdf" },
    signal: AbortSignal.timeout(PDF_TIMEOUT_MS),
  });
  if (!response.ok) throw new ApiError(response.status);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length < 5 || String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3], bytes[4]) !== "%PDF-") {
    throw new ApiTransportError("malformed");
  }

  try {
    await invoke("open_permit_pdf", { filename: receipt.filename, bytes: Array.from(bytes) });
  } catch {
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = receipt.filename;
    link.click();
    URL.revokeObjectURL(url);
  }
}
