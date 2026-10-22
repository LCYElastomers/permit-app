export const PRODUCTION_API_URL = "https://permit-control.local";

export const API_TIMEOUT_MS = 5_000;

export const CONNECTIVITY_POLL_MS = 30_000;

export function resolveApiBaseUrl(configured: string | undefined): string {
  const value = configured?.trim();
  const base = value && value.length > 0 ? value : PRODUCTION_API_URL;
  return base.replace(/\/$/, "");
}
