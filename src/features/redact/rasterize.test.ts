import { describe, expect, it, vi } from "vitest";

import {
  inspectSource,
  rasterizeSource,
  scaleWithinLongEdge,
  validatePdfInspection,
  type RasterizeAdapters,
} from "./rasterize";

function pngPage(pageNumber: number) {
  return {
    id: `page-${pageNumber}`,
    documentId: "document-1",
    pageNumber,
    width: 1200,
    height: 800,
    pngBytes: new Uint8Array([137, 80, 78, 71, pageNumber]).buffer,
  };
}

describe("local source rasterization", () => {
  it("scales landscape and portrait pages within the configured long edge", () => {
    expect(scaleWithinLongEdge({ width: 4800, height: 3200 }, 2400)).toEqual({
      width: 2400,
      height: 1600,
    });
    expect(scaleWithinLongEdge({ width: 1000, height: 2000 }, 2400)).toEqual({
      width: 1000,
      height: 2000,
    });
  });

  it("copies native non-enumerable image dimensions into a plain result", () => {
    const nativeDimensions = Object.defineProperties({}, {
      width: { value: 1200, enumerable: false },
      height: { value: 1600, enumerable: false },
    }) as { width: number; height: number };

    const scaled = scaleWithinLongEdge(nativeDimensions, 2400);

    expect(Object.keys(scaled)).toEqual(["width", "height"]);
    expect(scaled).toEqual({ width: 1200, height: 1600 });
  });

  it("rejects oversized and encrypted PDFs", () => {
    expect(() =>
      validatePdfInspection({ pageCount: 26, encrypted: false }),
    ).toThrow("PDFs must contain 25 pages or fewer");
    expect(() =>
      validatePdfInspection({ pageCount: 1, encrypted: true }),
    ).toThrow("Choose an unlocked PDF");
  });

  it("inspects PDFs through the injected local adapter", async () => {
    const inspectPdf = vi.fn().mockResolvedValue({
      pageCount: 2,
      encrypted: false,
    });
    const file = new File([new Uint8Array([1, 2, 3])], "statement.pdf", {
      type: "application/pdf",
    });

    await expect(inspectSource(file, { inspectPdf })).resolves.toEqual({
      kind: "pdf",
      mimeType: "application/pdf",
      pageCount: 2,
      encrypted: false,
    });
    expect(inspectPdf).toHaveBeenCalledOnce();
  });

  it("rasterizes PDF pages sequentially and preserves page order", async () => {
    const events: string[] = [];
    const adapters: RasterizeAdapters = {
      inspectPdf: vi.fn(),
      rasterImage: vi.fn(),
      async *rasterPdf() {
        events.push("page-1:start");
        yield pngPage(1);
        events.push("page-1:done");
        events.push("page-2:start");
        yield pngPage(2);
        events.push("page-2:done");
      },
    };
    const file = new File([new Uint8Array([1, 2, 3])], "statement.pdf", {
      type: "application/pdf",
    });

    const pages = await rasterizeSource(
      file,
      {
        kind: "pdf",
        mimeType: "application/pdf",
        pageCount: 2,
        encrypted: false,
      },
      adapters,
    );

    expect(pages).toHaveLength(2);
    expect(pages.map((page) => page.pageNumber)).toEqual([1, 2]);
    expect(events).toEqual([
      "page-1:start",
      "page-1:done",
      "page-2:start",
      "page-2:done",
    ]);
  });

  it("rejects adapters that return missing or out-of-order pages", async () => {
    const adapters: RasterizeAdapters = {
      inspectPdf: vi.fn(),
      rasterImage: vi.fn(),
      async *rasterPdf() {
        yield pngPage(2);
      },
    };
    const file = new File([new Uint8Array([1])], "statement.pdf", {
      type: "application/pdf",
    });

    await expect(
      rasterizeSource(
        file,
        {
          kind: "pdf",
          mimeType: "application/pdf",
          pageCount: 1,
          encrypted: false,
        },
        adapters,
      ),
    ).rejects.toThrow("Rasterized pages must be returned in page order");
  });
});
