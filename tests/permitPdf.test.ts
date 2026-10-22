import { describe, expect, it } from "vitest";
import { openAuthoritativePermitPdf, PermitPdfUnavailable } from "../src/services/permitPdf";

describe("authoritative permit pdf", () => {
  it("does not call the server when plant link is offline", async () => {
    await expect(
      openAuthoritativePermitPdf({
        permitId: "0b6d1a22-1111-4a1b-9c1d-111111111111",
        exportType: "PRINT",
        link: "unreachable",
      }),
    ).rejects.toBeInstanceOf(PermitPdfUnavailable);
  });
});