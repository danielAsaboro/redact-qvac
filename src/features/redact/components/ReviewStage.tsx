import { useState } from "react";

import {
  DocumentSurface,
  type RedactionGeometry,
} from "./DocumentSurface";
import type {
  RedactionMark,
  RedactSession,
} from "../workflow-domain";

export function ReviewStage({
  session,
  busy,
  error,
  onSession,
  onAdd,
  onMove,
  onResize,
  onGeometry,
  onRemove,
  onDone,
}: {
  session: RedactSession;
  busy: boolean;
  error: string | null;
  onSession(session: RedactSession): void;
  onAdd(geometry?: RedactionGeometry): void;
  onMove(id: string, x: number, y: number): void;
  onResize(id: string, width: number, height: number): void;
  onGeometry(id: string, geometry: RedactionGeometry): void;
  onRemove(id: string): void;
  onDone(): void;
}) {
  const page = session.pages[session.activePageNumber - 1];
  const marks = session.marks.filter((mark) => mark.pageId === page.id);
  const ocrBlocks = session.ocrBlocks.filter((block) => block.pageId === page.id);
  const candidates = session.candidates.filter((candidate) => candidate.pageId === page.id);
  return (
    <section className="review-stage">
      <div className="review-heading">
        <div>
          <p className="stage-kicker">Human review</p>
          <h1>Check every covered region</h1>
          <p>{session.source.name} · Page {page.pageNumber} of {session.pages.length}</p>
        </div>
        <div className="review-actions">
          <button className="secondary-button" onClick={() => onSession({ ...session, stage: "configure" })}>Change settings</button>
          <button aria-label="Done" className="primary-button" disabled={busy} onClick={onDone}>{busy ? "Creating…" : "Done"} <span>→</span></button>
        </div>
      </div>
      {error && <p className="error-banner" role="alert">{error}</p>}
      <div className="review-layout">
        <div className="comparison-grid">
          <article>
            <header><strong>Original</strong><span>{ocrBlocks.length > 0 ? `${ocrBlocks.length} detected regions · drag to draw` : "Drag to draw · drag marks to move"}</span></header>
            <DocumentSurface key={`original-${page.id}`} page={page} marks={marks} evidence={ocrBlocks} candidates={candidates} mode="original" onCreate={onAdd} onChange={onGeometry} />
          </article>
          <article>
            <header><strong>Safe-share preview</strong><span>{marks.length} {marks.length === 1 ? "redaction" : "redactions"}</span></header>
            <DocumentSurface key={`safe-${page.id}`} page={page} marks={marks} mode="safe" />
          </article>
        </div>
        <aside className="mark-panel">
          <div className="mark-panel-title">
            <div><p className="stage-kicker">Page {page.pageNumber}</p><h2>Redactions</h2></div>
            <button aria-label="Add redaction" className="add-button" onClick={() => onAdd()}>＋ Add redaction</button>
          </div>
          <p className="mark-count">{marks.length} {marks.length === 1 ? "redaction" : "redactions"}</p>
          {ocrBlocks.length > 0 && <section className="ocr-evidence" aria-label="Local OCR evidence"><strong>{ocrBlocks.length} text {ocrBlocks.length === 1 ? "region" : "regions"} found locally</strong><ol>{ocrBlocks.map((block) => <li key={block.id}><span>{block.text}</span><small>{block.confidence === null ? "confidence unavailable" : `${Math.round(block.confidence * 100)}% recognition`}</small></li>)}</ol></section>}
          {candidates.length > 0 && <section className="candidate-list" aria-label="Suggested redactions"><strong>{candidates.length} suggested {candidates.length === 1 ? "redaction" : "redactions"}</strong><ol>{candidates.map((candidate) => <li key={candidate.id}><div><span>{candidate.label}</span><small>{Math.round((candidate.confidence ?? 0) * 100)}% sensitivity</small></div><b>{candidate.evidenceText}</b><p>{candidate.explanation}</p></li>)}</ol></section>}
          {marks.length === 0 ? (
            <div className="empty-marks"><strong>Draw on the original</strong><p>Drag over anything private. You can move or resize the region afterward.</p></div>
          ) : (
            <ol className="editable-marks">
              {marks.map((mark, index) => (
                <li key={mark.id}>
                  <div className="mark-row">
                    <span>{index + 1}</span>
                    <strong>{mark.label === "other" ? "Manual redaction" : mark.label}</strong>
                    <button aria-label={`Remove redaction ${index + 1}`} onClick={() => onRemove(mark.id)}>Remove</button>
                  </div>
                  <PrecisionControls mark={mark} onMove={onMove} onResize={onResize} />
                </li>
              ))}
            </ol>
          )}
          {session.pages.length > 1 && (
            <div className="page-controls">
              <button disabled={page.pageNumber === 1} onClick={() => onSession({ ...session, activePageNumber: page.pageNumber - 1 })}>← Previous</button>
              <span>{page.pageNumber} / {session.pages.length}</span>
              <button disabled={page.pageNumber === session.pages.length} onClick={() => onSession({ ...session, activePageNumber: page.pageNumber + 1 })}>Next →</button>
            </div>
          )}
        </aside>
      </div>
      <p className="review-note">The safe-share preview is flattened only when you select Done. Your uploaded original remains unchanged.</p>
    </section>
  );
}

function PrecisionControls({
  mark,
  onMove,
  onResize,
}: {
  mark: RedactionMark;
  onMove(id: string, x: number, y: number): void;
  onResize(id: string, width: number, height: number): void;
}) {
  return (
    <details className="precision-controls">
      <summary>Precise positioning</summary>
      <div className="geometry-grid">
        <label>X<PrecisionNumberInput label="Redaction horizontal position" min={0} value={mark.x} onCommit={(value) => onMove(mark.id, value, mark.y)} /></label>
        <label>Y<PrecisionNumberInput label="Redaction vertical position" min={0} value={mark.y} onCommit={(value) => onMove(mark.id, mark.x, value)} /></label>
        <label>Width<PrecisionNumberInput label="Redaction width" min={0.5} value={mark.width} onCommit={(value) => onResize(mark.id, value, mark.height)} /></label>
        <label>Height<PrecisionNumberInput label="Redaction height" min={0.5} value={mark.height} onCommit={(value) => onResize(mark.id, mark.width, value)} /></label>
      </div>
    </details>
  );
}

function PrecisionNumberInput({ label, min, value, onCommit }: {
  label: string;
  min: number;
  value: number;
  onCommit(value: number): void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      aria-label={label}
      max={100}
      min={min}
      onBlur={() => setDraft(null)}
      onChange={(event) => {
        setDraft(event.target.value);
        if (event.target.value !== "") onCommit(Number(event.target.value));
      }}
      type="number"
      value={draft ?? String(value)}
    />
  );
}
