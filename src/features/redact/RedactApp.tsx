"use client";

import { useMemo, useState, useSyncExternalStore } from "react";

import {
  addMark,
  moveMark,
  recordExport,
  removeMark,
  seedState,
  type RedactState,
  type RedactionMark,
} from "./domain";
import { readState, resetState, writeState } from "./storage";

const LABELS: Record<RedactionMark["label"], string> = {
  name: "Name",
  address: "Address",
  account: "Account number",
  other: "Other",
};

function persist(next: RedactState): RedactState {
  writeState(localStorage, next);
  return next;
}

function subscribeToHydration() {
  return () => undefined;
}

export function RedactApp() {
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );

  if (!hydrated) {
    return (
      <main className="loading-table" aria-live="polite">
        <span className="loading-stamp">Opening sealed workspace</span>
      </main>
    );
  }

  return <HydratedRedactApp />;
}

function HydratedRedactApp() {
  const [state, setState] = useState<RedactState>(() => readState(localStorage));
  const [preview, setPreview] = useState<"original" | "safe">("original");

  const activeDocument = useMemo(
    () =>
      state.documents.find(
        (document) => document.id === state.activeDocumentId,
      ),
    [state],
  );

  const activeMarks = useMemo(
    () =>
      state.marks.filter(
        (mark) => mark.documentId === state.activeDocumentId,
      ) ?? [],
    [state],
  );

  if (!activeDocument) {
    return (
      <main className="loading-table" aria-live="polite">
        <span className="loading-stamp">Opening sealed workspace</span>
      </main>
    );
  }

  function update(recipe: (current: RedactState) => RedactState) {
    setState((current) => (current ? persist(recipe(current)) : current));
  }

  function handleAddMark() {
    const index = activeMarks.length + 1;
    const mark: RedactionMark = {
      id: `manual-${state.activeDocumentId}-${index}`,
      documentId: state.activeDocumentId,
      x: Math.min(70, 14 + index * 7),
      y: Math.min(78, 34 + index * 8),
      width: 22,
      height: 6,
      label: "other",
      createdAt: new Date().toISOString(),
    };
    update((current) => addMark(current, mark));
  }

  return (
    <main className="redact-shell">
      <header className="masthead">
        <div>
          <p className="eyebrow">Local review room · File 07/26</p>
          <h1>Redact</h1>
        </div>
        <div className="classification">
          <span>Controlled copy</span>
          <strong>Review required</strong>
        </div>
        <button
          className="text-button"
          onClick={() => {
            const next = resetState(localStorage);
            setState(next);
            setPreview("original");
          }}
        >
          Reset demo data
        </button>
      </header>

      <section className="workspace-grid">
        <aside className="intake-column">
          <div className="section-heading">
            <span>01</span>
            <div>
              <p>Incoming material</p>
              <h2>Intake tray</h2>
            </div>
          </div>

          <nav aria-label="Intake tray" className="dossier-list">
            {state.documents.map((document, index) => {
              const count = state.marks.filter(
                (mark) => mark.documentId === document.id,
              ).length;
              const active = document.id === state.activeDocumentId;
              return (
                <button
                  key={document.id}
                  className="dossier-tab"
                  data-active={active}
                  onClick={() => {
                    setState(
                      persist({ ...state, activeDocumentId: document.id }),
                    );
                    setPreview("original");
                  }}
                >
                  <span className="file-index">0{index + 1}</span>
                  <span className="file-copy">
                    <strong>{document.title}</strong>
                    <small>{document.riskLabel}</small>
                  </span>
                  <span className="file-count">{count}</span>
                </button>
              );
            })}
          </nav>

          <div className="truth-card">
            <span aria-hidden="true">!</span>
            <p>
              This is a visual review workspace using fixtures. It does not
              alter a real source document.
            </p>
          </div>
        </aside>

        <section className="light-table" aria-label="Document light table">
          <div className="light-table-toolbar">
            <div>
              <p className="document-kicker">{activeDocument.kind}</p>
              <h2>{activeDocument.title}</h2>
            </div>
            <div className="view-switch" aria-label="Document view">
              <button
                data-active={preview === "original"}
                onClick={() => setPreview("original")}
              >
                Original view
              </button>
              <button
                data-active={preview === "safe"}
                onClick={() => setPreview("safe")}
              >
                Safe-share preview
              </button>
            </div>
          </div>

          <div className="document-stage">
            <article className="paper" data-preview={preview}>
              <div className="paper-punches" aria-hidden="true">
                <i />
                <i />
                <i />
              </div>
              <div className="statement-brand">
                <span>Northline Mutual</span>
                <small>PRIVATE ACCOUNT STATEMENT</small>
              </div>
              <div className="statement-address">
                <strong>Amara Okeke</strong>
                <span>19 Cedar Close</span>
                <span>Surulere, Lagos</span>
              </div>
              <div className="account-strip">
                <span>ACCOUNT</span>
                <strong>4401 8280 1294</strong>
                <span>PERIOD</span>
                <strong>01–30 JUN 2026</strong>
              </div>
              <div className="statement-summary">
                <div>
                  <small>Opening balance</small>
                  <strong>₦482,900.00</strong>
                </div>
                <div>
                  <small>Money in</small>
                  <strong>₦620,000.00</strong>
                </div>
                <div>
                  <small>Money out</small>
                  <strong>₦391,420.00</strong>
                </div>
              </div>
              <div className="transactions" aria-label="Fixture transactions">
                {[
                  ["03 Jun", "Metro Market", "− ₦24,500"],
                  ["08 Jun", "Lumen Energy", "− ₦41,320"],
                  ["14 Jun", "Salary credit", "+ ₦620,000"],
                  ["22 Jun", "Coastline Rail", "− ₦18,750"],
                  ["29 Jun", "Household transfer", "− ₦125,000"],
                ].map(([date, detail, amount]) => (
                  <div className="transaction-row" key={`${date}-${detail}`}>
                    <span>{date}</span>
                    <strong>{detail}</strong>
                    <span>{amount}</span>
                  </div>
                ))}
              </div>
              <footer className="paper-footer">
                Fixture document · no real financial information
              </footer>

              {activeMarks.map((mark) => (
                <button
                  className="redaction-mark"
                  data-preview={preview}
                  key={mark.id}
                  aria-label={`${LABELS[mark.label]} redaction mark`}
                  style={{
                    left: `${mark.x}%`,
                    top: `${mark.y}%`,
                    width: `${mark.width}%`,
                    height: `${mark.height}%`,
                  }}
                >
                  <span>{preview === "original" ? LABELS[mark.label] : ""}</span>
                </button>
              ))}
            </article>
          </div>

          {preview === "safe" && (
            <p className="preview-warning" role="note">
              Preview only — covering pixels here does not securely rewrite the
              source file or remove hidden metadata.
            </p>
          )}
        </section>

        <aside className="review-column">
          <div className="section-heading compact">
            <span>02</span>
            <div>
              <p>Human verification</p>
              <h2>Review marks</h2>
            </div>
          </div>

          <div className="mark-summary">
            <strong>{activeMarks.length} marks placed</strong>
            <span>Page 1 of {activeDocument.pageCount}</span>
          </div>

          <button
            aria-label="Add manual mark"
            className="primary-action"
            onClick={handleAddMark}
          >
            <span>＋</span> Add manual mark
          </button>

          <ol className="mark-list">
            {activeMarks.length === 0 ? (
              <li className="empty-marks">No marks on this page.</li>
            ) : (
              activeMarks.map((mark, index) => (
                <li key={mark.id}>
                  <span className="mark-number">{index + 1}</span>
                  <div>
                    <strong>{LABELS[mark.label]}</strong>
                    <small>
                      x {Math.round(mark.x)} · y {Math.round(mark.y)}
                    </small>
                  </div>
                  <div className="mark-controls">
                    <button
                      aria-label={`Move ${mark.label} mark left`}
                      onClick={() =>
                        update((current) =>
                          moveMark(current, mark.id, {
                            x: mark.x - 2,
                            y: mark.y,
                          }),
                        )
                      }
                    >
                      ←
                    </button>
                    <button
                      aria-label={`Move ${mark.label} mark right`}
                      onClick={() =>
                        update((current) =>
                          moveMark(current, mark.id, {
                            x: mark.x + 2,
                            y: mark.y,
                          }),
                        )
                      }
                    >
                      →
                    </button>
                    <button
                      className="remove-mark"
                      aria-label={`Remove ${mark.label} mark`}
                      onClick={() =>
                        update((current) =>
                          removeMark(
                            current,
                            mark.id,
                            new Date().toISOString(),
                          ),
                        )
                      }
                    >
                      ×
                    </button>
                  </div>
                </li>
              ))
            )}
          </ol>

          <div className="audit-block">
            <div className="audit-title">
              <h3>Audit strip</h3>
              <span>{state.audit.length} entries</span>
            </div>
            <ol>
              {state.audit
                .filter((entry) => entry.documentId === state.activeDocumentId)
                .slice(0, 3)
                .map((entry) => (
                  <li key={entry.id}>
                    <span />
                    <div>
                      <strong>{entry.action}</strong>
                      <small>{entry.detail}</small>
                    </div>
                  </li>
                ))}
            </ol>
          </div>

          <button
            className="export-action"
            onClick={() =>
              update((current) =>
                recordExport(current, new Date().toISOString()),
              )
            }
          >
            Record simulated export
          </button>
          {state.exports.length > 0 && (
            <p className="export-confirmation" role="status">
              <span>✓</span> Simulation recorded
            </p>
          )}
        </aside>
      </section>
    </main>
  );
}

export { seedState };
