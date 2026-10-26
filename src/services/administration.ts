import { apiRequest } from "../lib/api/client";
import { replaceReferenceCatalog, tauriAvailable, type CatalogCacheRow } from "./localStore";

export interface CatalogItem {
  id: string;
  code: string;
  name: string;
  detail: string | null;
  enabled: boolean;
  displayOrder: number;
  parentId: string | null;
}

export interface CatalogEdit {
  id?: string | null;
  code: string;
  name: string;
  detail?: string | null;
  enabled: boolean;
  displayOrder: number;
  parentId?: string | null;
}

function headers(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export async function listCatalog(token: string, catalog: string) {
  return apiRequest<CatalogItem[]>(`/api/v1/administration/${catalog}`, { headers: headers(token) });
}

export async function saveCatalog(token: string, catalog: string, edit: CatalogEdit) {
  const saved = await apiRequest<CatalogItem>(`/api/v1/administration/${catalog}`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify(edit),
  });
  await cacheCatalog(token, catalog);
  return saved;
}

export async function listFields(token: string) {
  return apiRequest<FieldRecord[]>(`/api/v1/administration/forms/fields`, { headers: headers(token) });
}

export async function saveField(token: string, edit: FieldEdit) {
  return apiRequest<FieldRecord>(`/api/v1/administration/forms/fields`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify(edit),
  });
}

export async function saveChoice(token: string, edit: ChoiceEdit) {
  await apiRequest<unknown>(`/api/v1/administration/forms/choices`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify(edit),
  });
}

export async function publishForm(token: string, pin: string) {
  await apiRequest<unknown>(`/api/v1/administration/forms/publish`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({ pin, deviceId: null }),
  });
}

export async function listRules(token: string) {
  return apiRequest<RuleRecord[]>(`/api/v1/administration/forms/rules`, { headers: headers(token) });
}

export async function saveRule(token: string, rule: RuleEdit, pin: string) {
  await apiRequest<unknown>(`/api/v1/administration/forms/rules`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({ rule, pin, deviceId: null }),
  });
}

export async function listPermitTypes(token: string) {
  return apiRequest<{ code: string; modules: string }[]>(`/api/v1/administration/permit-types`, { headers: headers(token) });
}

export async function publishedVersion(token: string) {
  return apiRequest<number>(`/api/v1/administration/forms/version`, { headers: headers(token) });
}

async function cacheCatalog(token: string, catalog: string) {
  if (!tauriAvailable() || catalog === "areas") return;
  const rows = await listCatalog(token, catalog);
  const cached: CatalogCacheRow[] = rows.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    enabled: row.enabled,
    payload: JSON.stringify({ detail: row.detail, parentId: row.parentId, displayOrder: row.displayOrder }),
  }));
  await replaceReferenceCatalog(catalog, cached);
}

export interface FieldRecord {
  id: string;
  permitType: string;
  moduleKind: string | null;
  code: string;
  label: string;
  helpText: string | null;
  fieldType: string;
  required: boolean;
  displayOrder: number;
  enabled: boolean;
  configurationVersion: number;
  choices: { id: string; code: string; label: string; enabled: boolean; displayOrder: number }[];
}

export interface FieldEdit {
  id?: string | null;
  permitType: string;
  moduleKind?: string | null;
  code: string;
  label: string;
  helpText?: string | null;
  fieldType: string;
  required: boolean;
  displayOrder: number;
  enabled: boolean;
}

export interface ChoiceEdit {
  fieldId: string;
  code: string;
  label: string;
  description?: string | null;
  displayOrder: number;
  enabled: boolean;
}

export interface RuleRecord {
  id: string;
  configurationVersion: number;
  conditionCode: string;
  conditionValue: string;
  action: string;
  actionTarget: string;
  enabled: boolean;
}

export interface RuleEdit {
  conditionCode: string;
  conditionValue: string;
  action: string;
  actionTarget: string;
  enabled: boolean;
}
