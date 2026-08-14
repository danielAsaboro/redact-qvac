import { describe, expect, it } from "vitest";

import { normalizeOcrBbox } from "./ocr-geometry";

describe("OCR geometry normalization", () => {
  it("converts pixel edges to the editor percentage system", () => {
    expect(normalizeOcrBbox([211, 114, 397, 158], 1200, 1600)).toEqual({
      x: 17.583333,
      y: 7.125,
      width: 15.5,
      height: 2.75,
    });
  });

  it("sorts reversed edges and clips them to the decoded raster", () => {
    expect(normalizeOcrBbox([1300, 1700, -100, -200], 1200, 1600)).toEqual({
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
  });

  it("rejects non-finite, zero-area, fully clipped, and invalid-source geometry", () => {
    expect(normalizeOcrBbox([0, 0, Number.NaN, 10], 1200, 1600)).toBeNull();
    expect(normalizeOcrBbox([10, 10, 10, 40], 1200, 1600)).toBeNull();
    expect(normalizeOcrBbox([-20, -20, -10, -10], 1200, 1600)).toBeNull();
    expect(() => normalizeOcrBbox([0, 0, 10, 10], 0, 1600)).toThrow(
      "Source dimensions must be positive",
    );
  });
});
