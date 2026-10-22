import { describe, expect, it } from "vitest";
import { resolveComposition } from "../src/lib/composition";

describe("composition", () => {
  it("uses portrait for an upright tablet", () => {
    expect(
      resolveComposition({ width: 1200, height: 1920, orientation: "portrait", coarsePointer: true }),
    ).toBe("portrait");
  });

  it("keeps a wide touch landscape tablet in the field landscape composition", () => {
    expect(
      resolveComposition({ width: 1920, height: 1200, orientation: "landscape", coarsePointer: true }),
    ).toBe("landscape");
  });

  it("uses desktop for a wide fine pointer", () => {
    expect(
      resolveComposition({ width: 1920, height: 1080, orientation: "landscape", coarsePointer: false }),
    ).toBe("desktop");
  });

  it("uses landscape for a medium fine-pointer window", () => {
    expect(
      resolveComposition({ width: 1280, height: 800, orientation: "landscape", coarsePointer: false }),
    ).toBe("landscape");
  });

  it("uses portrait when the window is narrow", () => {
    expect(
      resolveComposition({ width: 700, height: 900, orientation: "landscape", coarsePointer: false }),
    ).toBe("portrait");
  });
});
