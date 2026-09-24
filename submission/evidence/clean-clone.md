# Standalone clean-clone verification — 24 September 2026

The release candidate was created from the Redact-only subtree of the private `bring-ai-home` repository, then overlaid with the reviewed QVAC release working tree. It contains no sibling apps or committed model cache. The candidate used for this run was `/private/tmp/redact-release-candidate-2026-09-24` on branch `codex/redact-qvac-submission`.

## First-run and build results

- `npm ci --cache /private/tmp/redact-npm-cache`: installed 681 packages; audit found zero vulnerabilities.
- `npm run lint`: exit 0.
- `npm run typecheck`: exit 0.
- `npm test`: 16 files and 103 tests passed.
- `npm run build`: exit 0, production `/` route generated.
- `npm run qvac:ocr-smoke`: downloaded the OCR assets into ignored `.qvac/models` and returned 12 text blocks from the fictional chat image. Source SHA-256 was `6c19d1f974f4a66aad5823d3ec6bc8d5f2b37e7cd1e62bc3cfe1cc651a1e2521`.
- `npm run qvac:evaluate`: downloaded the reasoning model, ran real local inference, and passed all four controlled cases. The partially obscured case missed one expected field (recall 0.8333).
- `npm run qvac:offline`: with the now-cached models, returned `osNetworkDenied: true`, 12 OCR blocks and six suggestions. The fresh-run OCR took 30,065 ms and reasoning 19,886 ms.

## Production browser run from this candidate

The candidate's production frontend ran at `http://127.0.0.1:3102`; its `qvac:service:offline` process ran at `http://127.0.0.1:4317`. Using Playwright Chromium 151 and `REDACT_BASE_URL=http://127.0.0.1:3102 REDACT_LIVE_QVAC=1`, the full desktop/mobile suite reported **seven passed, one intentionally skipped** in 34.9 seconds. It covered real QVAC suggestions and human review on desktop, manual fallback on both viewports, flattened PNG downloads, two-page PDF downloads, and mobile layout.

The first attempt to launch Chromium from the default command sandbox failed before reaching the app because macOS denied its Mach port registration. The unchanged suite passed when run with the host permission used for the earlier browser tests. This was a test-host launch restriction, not an application failure.

The installed dependencies and `.qvac/models` directory are ignored and are excluded from the release archive. Reviewers need internet for their own first model download, then inference is local with the cached models.
