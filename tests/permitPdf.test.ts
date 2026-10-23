import { describe, expect, it, vi } from "vitest";
import { initialPermits } from "../src/data/mock";
import {
  authoritativeDocumentTarget,
  detailDocumentTarget,
  DOCUMENT_ACTION_ROUTES,
  documentActionsOnRoute,
  draftDocumentTarget,
  requestAuthoritativePdf,
} from "../src/services/permitDocumentActions";
import { openAuthoritativePermitPdf, PermitPdfUnavailable } from "../src/services/permitPdf";
import type { PermitKind } from "../src/types";

const serverId = "0b6d1a22-1111-4a1b-9c1d-111111111111";
const statuses = [
  "DRAFT",
  "PENDING_REVIEW",
  "AUTHORIZED",
  "ACTIVE",
  "SUSPENDED",
  "EXPIRED",
  "CANCELLED",
  "CLOSED",
  "SUPERSEDED",
  "UNRECOGNIZED",
];

describe("authoritative permit pdf", () => {
  it("does not call the server when plant link is offline", async () => {
    await expect(
      openAuthoritativePermitPdf({
        permitId: serverId,
        exportType: "PRINT",
        link: "unreachable",
      }),
    ).rejects.toBeInstanceOf(PermitPdfUnavailable);
  });

  it("offers print and export for every server status on the shared detail routes", () => {
    const origins = DOCUMENT_ACTION_ROUTES.map((route) => route.origin);
    expect(origins).toEqual(["drafts", "new", "pending", "active", "suspended", "archive"]);
    for (const status of statuses) {
      const record = { serverPermitId: serverId, kind: "general" as PermitKind, sample: false, status };
      for (const origin of origins) {
        expect(documentActionsOnRoute(origin, record)).toBe(true);
      }
    }
    expect(draftDocumentTarget({ id: serverId, kind: "general", permitNumber: "PTW-2026-00001" })?.permitId).toBe(serverId);
    expect(detailDocumentTarget({ kind: "general", serverPermitId: serverId, sample: false, status: "active" })?.permitId).toBe(serverId);
    expect(detailDocumentTarget({ kind: "general", serverPermitId: serverId, sample: false, status: "suspended" })?.permitId).toBe(serverId);
  });

  it("does not call the export API for mock or unsupported permits", async () => {
    const open = vi.fn();
    for (const permit of initialPermits) {
      expect(detailDocumentTarget(permit)).toBeNull();
      await requestAuthoritativePdf(
        { serverPermitId: permit.serverPermitId ?? permit.id, kind: permit.kind, sample: permit.sample !== false, status: permit.status },
        "PRINT",
        "ready",
        open,
      );
    }
    await requestAuthoritativePdf(
      { serverPermitId: serverId, kind: "hot-work", sample: false, status: "ACTIVE" },
      "PRINT",
      "ready",
      open,
    );
    await requestAuthoritativePdf(
      { serverPermitId: null, kind: "general", sample: false, status: "ACTIVE" },
      "PRINT",
      "ready",
      open,
    );
    expect(authoritativeDocumentTarget({ serverPermitId: "PTW-2026-00142", kind: "general", sample: false, status: "ACTIVE" })).toBeNull();
    expect(open).not.toHaveBeenCalled();
  });
});
