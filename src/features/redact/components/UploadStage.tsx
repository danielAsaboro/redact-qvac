import { useRef, useState, type DragEvent } from "react";

export function UploadStage({
  onFile,
  busy,
  error,
}: {
  onFile(file: File): void;
  busy: boolean;
  error: string | null;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  function dropped(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) onFile(file);
  }
  return (
    <section className="upload-stage">
      <p className="stage-kicker">Private document redaction</p>
      <h1>What do you need to share safely?</h1>
      <p className="stage-intro">
        Add a screenshot, scan, or PDF. You will review every covered region before a separate safe copy is created.
      </p>
      <div
        className="drop-zone"
        data-dragging={dragging}
        onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={dropped}
      >
        <div className="upload-icon" aria-hidden="true">↑</div>
        <strong>{busy ? "Reading your document…" : "Drop a document here"}</strong>
        <span>or</span>
        <button className="primary-button" disabled={busy} onClick={() => input.current?.click()}>
          Choose a file
        </button>
        <input
          ref={input}
          className="visually-hidden"
          type="file"
          accept="image/png,image/jpeg,application/pdf"
          aria-label="Choose a document"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onFile(file);
          }}
        />
        <small>PNG, JPEG, or PDF · up to 25 MB · PDFs up to 25 pages</small>
      </div>
      {error && <p className="error-banner" role="alert">{error}</p>}
      <div className="assurance-row">
        <span>Original never overwritten</span>
        <span>No cloud upload</span>
        <span>You approve every redaction</span>
      </div>
    </section>
  );
}
