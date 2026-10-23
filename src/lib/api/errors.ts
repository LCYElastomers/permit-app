export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code = "request-failed") {
    super("request failed");
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export type TransportKind = "timeout" | "offline" | "tls" | "malformed";

export class ApiTransportError extends Error {
  readonly kind: TransportKind;

  constructor(kind: TransportKind) {
    super(kind);
    this.name = "ApiTransportError";
    this.kind = kind;
  }
}
