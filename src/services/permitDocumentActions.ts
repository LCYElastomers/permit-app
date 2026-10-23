import type { PlantLink } from "../lib/connectivity";
import type { PermitKind } from "../types";
import { openAuthoritativePermitPdf, type PermitPdfExportType } from "./permitPdf";

const SERVER_PERMIT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface DocumentActionRecord {
  serverPermitId: string | null;
  kind: PermitKind;
  sample: boolean;
  status?: string;
}

export interface DocumentActionTarget {
  permitId: string;
}

export const DOCUMENT_ACTION_ROUTES = [
  { screen: "new", origin: "drafts" },
  { screen: "new", origin: "new" },
  { screen: "detail", origin: "pending" },
  { screen: "detail", origin: "active" },
  { screen: "detail", origin: "suspended" },
  { screen: "detail", origin: "archive" },
] as const;

export type DocumentActionOrigin = (typeof DOCUMENT_ACTION_ROUTES)[number]["origin"];

export function authoritativeDocumentTarget(record: DocumentActionRecord): DocumentActionTarget | null {
  if (record.sample || record.kind !== "general") return null;
  const permitId = record.serverPermitId?.trim() ?? "";
  if (!SERVER_PERMIT_ID.test(permitId)) return null;
  return { permitId };
}

export function draftDocumentTarget(form: { id: string; kind: PermitKind; permitNumber: string | null }): DocumentActionTarget | null {
  if (!form.permitNumber) return null;
  return authoritativeDocumentTarget({ serverPermitId: form.id, kind: form.kind, sample: false });
}

export function detailDocumentTarget(permit: {
  kind: PermitKind;
  serverPermitId?: string | null;
  sample?: boolean;
  status?: string;
}): DocumentActionTarget | null {
  if (permit.sample !== false) return null;
  return authoritativeDocumentTarget({
    serverPermitId: permit.serverPermitId ?? null,
    kind: permit.kind,
    sample: false,
    status: permit.status,
  });
}

export function documentActionsOnRoute(origin: string, record: DocumentActionRecord): boolean {
  if (!DOCUMENT_ACTION_ROUTES.some((route) => route.origin === origin)) return false;
  return authoritativeDocumentTarget(record) !== null;
}

export async function requestAuthoritativePdf(
  record: DocumentActionRecord,
  exportType: PermitPdfExportType,
  link: PlantLink,
  open: typeof openAuthoritativePermitPdf = openAuthoritativePermitPdf,
): Promise<void> {
  const target = authoritativeDocumentTarget(record);
  if (!target) return;
  await open({ permitId: target.permitId, exportType, link });
}
