import { describe, expect, it, vi } from "vitest";
import { initialPermits } from "../src/data/mock";
import { documentActionPlacement } from "../src/services/permitDocumentActions";
import {
  AUTHORITATIVE_PDF_OFFLINE,
  STATION_PDF_UNAVAILABLE,
  authoritativeDocumentTarget,
  authoritativePdfNotice,
  detailDocumentTarget,
  detailFromRouteExposesDocuments,
  draftDocumentTarget,
  permitDetailExposesDocumentActions,
  PERMIT_DETAIL_ENTRY_ROUTES,
  requestAuthoritativePdf,
} from "../src/services/permitDocumentActions";
import { openAuthoritativePermitPdf, PermitPdfUnavailable } from "../src/services/permitPdf";
import type { PermitKind } from "../src/types";

const serverId = "0b6d1a22-1111-4a1b-9c1d-111111111111";

function real(status: string) {
  return {
    kind: "general" as PermitKind,
    authority: "authoritative" as const,
    serverPermitId: serverId,
    status,
  };
}

describe("authoritative permit pdf", () => {
  it("keeps the permit readable when plant link is offline", async () => {
    const permit = { ...real("active") };
    const before = { ...permit };
    expect(authoritativePdfNotice("unreachable")).toBe(AUTHORITATIVE_PDF_OFFLINE);
    expect(permit).toEqual(before);
    await expect(
      openAuthoritativePermitPdf({ permitId: serverId, exportType: "PRINT", link: "unreachable" }),
    ).rejects.toThrow(AUTHORITATIVE_PDF_OFFLINE);
    await expect(
      openAuthoritativePermitPdf({ permitId: serverId, exportType: "PRINT", link: "unreachable" }),
    ).rejects.toBeInstanceOf(PermitPdfUnavailable);
  });

  it("exposes document actions on real permit detail for active, pending, suspended, and draft", () => {
    expect(PERMIT_DETAIL_ENTRY_ROUTES).toEqual(["active", "pending", "suspended", "drafts", "archive"]);
    expect(PERMIT_DETAIL_ENTRY_ROUTES).not.toContain("new");
    expect(detailFromRouteExposesDocuments("active", real("active"))).toBe(true);
    expect(detailFromRouteExposesDocuments("pending", real("pending"))).toBe(true);
    expect(detailFromRouteExposesDocuments("suspended", real("suspended"))).toBe(true);
    expect(detailFromRouteExposesDocuments("drafts", real("draft"))).toBe(true);
    expect(detailFromRouteExposesDocuments("archive", real("closed"))).toBe(true);
    expect(permitDetailExposesDocumentActions(real("active"))).toBe(true);
    expect(detailFromRouteExposesDocuments("new", real("active"))).toBe(false);
    expect(draftDocumentTarget({ id: serverId, kind: "general", permitNumber: "PTW-2026-00001" })?.permitId).toBe(
      detailDocumentTarget(real("draft"))?.permitId,
    );
  });

  it("shows print on existing active permits without calling the export API for sample records", async () => {
    const open = vi.fn();
    const active = initialPermits.filter((permit) => permit.status === "active");
    expect(active.length).toBeGreaterThan(0);
    for (const permit of active) {
      expect(permit.authority).toBe("sample");
      expect(detailFromRouteExposesDocuments("active", permit)).toBe(true);
      expect(detailDocumentTarget(permit).permitId).toBeNull();
      await expect(
        requestAuthoritativePdf(
          {
            serverPermitId: permit.id,
            kind: permit.kind,
            authority: permit.authority ?? "sample",
            status: permit.status,
          },
          "PRINT",
          "ready",
          open,
        ),
      ).rejects.toThrow(STATION_PDF_UNAVAILABLE);
    }
    expect(detailDocumentTarget({ kind: "general", authority: "sample", serverPermitId: "PTW-2026-00142", status: "active" }).permitId).toBeNull();
    expect(detailDocumentTarget({ kind: "general", authority: "sample", serverPermitId: serverId, status: "active" }).permitId).toBeNull();
    expect(authoritativeDocumentTarget({ serverPermitId: "PTW-2026-00142", kind: "general", authority: "authoritative", status: "ACTIVE" })).toBeNull();
    await expect(
      requestAuthoritativePdf(
        { serverPermitId: "PTW-2026-00142", kind: "general", authority: "authoritative", status: "ACTIVE" },
        "PRINT",
        "ready",
        open,
      ),
    ).rejects.toThrow(STATION_PDF_UNAVAILABLE);
    expect(open).not.toHaveBeenCalled();
  });

  it("uses a header toolbar on desktop and a documents block on tablet", () => {
    expect(documentActionPlacement("desktop")).toBe("toolbar");
    expect(documentActionPlacement("portrait")).toBe("documents");
    expect(documentActionPlacement("landscape")).toBe("documents");
  });
});
