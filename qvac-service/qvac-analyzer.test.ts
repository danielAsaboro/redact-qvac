// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import { createQvacOcrAnalyzer, type QvacOcrRuntime } from "./qvac-analyzer";

function runtime(blocks: unknown[]): QvacOcrRuntime {
  return {
    loadModel: vi.fn(async () => "ocr-model-1"),
    ocr: vi.fn(() => ({
      blocks: Promise.resolve(blocks),
      stats: Promise.resolve({ totalTime: 0.25 }),
    })),
    unloadModel: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
  };
}

const request = {
  documentId: "document-1",
  pageId: "page-1",
  pageNumber: 1,
  width: 1200,
  height: 1600,
  pngBase64: Buffer.from("png").toString("base64"),
  level: "private" as const,
  direction: "Hide phone numbers",
};

describe("QVAC OCR analyzer", () => {
  it("loads once, analyzes supplied bytes, and returns raw pixel evidence", async () => {
    const qvac = runtime([
      { text: "Maya Chen", bbox: [211, 114, 397, 158], confidence: 0.93 },
      { text: "18 Willow Road", bbox: [187, 334, 410, 365] },
    ]);
    const now = vi
      .fn<() => number>()
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(1250)
      .mockReturnValueOnce(2000)
      .mockReturnValueOnce(2250);
    const analyzer = createQvacOcrAnalyzer({
      runtime: qvac,
      modelSource: { name: "OCR_LATIN" },
      readImageSize: async () => ({ width: 1200, height: 1600 }),
      now,
    });

    const first = await analyzer.analyzePage(request);
    await analyzer.analyzePage(request);

    expect(qvac.loadModel).toHaveBeenCalledOnce();
    expect(qvac.ocr).toHaveBeenCalledWith(
      expect.objectContaining({ image: Buffer.from("png") }),
    );
    expect(first).toMatchObject({
      page: { id: "page-1", number: 1, width: 1200, height: 1600 },
      ocrBlocks: [
        { text: "Maya Chen", bbox: [211, 114, 397, 158], confidence: 0.93 },
        { text: "18 Willow Road", bbox: [187, 334, 410, 365], confidence: null },
      ],
      run: { status: "ready", ocrMs: 250 },
    });
  });

  it("rejects request dimensions that do not match the decoded PNG", async () => {
    const analyzer = createQvacOcrAnalyzer({
      runtime: runtime([]),
      modelSource: {},
      readImageSize: async () => ({ width: 1199, height: 1600 }),
    });

    await expect(analyzer.analyzePage(request)).rejects.toThrow(
      "Raster dimensions do not match",
    );
  });

  it("rejects malformed QVAC blocks before they cross the service boundary", async () => {
    const analyzer = createQvacOcrAnalyzer({
      runtime: runtime([{ text: "Maya Chen", bbox: [1, 2, Number.NaN, 4] }]),
      modelSource: {},
      readImageSize: async () => ({ width: 1200, height: 1600 }),
    });

    await expect(analyzer.analyzePage(request)).rejects.toThrow();
  });

  it("retries vertically fragmented landscape OCR and maps recovered boxes back", async () => {
    const qvac = runtime([]);
    vi.mocked(qvac.ocr)
      .mockReturnValueOnce({
        blocks: Promise.resolve([
          { text: "M", bbox: [100, 100, 110, 170] },
          { text: "a", bbox: [120, 100, 130, 170] },
          { text: "y", bbox: [140, 100, 150, 170] },
          { text: "a", bbox: [160, 100, 170, 170] },
        ]),
        stats: Promise.resolve({}),
      })
      .mockReturnValueOnce({
        blocks: Promise.resolve([
          { text: "Maya Chen", bbox: [200, 100, 400, 150], confidence: 0.9 },
        ]),
        stats: Promise.resolve({}),
      });
    const analyzer = createQvacOcrAnalyzer({
      runtime: qvac,
      modelSource: {},
      readImageSize: async () => ({ width: 1600, height: 1200 }),
      rotateImage: async () => Buffer.from("upright"),
    });

    const response = await analyzer.analyzePage({
      ...request,
      width: 1600,
      height: 1200,
    });

    expect(qvac.ocr).toHaveBeenCalledTimes(2);
    expect(qvac.ocr).toHaveBeenLastCalledWith(
      expect.objectContaining({ image: Buffer.from("upright") }),
    );
    expect(response.ocrBlocks).toEqual([
      { text: "Maya Chen", bbox: [1450, 200, 1500, 400], confidence: 0.9 },
    ]);
  });
});
