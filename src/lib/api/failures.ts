import type { ProbeCall } from "../connectivity";
import { ApiError, ApiTransportError } from "./errors";

export function probeCall(error: unknown): ProbeCall {
  if (error instanceof ApiTransportError) {
    return error.kind === "malformed" ? { outcome: "malformed" } : { outcome: error.kind };
  }
  if (error instanceof ApiError) return { outcome: "http", status: error.status };
  if (error instanceof SyntaxError) return { outcome: "malformed" };
  if (mentionsTls(error)) return { outcome: "tls" };
  return { outcome: "offline" };
}

function mentionsTls(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const text = `${error.name} ${error.message} ${String(error.cause ?? "")}`.toLowerCase();
  return text.includes("cert") || text.includes("ssl") || text.includes("tls");
}
