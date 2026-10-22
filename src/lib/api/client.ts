const configured = import.meta.env.VITE_PERMIT_API_URL?.trim();

export const permitApiBaseUrl = (configured && configured.length > 0 ? configured : "http://127.0.0.1:5080").replace(/\/$/, "");

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${permitApiBaseUrl}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new ApiError(response.status, `${response.status} ${path}`);
  }

  return (await response.json()) as T;
}
