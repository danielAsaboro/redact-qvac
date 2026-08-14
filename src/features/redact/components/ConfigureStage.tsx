import { MAX_DIRECTION_CHARACTERS, normalizeDirection } from "../file-policy";
import type { RedactSession } from "../workflow-domain";

export function ConfigureStage({
  session,
  busy,
  error,
  onBack,
  onChange,
  onPrepare,
}: {
  session: RedactSession;
  busy: boolean;
  error: string | null;
  onBack(): void;
  onChange(configuration: RedactSession["configuration"]): void;
  onPrepare(): void;
}) {
  const { configuration, source } = session;
  return (
    <section className="configure-stage narrow-stage">
      <button className="back-button" onClick={onBack}>← Choose another file</button>
      <p className="stage-kicker">Set the protection policy</p>
      <h1>What should stay private?</h1>
      <div className="file-summary">
        <div className="file-badge">{source.mimeType === "application/pdf" ? "PDF" : "IMAGE"}</div>
        <div><strong>{source.name}</strong><span>{formatBytes(source.byteSize)} · {source.pageCount} {source.pageCount === 1 ? "page" : "pages"}</span></div>
        <small>Original stays untouched</small>
      </div>
      <fieldset className="privacy-fieldset">
        <legend>Privacy level</legend>
        <label data-selected={configuration.level === "private"}>
          <input aria-label="Private" type="radio" name="level" value="private" checked={configuration.level === "private"} onChange={() => onChange({ ...configuration, level: "private" })} />
          <span><strong>Private</strong><small>Names, emails, phone numbers, addresses, account and identity numbers</small></span>
        </label>
        <label data-selected={configuration.level === "confidential"}>
          <input aria-label="Confidential" type="radio" name="level" value="confidential" checked={configuration.level === "confidential"} onChange={() => onChange({ ...configuration, level: "confidential" })} />
          <span><strong>Confidential</strong><small>Everything in Private, plus amounts, dates, references, and business-sensitive text</small></span>
        </label>
      </fieldset>
      <label className="direction-field">
        <span><strong>Additional direction</strong><small>Optional · processed locally</small></span>
        <textarea
          aria-label="Additional direction"
          maxLength={MAX_DIRECTION_CHARACTERS}
          value={configuration.direction}
          placeholder="For example: hide Apollo project references"
          onChange={(event) => onChange({ ...configuration, direction: event.target.value })}
          onBlur={() => onChange({ ...configuration, direction: normalizeDirection(configuration.direction) })}
        />
        <small>{configuration.direction.length}/{MAX_DIRECTION_CHARACTERS}</small>
      </label>
      {error && <p className="error-banner" role="alert">{error}</p>}
      <div className="stage-actions">
        <button aria-label="Prepare for review" className="primary-button" disabled={busy} onClick={onPrepare}>Prepare for review <span>→</span></button>
      </div>
    </section>
  );
}

function formatBytes(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
