export function AnalyzeStage({ filename, pageCount, busy, error, onRetry, onBack }: {
  filename: string;
  pageCount: number;
  busy: boolean;
  error: string | null;
  onRetry(): void;
  onBack(): void;
}) {
  return (
    <section className="analyze-stage narrow-stage" aria-live="polite">
      <div className="analysis-orbit" data-error={Boolean(error)}><span>{error ? "!" : "◌"}</span></div>
      <p className="stage-kicker">Preparing locally</p>
      <h1>{error ? "We could not prepare this document" : "Building your review copy"}</h1>
      <p>{filename} · {pageCount} {pageCount === 1 ? "page" : "pages"}</p>
      {!error && <p className="analysis-status">Rasterizing pages without changing the original file…</p>}
      {error && <p className="error-banner" role="alert">{error}</p>}
      {error && <div className="stage-actions split-actions"><button className="secondary-button" onClick={onBack}>Back</button><button className="primary-button" disabled={busy} onClick={onRetry}>Try again</button></div>}
    </section>
  );
}
