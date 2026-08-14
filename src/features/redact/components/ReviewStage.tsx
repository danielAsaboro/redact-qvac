import { DocumentSurface } from "./DocumentSurface";
import type { RedactSession } from "../workflow-domain";

export function ReviewStage({ session, busy, error, onSession, onAdd, onMove, onResize, onRemove, onDone }: {
  session: RedactSession;
  busy: boolean;
  error: string | null;
  onSession(session: RedactSession): void;
  onAdd(): void;
  onMove(id: string, x: number, y: number): void;
  onResize(id: string, width: number, height: number): void;
  onRemove(id: string): void;
  onDone(): void;
}) {
  const page = session.pages[session.activePageNumber - 1];
  const marks = session.marks.filter((mark) => mark.pageId === page.id);
  return (
    <section className="review-stage">
      <div className="review-heading"><div><p className="stage-kicker">Human review</p><h1>Check every covered region</h1><p>{session.source.name} · Page {page.pageNumber} of {session.pages.length}</p></div><div className="review-actions"><button className="secondary-button" onClick={() => onSession({ ...session, stage: "configure" })}>Change settings</button><button aria-label="Done" className="primary-button" disabled={busy} onClick={onDone}>{busy ? "Creating…" : "Done"} <span>→</span></button></div></div>
      {error && <p className="error-banner" role="alert">{error}</p>}
      <div className="review-layout">
        <div className="comparison-grid">
          <article><header><strong>Original</strong><span>Source view</span></header><DocumentSurface key={`original-${page.id}`} page={page} marks={marks} mode="original" /></article>
          <article><header><strong>Safe-share preview</strong><span>{marks.length} {marks.length === 1 ? "redaction" : "redactions"}</span></header><DocumentSurface key={`safe-${page.id}`} page={page} marks={marks} mode="safe" /></article>
        </div>
        <aside className="mark-panel">
          <div className="mark-panel-title"><div><p className="stage-kicker">Page {page.pageNumber}</p><h2>Redactions</h2></div><button aria-label="Add redaction" className="add-button" onClick={onAdd}>＋ Add redaction</button></div>
          <p className="mark-count">{marks.length} {marks.length === 1 ? "redaction" : "redactions"}</p>
          {marks.length === 0 ? <div className="empty-marks"><strong>No regions covered yet</strong><p>Add a redaction and adjust its position and size.</p></div> : <ol className="editable-marks">{marks.map((mark, index) => <li key={mark.id}><div className="mark-row"><span>{index + 1}</span><strong>{mark.label === "other" ? "Manual redaction" : mark.label}</strong><button aria-label={`Remove redaction ${index + 1}`} onClick={() => onRemove(mark.id)}>Remove</button></div><div className="geometry-grid"><label>X<input aria-label="Redaction horizontal position" type="number" min="0" max="100" defaultValue={mark.x} onChange={(event) => event.target.value && onMove(mark.id, Number(event.target.value), mark.y)} /></label><label>Y<input aria-label="Redaction vertical position" type="number" min="0" max="100" defaultValue={mark.y} onChange={(event) => event.target.value && onMove(mark.id, mark.x, Number(event.target.value))} /></label><label>Width<input aria-label="Redaction width" type="number" min="0.5" max="100" defaultValue={mark.width} onChange={(event) => event.target.value && onResize(mark.id, Number(event.target.value), mark.height)} /></label><label>Height<input aria-label="Redaction height" type="number" min="0.5" max="100" defaultValue={mark.height} onChange={(event) => event.target.value && onResize(mark.id, mark.width, Number(event.target.value))} /></label></div></li>)}</ol>}
          {session.pages.length > 1 && <div className="page-controls"><button disabled={page.pageNumber === 1} onClick={() => onSession({ ...session, activePageNumber: page.pageNumber - 1 })}>← Previous</button><span>{page.pageNumber} / {session.pages.length}</span><button disabled={page.pageNumber === session.pages.length} onClick={() => onSession({ ...session, activePageNumber: page.pageNumber + 1 })}>Next →</button></div>}
        </aside>
      </div>
      <p className="review-note">The safe-share preview is flattened only when you select Done. Your uploaded original remains unchanged.</p>
    </section>
  );
}
