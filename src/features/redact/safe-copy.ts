import { PDFDocument } from "pdf-lib";

import { safeOutputName } from "./file-policy";
import type {
  RasterPage,
  RedactionMark,
  SourceDocument,
} from "./workflow-domain";

export type GeneratedCopy = {
  name: string;
  mimeType: "image/png" | "application/pdf";
  blob: Blob;
  pageCount: number;
};

export type CanvasFactory = {
  flatten(page: RasterPage, marks: RedactionMark[]): Promise<Uint8Array>;
};

export type ClipboardWriter = {
  writePng(blob: Blob): Promise<void>;
};

export type Downloader = {
  save(blob: Blob, filename: string): void;
};

export function markToPixelRect(
  mark: Pick<RedactionMark, "x" | "y" | "width" | "height">,
  page: Pick<RasterPage, "width" | "height">,
) {
  const left = Math.max(0, Math.floor((mark.x / 100) * page.width));
  const top = Math.max(0, Math.floor((mark.y / 100) * page.height));
  const right = Math.min(
    page.width,
    Math.ceil(((mark.x + mark.width) / 100) * page.width),
  );
  const bottom = Math.min(
    page.height,
    Math.ceil(((mark.y + mark.height) / 100) * page.height),
  );
  return {
    x: left,
    y: top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

export async function generateSafeCopy(input: {
  source: SourceDocument;
  pages: RasterPage[];
  marks: RedactionMark[];
  canvas?: CanvasFactory;
}): Promise<GeneratedCopy> {
  if (input.pages.length === 0) {
    throw new Error("At least one prepared page is required");
  }
  const canvas = input.canvas ?? browserCanvasFactory;
  const flattenedPages: Uint8Array[] = [];
  for (const page of input.pages) {
    const pageMarks = input.marks.filter(
      (mark) => mark.pageId === page.id || mark.pageNumber === page.pageNumber,
    );
    flattenedPages.push(await canvas.flatten(page, pageMarks));
  }

  if (input.source.mimeType !== "application/pdf") {
    const bytes = flattenedPages[0];
    return {
      name: safeOutputName(input.source.name, "png"),
      mimeType: "image/png",
      blob: new Blob([copyArrayBuffer(bytes)], { type: "image/png" }),
      pageCount: 1,
    };
  }

  const document = await PDFDocument.create();
  document.setProducer("Redact local safe-copy generator");
  document.setCreator("Redact");
  for (let index = 0; index < flattenedPages.length; index += 1) {
    const sourcePage = input.pages[index];
    const embedded = await document.embedPng(flattenedPages[index]);
    const outputPage = document.addPage([sourcePage.width, sourcePage.height]);
    outputPage.drawImage(embedded, {
      x: 0,
      y: 0,
      width: sourcePage.width,
      height: sourcePage.height,
    });
  }
  const pdfBytes = await document.save();
  return {
    name: safeOutputName(input.source.name, "pdf"),
    mimeType: "application/pdf",
    blob: new Blob([copyArrayBuffer(pdfBytes)], { type: "application/pdf" }),
    pageCount: input.pages.length,
  };
}

export async function copySafeImage(
  blob: Blob,
  clipboard: ClipboardWriter,
): Promise<void> {
  await clipboard.writePng(blob);
}

export function saveGeneratedCopy(
  copy: GeneratedCopy,
  downloader: Downloader,
): void {
  downloader.save(copy.blob, copy.name);
}

function copyArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

async function canvasToPng(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/png");
  });
  if (blob) return new Uint8Array(await blob.arrayBuffer());

  const dataUrl = canvas.toDataURL("image/png");
  if (dataUrl === "data:,") {
    throw new Error("The safe page could not be encoded");
  }
  const response = await fetch(dataUrl);
  return new Uint8Array(await response.arrayBuffer());
}

export const browserCanvasFactory: CanvasFactory = {
  async flatten(page, marks) {
    const bitmap = await createImageBitmap(
      new Blob([page.pngBytes], { type: "image/png" }),
    );
    try {
      if (typeof OffscreenCanvas !== "undefined") {
        const canvas = new OffscreenCanvas(page.width, page.height);
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas is unavailable");
        drawFlattenedPage(context, bitmap, page, marks);
        const blob = await canvas.convertToBlob({ type: "image/png" });
        return new Uint8Array(await blob.arrayBuffer());
      }
      const canvas = document.createElement("canvas");
      canvas.width = page.width;
      canvas.height = page.height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas is unavailable");
      drawFlattenedPage(context, bitmap, page, marks);
      return await canvasToPng(canvas);
    } finally {
      bitmap.close();
    }
  },
};

function drawFlattenedPage(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  bitmap: ImageBitmap,
  page: RasterPage,
  marks: RedactionMark[],
) {
  context.drawImage(bitmap, 0, 0, page.width, page.height);
  context.fillStyle = "#000000";
  for (const mark of marks) {
    const rectangle = markToPixelRect(mark, page);
    context.fillRect(
      rectangle.x,
      rectangle.y,
      rectangle.width,
      rectangle.height,
    );
  }
}
