# Redact

Redact is a local-first, review-first application for producing a separate,
rasterized safe copy of a PNG, JPEG, or PDF without modifying the original.

## Product workflow

1. Upload or drop one supported file.
2. Choose **Private** or **Confidential** and optionally describe what else to
   protect.
3. Redact prepares local page rasters and asks the localhost QVAC service for
   OCR evidence and sensitive-field suggestions.
4. Review the original and safe-share preview. Accept or reject every proposal,
   draw manual marks directly, drag or resize them, and inspect the audit history.
5. Save the flattened copy or copy a single-page PNG to the clipboard.

Manual review remains available when QVAC is absent, slow, cancelled, or fails.
The source bytes are never overwritten.

## Requirements

- Node.js 22.17 or newer and npm 10.9 or newer.
- QVAC SDK **0.20.0**, pinned in `package.json` and `package-lock.json`.
- A supported local QVAC runtime; this release is being verified on macOS Apple Silicon.
- Internet access for dependency installation and the first model download. Cached inference runs locally.

QVAC calls `loadModel`, `ocr`, and `completion`. OCR uses `OCR_LATIN`; sensitivity
classification uses `QWEN3_600M_INST_Q4` with deterministic sampling.
Explicit OCR patterns supplement model suggestions for direct identifiers; Confidential
also adds amount, date, and reference patterns. Every proposal still requires review. Neither requires a cloud AI API key.
Model files live in the ignored `.qvac/models` directory. Your document is rasterized
in the browser and sent only to the loopback service at `127.0.0.1:4317`.

## Run the app

```bash
npm ci
npm run redact:test-files
npm run qvac:service
```

In a second terminal:

```bash
npm run dev -- --hostname 127.0.0.1 --port 3101
```

Open http://127.0.0.1:3101. Keep both terminals running. On the first analysis,
model downloads may take several minutes; warm OCR with `npm run qvac:ocr-smoke`
before opening a document. The manual workflow remains available while models load.

Controlled fictional files for tests and course recording live in
`public/test-files/redact`. They are test infrastructure, not customer content.

## Verify

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
```

After both cached models have been warmed, run the labelled local evaluation:

```bash
npm run qvac:evaluate
```

On macOS, prove cached OCR and reasoning while a process sandbox denies remote
TCP/UDP (localhost and QVAC worker IPC remain available):

```bash
npm run qvac:offline
```

For the browser receipt, run `npm run qvac:service:offline`, serve the production
build, and run `REDACT_LIVE_QVAC=1 npm run test:e2e`. The desktop live-QVAC case
rejects non-local browser requests, reviews real suggestions, saves an AI-output
screenshot under `submission/evidence/`, inspects the downloaded copy, and
verifies the controlled source file's SHA-256 did not change. The other browser
cases intentionally block the service request to exercise manual fallback on
desktop and mobile, including a downloaded two-page PDF.

The [AI-output screenshot](submission/evidence/ai-output.png) shows a real local
run on a fictional document. The [verification report](submission/evidence/2026-09-24-run.md)
and [standalone clean-clone report](submission/evidence/clean-clone.md) record
browser, offline, evaluation, and export checks with their limits.

## Security boundary

The generated copy is a new raster image or raster-page PDF, so source PDF text
objects are not copied into it. This case study does not claim legal-grade
redaction, metadata sanitation of every possible format, protection from screen
capture or local malware, or proof that a human-approved policy caught every
sensitive field. QVAC suggestions are evidence for review, not an automatic
guarantee.

## Production locally

```bash
npm run build
npm run start -- --hostname 127.0.0.1 --port 3101
```

Keep `npm run qvac:service` running in a separate terminal. This is a local app;
serving only the frontend remotely does not provide an AI runtime on the user's device.

## Troubleshooting

- **Local analysis unavailable:** start the QVAC service and retry. Manual marks and export remain available.
- **First analysis takes too long:** let model downloads finish, then retry; no cloud fallback is used.
- **Port in use:** stop the previous Redact process. For a custom service port, set
  `REDACT_QVAC_PORT` on the service and `NEXT_PUBLIC_REDACT_QVAC_URL` before building the frontend.
- **Offline verification:** warm both models first. The network-denied commands are macOS-specific.

## License

Redact is MIT licensed; see [LICENSE](LICENSE). Dependencies and downloaded model
weights retain their respective licenses.

### Public PDF robustness checks

[The public-PDF verification report](submission/evidence/public-pdfs/report.md) records tests of real scanned brochures, a dense illustrated research paper, and a fillable form. PDF rasterization uses whole-pixel dimensions at up to 144 DPI (2400-pixel long-edge cap), retaining physical page size on export. Dense OCR is classified in bounded batches. Small scanned text can still yield incorrect OCR and false suggestions; review every page manually.
