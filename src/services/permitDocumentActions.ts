import type { Composition } from "../lib/composition";
import type { PlantLink } from "../lib/connectivity";
import type { PermitAuthority, PermitKind } from "../types";
import { openAuthoritativePermitPdf, PermitPdfUnavailable, type PermitPdfExportType } from "./permitPdf";

const SERVER_PERMIT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const AUTHORITATIVE_PDF_OFFLINE = "Authoritative PDF unavailable while Plant Link is offline.";
export const STATION_PDF_UNAVAILABLE =
  "This permit has no plant record, so Permit Control cannot generate its PDF. The permit on this station is unchanged.";
export const GENERAL_WORK_PDF_ONLY = "A server PDF is available for General Work permits. This permit is unchanged.";

export interface DocumentActionRecord {
  serverPermitId: string | null;
  kind: PermitKind;
  authority: PermitAuthority;
  status?: string;
}

export interface DocumentActionTarget {
  permitId: string | null;
  kind: PermitKind;
}

export const PERMIT_DETAIL_ENTRY_ROUTES = ["active", "pending", "suspended", "drafts", "archive"] as const;

export type DocumentActionPlacement = "toolbar" | "documents";

export function documentActionPlacement(composition: Composition): DocumentActionPlacement {
  return composition === "desktop" ? "toolbar" : "documents";
}

export function authoritativePdfNotice(link: PlantLink): string | null {
  return link === "ready" ? null : AUTHORITATIVE_PDF_OFFLINE;
}

export function authoritativeDocumentTarget(record: DocumentActionRecord): DocumentActionTarget | null {
  if (record.authority !== "authoritative") return null;
  const permitId = record.serverPermitId?.trim() ?? "";
  if (!SERVER_PERMIT_ID.test(permitId)) return null;
  return { permitId, kind: record.kind };
}

export function draftDocumentTarget(form: { id: string; kind: PermitKind; permitNumber: string | null }): DocumentActionTarget | null {
  if (!form.permitNumber) return null;
  return authoritativeDocumentTarget({ serverPermitId: form.id, kind: form.kind, authority: "authoritative" });
}

export function detailDocumentTarget(permit: {
  kind: PermitKind;
  serverPermitId?: string | null;
  authority?: PermitAuthority;
  sample?: boolean;
  status?: string;
}): DocumentActionTarget {
  const authority = permit.authority ?? (permit.sample === false ? "authoritative" : "sample");
  const server = authoritativeDocumentTarget({
    serverPermitId: permit.serverPermitId ?? null,
    kind: permit.kind,
    authority,
    status: permit.status,
  });
  return { permitId: server?.permitId ?? null, kind: permit.kind };
}

export function permitDetailExposesDocumentActions(permit: {
  kind: PermitKind;
  serverPermitId?: string | null;
  authority?: PermitAuthority;
  sample?: boolean;
  status?: string;
}): boolean {
  return detailDocumentTarget(permit).kind === permit.kind;
}

export function detailFromRouteExposesDocuments(
  origin: string,
  permit: {
    kind: PermitKind;
    serverPermitId?: string | null;
    authority?: PermitAuthority;
    sample?: boolean;
    status?: string;
  },
): boolean {
  if (!PERMIT_DETAIL_ENTRY_ROUTES.some((route) => route === origin)) return false;
  return permitDetailExposesDocumentActions(permit);
}

export async function requestAuthoritativePdf(
  record: DocumentActionRecord,
  exportType: PermitPdfExportType,
  link: PlantLink,
  open: typeof openAuthoritativePermitPdf = openAuthoritativePermitPdf,
): Promise<void> {
  if (record.authority !== "authoritative") throw new PermitPdfUnavailable(STATION_PDF_UNAVAILABLE);
  const permitId = record.serverPermitId?.trim() ?? "";
  if (!SERVER_PERMIT_ID.test(permitId)) throw new PermitPdfUnavailable(STATION_PDF_UNAVAILABLE);
  await open({ permitId, exportType, link });
}
