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

## Run the app

```bash
npm install
npm run redact:test-files
npm run qvac:service
```

In a second terminal:

```bash
npm run dev -- --port 3101
```

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
build, and opt into `e2e/offline-qvac-workflow.spec.ts` with
`REDACT_LIVE_QVAC=1`. That test rejects non-local browser requests, reviews real
suggestions, inspects a black pixel in the downloaded copy, and verifies the
controlled source file's SHA-256 did not change.

## Security boundary

The generated copy is a new raster image or raster-page PDF, so source PDF text
objects are not copied into it. This case study does not claim legal-grade
redaction, metadata sanitation of every possible format, protection from screen
capture or local malware, or proof that a human-approved policy caught every
sensitive field. QVAC suggestions are evidence for review, not an automatic
guarantee.
