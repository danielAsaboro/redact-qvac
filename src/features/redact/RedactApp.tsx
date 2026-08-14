"use client";

import { useState } from "react";

import { AnalyzeStage } from "./components/AnalyzeStage";
import { CompleteStage } from "./components/CompleteStage";
import { ConfigureStage } from "./components/ConfigureStage";
import { ReviewStage } from "./components/ReviewStage";
import { UploadStage } from "./components/UploadStage";
import { WorkflowSteps } from "./components/WorkflowSteps";
import { validateUploadMeta } from "./file-policy";
import { createAnalysisClient, type AnalysisClient } from "./analysis-client";
import {
  inspectSource,
  rasterizeSource,
  type SourceInspection,
} from "./rasterize";
import { normalizeOcrBbox } from "./ocr-geometry";
import {
  copySafeImage,
  generateSafeCopy,
  saveGeneratedCopy,
  type ClipboardWriter,
  type Downloader,
  type GeneratedCopy,
} from "./safe-copy";
import {
  addManualMark,
  beginPreparation,
  configureSession,
  createSession,
  finishReview,
  moveMark,
  openManualReview,
  recordGeneratedCopy,
  removeMark,
  resizeMark,
  type RedactSession,
  type OCRBlock,
  type AnalysisRun,
  type SourceDocument,
} from "./workflow-domain";

export type RedactAppAdapters = {
  inspect(file: File): Promise<SourceInspection>;
  rasterize(file: File, inspection: SourceInspection): Promise<RedactSession["pages"]>;
  exportCopy: typeof generateSafeCopy;
  clipboard: ClipboardWriter;
  downloader: Downloader;
  digest(bytes: ArrayBuffer): Promise<string>;
  now(): string;
  analysis: AnalysisClient;
};

const browserAdapters: RedactAppAdapters = {
  inspect: inspectSource,
  rasterize: rasterizeSource,
  exportCopy: generateSafeCopy,
  clipboard: {
    async writePng(blob) {
      if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
        throw new Error("Clipboard unavailable");
      }
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    },
  },
  downloader: {
    save(blob, filename) {
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = filename;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(href), 0);
    },
  },
  async digest(bytes) {
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
  },
  now: () => new Date().toISOString(),
  analysis: createAnalysisClient(),
};

