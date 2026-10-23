import { resolveApiBaseUrl, API_TIMEOUT_MS } from "./config";
import { ApiError, ApiTransportError } from "./errors";

export { ApiError, ApiTransportError } from "./errors";

export const permitApiBaseUrl = resolveApiBaseUrl(import.meta.env.VITE_PERMIT_API_URL);

export async function apiRequest<T>(path: string, init?: RequestInit, timeoutMs = API_TIMEOUT_MS): Promise<T> {
  const timeout = AbortSignal.timeout(timeoutMs);
  const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  let response: Response;
  try {
    response = await fetch(`${permitApiBaseUrl}${path}`, {
      ...init,
      signal,
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });
  } catch (error) {
    if (init?.signal?.aborted) throw error;
    if (isTimeout(error)) throw new ApiTransportError("timeout");
    if (mentionsTls(error)) throw new ApiTransportError("tls");
    throw new ApiTransportError("offline");
  }

  if (!response.ok) {
    let code = "request-failed";
    try {
      const body = (await response.json()) as { error?: unknown };
      if (typeof body.error === "string" && body.error.trim()) code = body.error.trim();
    } catch {
      code = "request-failed";
    }
    throw new ApiError(response.status, code);
  }

  if (response.status === 204 || response.status === 205) return undefined as T;
  const text = await response.text();
  if (text.trim().length === 0) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiTransportError("malformed");
  }
}

function isTimeout(error: unknown): boolean {
  return error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError");
}

function mentionsTls(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const text = `${error.name} ${error.message} ${String(error.cause ?? "")}`.toLowerCase();
  return text.includes("cert") || text.includes("ssl") || text.includes("tls");
}
