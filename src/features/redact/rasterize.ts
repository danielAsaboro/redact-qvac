import {
  MAX_PDF_PAGES,
  MAX_RASTER_LONG_EDGE,
  validateUploadMeta,
} from "./file-policy";
import type { RasterPage } from "./workflow-domain";

export type SourceInspection = {
  kind: "image";
  mimeType: "image/png" | "image/jpeg";
  pageCount: number;
  encrypted: boolean;
} | {
  kind: "pdf";
  mimeType: "application/pdf";
  pageCount: number;
  encrypted: boolean;
};

export type RasterizeAdapters = {
  inspectPdf(bytes: ArrayBuffer): Promise<{
    pageCount: number;
    encrypted: boolean;
  }>;
  rasterImage(
    bytes: ArrayBuffer,
    mimeType: "image/png" | "image/jpeg",
  ): Promise<RasterPage>;
  rasterPdf(
    bytes: ArrayBuffer,
    maxLongEdge: number,
  ): AsyncIterable<RasterPage>;
};

type Dimensions = { width: number; height: number };

export function scaleWithinLongEdge(
  dimensions: Dimensions,
  maxLongEdge: number,
): Dimensions {
  if (
    dimensions.width <= 0 ||
    dimensions.height <= 0 ||
    maxLongEdge <= 0
  ) {
    throw new Error("Page dimensions must be positive");
  }
  const longEdge = Math.max(dimensions.width, dimensions.height);
  if (longEdge <= maxLongEdge) {
    return { width: dimensions.width, height: dimensions.height };
  }
  const scale = maxLongEdge / longEdge;
  return {
    width: Math.max(1, Math.round(dimensions.width * scale)),
    height: Math.max(1, Math.round(dimensions.height * scale)),
  };
}

export function validatePdfInspection(input: {
  pageCount: number;
  encrypted: boolean;
}): void {
  if (input.encrypted) throw new Error("Choose an unlocked PDF");
  if (!Number.isInteger(input.pageCount) || input.pageCount < 1) {
    throw new Error("This PDF could not be read");
  }
  if (input.pageCount > MAX_PDF_PAGES) {
    throw new Error(`PDFs must contain ${MAX_PDF_PAGES} pages or fewer`);
  }
}

export async function inspectSource(
  file: File,
  adapters: Pick<RasterizeAdapters, "inspectPdf"> = defaultAdapters,
): Promise<SourceInspection> {
  const upload = validateUploadMeta(file);
  if (upload.kind === "image") {
    return {
      ...upload,
      pageCount: 1,
      encrypted: false,
    };
  }

  let pdf: { pageCount: number; encrypted: boolean };
  try {
    pdf = await adapters.inspectPdf(await file.arrayBuffer());
  } catch {
    throw new Error("This PDF could not be read");
  }
  validatePdfInspection(pdf);
  return { ...upload, ...pdf };
}

export async function rasterizeSource(
  file: File,
  inspection: SourceInspection,
  adapters: RasterizeAdapters = defaultAdapters,
): Promise<RasterPage[]> {
  const bytes = await file.arrayBuffer();
  if (inspection.kind === "image") {
    const page = await adapters.rasterImage(bytes, inspection.mimeType);
    return [normalizePage(page, 1, file)];
  }

  validatePdfInspection(inspection);
  const pages: RasterPage[] = [];
  for await (const page of adapters.rasterPdf(bytes, MAX_RASTER_LONG_EDGE)) {
    const expectedPageNumber = pages.length + 1;
    if (page.pageNumber !== expectedPageNumber) {
      throw new Error("Rasterized pages must be returned in page order");
    }
    pages.push(normalizePage(page, expectedPageNumber, file));
  }
  if (pages.length !== inspection.pageCount) {
    throw new Error("The PDF page count changed during preparation");
  }
  return pages;
}

function normalizePage(page: RasterPage, pageNumber: number, file: File) {
  return {
    ...page,
    id: `page-${pageNumber}`,
    documentId: `source-${file.name}-${file.size}`,
    pageNumber,
  };
}

async function canvasPngBytes(canvas: HTMLCanvasElement): Promise<ArrayBuffer> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => {
      if (value) resolve(value);
      else reject(new Error("The page could not be encoded as PNG"));
    }, "image/png");
  });
  return blob.arrayBuffer();
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

const defaultAdapters: RasterizeAdapters = {
  async inspectPdf(bytes) {
    const pdfjs = await loadPdfJs();
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(bytes) });
    try {
      const document = await loadingTask.promise;
      const pageCount = document.numPages;
      return { pageCount, encrypted: false };
    } catch (error) {
      if (
        error instanceof Error &&
        (error.name === "PasswordException" || /password/i.test(error.message))
      ) {
        return { pageCount: 0, encrypted: true };
      }
      throw error;
    } finally {
      await loadingTask.destroy();
    }
  },

  async rasterImage(bytes, mimeType) {
    const bitmap = await createImageBitmap(new Blob([bytes], { type: mimeType }));
    try {
      const dimensions = scaleWithinLongEdge(bitmap, MAX_RASTER_LONG_EDGE);
      const canvas = createCanvas(dimensions.width, dimensions.height);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas is unavailable");
      context.drawImage(bitmap, 0, 0, dimensions.width, dimensions.height);
      return {
        id: "page-1",
        documentId: "pending",
        pageNumber: 1,
        ...dimensions,
        pngBytes: await canvasPngBytes(canvas),
      };
    } finally {
      bitmap.close();
    }
  },

  async *rasterPdf(bytes, maxLongEdge) {
    const pdfjs = await loadPdfJs();
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(bytes) });
    const document = await loadingTask.promise;
    try {
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
        const page = await document.getPage(pageNumber);
        const original = page.getViewport({ scale: 1 });
        const dimensions = scaleWithinLongEdge(original, maxLongEdge);
        const scale = dimensions.width / original.width;
        const viewport = page.getViewport({ scale });
        const canvas = createCanvas(dimensions.width, dimensions.height);
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas is unavailable");
        await page.render({ canvas, canvasContext: context, viewport }).promise;
        yield {
          id: `page-${pageNumber}`,
          documentId: "pending",
          pageNumber,
          ...dimensions,
          pngBytes: await canvasPngBytes(canvas),
        };
        page.cleanup();
      }
    } finally {
      await loadingTask.destroy();
    }
  },
};

async function loadPdfJs() {
  const pdfjs = await import("pdfjs-dist");
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
  }
  return pdfjs;
}
