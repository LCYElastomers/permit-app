import { resolveApiBaseUrl, API_TIMEOUT_MS } from "./config";
import { ApiError, ApiTransportError } from "./errors";

export { ApiError, ApiTransportError } from "./errors";

export const permitApiBaseUrl = resolveApiBaseUrl(import.meta.env.VITE_PERMIT_API_URL);

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const timeout = AbortSignal.timeout(API_TIMEOUT_MS);
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

  if (!response.ok) throw new ApiError(response.status);

  try {
    return (await response.json()) as T;
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
