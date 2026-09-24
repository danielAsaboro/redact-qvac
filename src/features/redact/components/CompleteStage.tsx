import { useEffect, useRef } from "react";

import type { GeneratedCopy } from "../safe-copy";
import type { SourceDocument } from "../workflow-domain";

export function CompleteStage({ copy, source, message, onCopy, onSave, onReview, onNew }: {
  copy: GeneratedCopy;
  source: SourceDocument;
  message: string | null;
  onCopy(): void;
  onSave(): void;
  onReview(): void;
  onNew(): void;
}) {
  const downloadLink = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    if (typeof URL.createObjectURL !== "function") return;
    const href = URL.createObjectURL(copy.blob);
    if (downloadLink.current) downloadLink.current.href = href;
    return () => URL.revokeObjectURL(href);
  }, [copy.blob]);

  return (
    <section className="complete-stage narrow-stage">
      <div className="complete-check">✓</div>
      <p className="stage-kicker">Separate flattened output</p>
      <h1>Your safe copy is ready</h1>
      <p>The original <strong>{source.name}</strong> was not modified.</p>
      <div className="copy-card"><div className="file-badge">{copy.mimeType === "application/pdf" ? "PDF" : "PNG"}</div><div><strong>{copy.name}</strong><span>{copy.pageCount} {copy.pageCount === 1 ? "page" : "pages"} · {formatBytes(copy.blob.size)}</span></div></div>
      <div className="complete-actions"><button className="secondary-button" onClick={onCopy}>Copy to clipboard</button><a ref={downloadLink} className="primary-button" download={copy.name} onClick={(event) => {
        if (!event.currentTarget.getAttribute("href")) { event.preventDefault(); onSave(); }
      }}>Save copy</a></div>
      {message && <p className="clipboard-message" role="status">{message}</p>}
      <div className="complete-links"><button onClick={onReview}>Return to review</button><button onClick={onNew}>Redact another document</button></div>
      <p className="output-note">The output contains rasterized pages with opaque masks. It does not preserve selectable text or the source file’s metadata.</p>
    </section>
  );
}

function formatBytes(bytes: number) { return bytes < 1024 ? `${bytes} bytes` : `${Math.ceil(bytes / 1024)} KB`; }
