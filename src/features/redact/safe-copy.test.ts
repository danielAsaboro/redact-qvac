import { PDFDocument } from "pdf-lib";
import { describe, expect, it, vi } from "vitest";

import type {
  RasterPage,
  RedactionMark,
  SourceDocument,
} from "./workflow-domain";
import {
  copySafeImage,
  generateSafeCopy,
  markToPixelRect,
  saveGeneratedCopy,
  type CanvasFactory,
} from "./safe-copy";

const onePixelPng = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  ),
);

function source(
  mimeType: SourceDocument["mimeType"] = "image/png",
): SourceDocument {
  const originalBytes = new Uint8Array([9, 8, 7]).buffer;
  return {
    id: "document-1",
    name: mimeType === "application/pdf" ? "report.final.pdf" : "chat.png",
    mimeType,
    byteSize: originalBytes.byteLength,
    pageCount: mimeType === "application/pdf" ? 2 : 1,
    originalBytes,
    originalDigest: "sha256-original",
  };
}

function page(pageNumber: number): RasterPage {
  return {
    id: `page-${pageNumber}`,
    documentId: "document-1",
    pageNumber,
    width: 100,
    height: 100,
    pngBytes: onePixelPng.slice().buffer,
  };
}

function mark(pageNumber = 1): RedactionMark {
  return {
    id: `mark-${pageNumber}`,
    documentId: "document-1",
    pageId: `page-${pageNumber}`,
    pageNumber,
    x: 10,
    y: 20,
    width: 30,
    height: 10,
    label: "name",
    source: "manual",
    createdAt: "2026-08-14T10:00:00.000Z",
  };
}

describe("flattened safe copies", () => {
  it("maps percentage marks to an opaque pixel rectangle", () => {
    expect(markToPixelRect(mark(), { width: 100, height: 100 })).toEqual({
      x: 10,
      y: 20,
      width: 30,
      height: 10,
    });
  });

  it("creates a separate PNG without changing the source bytes", async () => {
    const inputSource = source();
    const originalReference = inputSource.originalBytes;
    const flatten = vi.fn().mockResolvedValue(onePixelPng);

    const copy = await generateSafeCopy({
      source: inputSource,
      pages: [page(1)],
      marks: [mark(1)],
      canvas: { flatten },
    });

    expect(copy.name).toBe("chat.redacted.png");
    expect(copy.mimeType).toBe("image/png");
    expect(copy.pageCount).toBe(1);
    expect(flatten).toHaveBeenCalledWith(page(1), [mark(1)]);
    expect(inputSource.originalBytes).toBe(originalReference);
    expect(inputSource.originalDigest).toBe("sha256-original");
  });

  it("embeds flattened page images into a new multi-page PDF", async () => {
    const canvas: CanvasFactory = {
      flatten: vi.fn().mockResolvedValue(onePixelPng),
    };

    const copy = await generateSafeCopy({
      source: source("application/pdf"),
      pages: [page(1), page(2)],
      marks: [mark(1), mark(2)],
      canvas,
    });
    const output = await PDFDocument.load(await copy.blob.arrayBuffer());

    expect(copy.name).toBe("report.final.redacted.pdf");
    expect(copy.mimeType).toBe("application/pdf");
    expect(copy.pageCount).toBe(2);
    expect(output.getPageCount()).toBe(2);
    expect(canvas.flatten).toHaveBeenCalledTimes(2);
  });

  it("keeps Save available when clipboard permission is denied", async () => {
    const copy = {
      name: "chat.redacted.png",
      mimeType: "image/png" as const,
      blob: new Blob([onePixelPng], { type: "image/png" }),
      pageCount: 1,
    };
    const clipboard = {
      writePng: vi.fn().mockRejectedValue(new Error("NotAllowedError")),
    };
    const downloader = { save: vi.fn() };

    await expect(copySafeImage(copy.blob, clipboard)).rejects.toThrow(
      "NotAllowedError",
    );
    saveGeneratedCopy(copy, downloader);

    expect(downloader.save).toHaveBeenCalledWith(copy.blob, copy.name);
  });
});
