export class ApiError extends Error {
  readonly status: number;

  constructor(status: number) {
    super("request failed");
    this.name = "ApiError";
    this.status = status;
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