export function RedactApp({
  adapters = browserAdapters,
}: {
  adapters?: RedactAppAdapters;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [inspection, setInspection] = useState<SourceInspection | null>(null);
  const [session, setSession] = useState<RedactSession | null>(null);
  const [generatedCopy, setGeneratedCopy] = useState<GeneratedCopy | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clipboardMessage, setClipboardMessage] = useState<string | null>(null);
  const [analysisMessage, setAnalysisMessage] = useState("Rasterizing pages without changing the original file…");

  const visibleStage = !session
    ? "upload"
    : session.stage === "configure"
      ? "configure"
      : session.stage === "analyzing"
        ? "prepare"
        : session.stage === "review"
          ? "review"
          : "complete";

  async function selectFile(selected: File) {
    setError(null);
    try {
      validateUploadMeta(selected);
      setBusy(true);
      const [sourceInspection, originalBytes] = await Promise.all([
        adapters.inspect(selected),
        selected.arrayBuffer(),
      ]);
      const originalDigest = await adapters.digest(originalBytes);
      const source: SourceDocument = {
        id: `document-${originalDigest.slice(0, 16)}`,
        name: selected.name,
        mimeType: sourceInspection.mimeType,
        byteSize: selected.size,
        pageCount: sourceInspection.pageCount,
        originalBytes,
        originalDigest,
      };
      setFile(selected);
      setInspection(sourceInspection);
      setSession(createSession(source, adapters.now()));
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusy(false);
    }
  }

  async function prepare() {
    if (!session || !file || !inspection) return;
    setError(null);
    setBusy(true);
    setAnalysisMessage("Rasterizing pages without changing the original file…");
    setSession(beginPreparation(session));
    try {
      const rasterPages = await adapters.rasterize(file, inspection);
      const pages = rasterPages.map((page, index) => ({
        ...page,
        id: `page-${index + 1}`,
        documentId: session.source.id,
        pageNumber: index + 1,
      }));
      const ocrBlocks: OCRBlock[] = [];
      const analysisRuns: AnalysisRun[] = [];
      try {
        setAnalysisMessage("Loading the local OCR model and reading each page…");
        const health = await adapters.analysis.health();
        if (health.service !== "ready") {
          throw new Error("Local analysis is unavailable");
        }
        for (const page of pages) {
          setAnalysisMessage(`Reading page ${page.pageNumber} of ${pages.length} locally…`);
          const result = await adapters.analysis.analyzePage(
            {
              documentId: session.source.id,
              pageId: page.id,
              pageNumber: page.pageNumber,
              width: page.width,
              height: page.height,
              pngBytes: page.pngBytes,
              level: session.configuration.level,
              direction: session.configuration.direction,
            },
            undefined,
          );
          analysisRuns.push({
            id: result.run.id,
            documentId: result.run.documentId,
            revision: session.analysisRevision,
            status: result.run.status,
            startedAt: result.run.startedAt,
            completedAt: result.run.completedAt,
            error: result.run.error,
            pageId: result.page.id,
            ocrModel: result.run.ocrModel,
            ocrMs: result.run.ocrMs,
          });
          ocrBlocks.push(
            ...result.ocrBlocks.flatMap((block, index) => {
              const bbox = normalizeOcrBbox(block.bbox, page.width, page.height);
              return bbox
                ? [{
                    id: `ocr-${page.id}-${index + 1}`,
                    documentId: session.source.id,
                    pageId: page.id,
                    pageNumber: page.pageNumber,
                    text: block.text,
                    rawBbox: block.bbox,
                    bbox,
                    confidence: block.confidence,
                  }]
                : [];
            }),
          );
        }
        setSession(openManualReview(session, pages, { ocrBlocks, analysisRuns }));
      } catch {
        setError("Local analysis is unavailable. Manual review remains available.");
        setSession(openManualReview(session, pages, { ocrBlocks, analysisRuns }));
      }
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusy(false);
    }
  }

  async function createCopy() {
    if (!session) return;
    setBusy(true);
    setError(null);
    const exporting = finishReview(session);
    setSession(exporting);
    try {
      const copy = await adapters.exportCopy({
        source: session.source,
        pages: session.pages,
        marks: session.marks,
      });
      setGeneratedCopy(copy);
      setSession(
        recordGeneratedCopy(exporting, {
          name: copy.name,
          mimeType: copy.mimeType,
          pageCount: copy.pageCount,
          byteSize: copy.blob.size,
          createdAt: adapters.now(),
        }),
      );
    } catch (caught) {
      setError(messageOf(caught));
      setSession(session);
    } finally {
      setBusy(false);
    }
  }

  async function copyToClipboard() {
    if (!generatedCopy || !session) return;
    setClipboardMessage(null);
    try {
      let blob = generatedCopy.blob;
      if (generatedCopy.mimeType === "application/pdf") {
        const page = session.pages[session.activePageNumber - 1];
        const currentPage = await adapters.exportCopy({
          source: {
            ...session.source,
            name: `${session.source.name}.png`,
            mimeType: "image/png",
            pageCount: 1,
          },
          pages: [page],
          marks: session.marks.filter((mark) => mark.pageId === page.id),
        });
        blob = currentPage.blob;
      }
      await copySafeImage(blob, adapters.clipboard);
      setClipboardMessage("Copied safe image to clipboard");
    } catch {
      setClipboardMessage("Clipboard unavailable — save the copy instead");
    }
  }

  return (
    <main className="app-shell">
      <header className="product-header">
        <a className="wordmark" href="#main-content" aria-label="Redact home">
          Redact<span>.</span>
        </a>
        <div className="local-status"><i /> Processing stays on this device</div>
      </header>
      <WorkflowSteps stage={visibleStage} />
      <div id="main-content" className="stage-shell">
        {!session && (
          <UploadStage onFile={selectFile} busy={busy} error={error} />
        )}
        {session?.stage === "configure" && (
          <ConfigureStage
            session={session}
            busy={busy}
            error={error}
            onBack={() => {
              setSession(null);
              setFile(null);
              setInspection(null);
              setError(null);
            }}
            onChange={(configuration) =>
              setSession(configureSession(session, configuration))
            }
            onPrepare={prepare}
          />
        )}
        {session?.stage === "analyzing" && (
          <AnalyzeStage
            filename={session.source.name}
            pageCount={session.source.pageCount}
            busy={busy}
            error={error}
            status={analysisMessage}
            onRetry={prepare}
            onBack={() => {
              setError(null);
              setSession({ ...session, stage: "configure" });
            }}
          />
        )}
        {session?.stage === "review" && (
          <ReviewStage
            session={session}
            busy={busy}
            error={error}
            onSession={setSession}
            onAdd={(geometry) => {
              const page = session.pages[session.activePageNumber - 1];
              const index = session.marks.length + 1;
              setSession(
                addManualMark(session, {
                  id: `manual-${index}`,
                  documentId: session.source.id,
                  pageId: page.id,
                  pageNumber: page.pageNumber,
                  x: geometry?.x ?? Math.min(68, 12 + index * 4),
                  y: geometry?.y ?? Math.min(72, 18 + index * 5),
                  width: geometry?.width ?? 24,
                  height: geometry?.height ?? 6,
                  label: "other",
                  source: "manual",
                  createdAt: adapters.now(),
                }),
              );
            }}
            onMove={(id, x, y) => setSession(moveMark(session, id, { x, y }))}
            onResize={(id, width, height) =>
              setSession(resizeMark(session, id, { width, height }))
            }
            onGeometry={(id, geometry) =>
              setSession(
                resizeMark(
                  moveMark(session, id, { x: geometry.x, y: geometry.y }),
                  id,
                  { width: geometry.width, height: geometry.height },
                ),
              )
            }
            onRemove={(id) => setSession(removeMark(session, id, adapters.now()))}
            onDone={createCopy}
          />
        )}
        {session?.stage === "complete" && generatedCopy && (
          <CompleteStage
            copy={generatedCopy}
            source={session.source}
            message={clipboardMessage}
            onCopy={copyToClipboard}
            onSave={() => saveGeneratedCopy(generatedCopy, adapters.downloader)}
            onReview={() => {
              setClipboardMessage(null);
              setSession({ ...session, stage: "review" });
            }}
            onNew={() => {
              setSession(null);
              setFile(null);
              setInspection(null);
              setGeneratedCopy(null);
              setClipboardMessage(null);
            }}
          />
        )}
      </div>
    </main>
  );
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}
