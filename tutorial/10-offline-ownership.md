# Prove the completed workflow offline

This checkpoint proves cached OCR and structured reasoning while macOS denies
remote TCP and UDP for the QVAC process. It then exercises the real browser
workflow against that sandboxed localhost service.

## Cached analyzer receipt

Warm both models before disconnecting or applying the process sandbox. Then run:

```bash
npm run qvac:offline
```

The command:

1. requires the detector, recognizer, and Qwen files in the app-owned cache;
2. runs inside `sandbox-exec`, denying non-local TCP/UDP;
3. verifies a remote fetch fails;
4. installs an in-process HTTP(S) fetch guard as defense in depth;
5. analyzes the real controlled chat raster with cached QVAC OCR and reasoning;
6. prints source SHA-256, evidence/suggestion counts, labels, models, and timings.

The recording-machine receipt found 12 OCR blocks and six suggestions while
remote networking was denied. OCR took about 36.7 seconds and reasoning about
6.5 seconds on that warmed run.

The first sandbox policy denied all non-local-looking outbound operations and
also blocked QVAC worker IPC. The SDK failed with an RPC initialization timeout.
The corrected profile denies remote TCP/UDP specifically while leaving Unix
domain worker communication and localhost available. “Offline” must not mean
“break the local runtime and call the timeout a model failure.”

## Browser receipt

Build and serve the checkpoint, then start the sandboxed service:

```bash
npm run build
npm start -- -p 3102
npm run qvac:service:offline
REDACT_LIVE_QVAC=1 REDACT_BASE_URL=http://localhost:3102 \
  npx playwright test e2e/offline-qvac-workflow.spec.ts --project=desktop
```

The opt-in test uploads the real controlled PNG, waits for cached QVAC, accepts a
name, rejects an email, accepts the remaining proposals, adds a manual mark,
checks audit entries, creates the safe copy, downloads it, inspects a pixel under
the accepted name, verifies the original SHA-256/bytes are unchanged, and fails
if the browser requests any non-local HTTP(S) URL.

The first browser attempt also taught two operational lessons. Chromium could
not launch inside the automation sandbox and had to run with the already-approved
browser permission. Then Next development mode exhausted file watchers, repeatedly
deleted `.next/dev`, and served 404. The production build/server removed hot-reload
watchers and the corrected test passed in 39.2 seconds against the warmed service.

An audit assertion initially ran after accepting every proposal. Because the UI
shows only the four most recent audit entries, the earlier rejection was no
longer visible. The test now asserts accept/reject entries at the moment each is
created, then continues. Test timing must respect intentional UI retention.

## What this proves—and what it does not

It proves this controlled workflow can use cached local models, human review,
manual fallback, and a separate flattened output without an allowed external
inference request. It proves the source test file was not modified.

It does not prove that every sensitive field will be detected, that every file
format and metadata channel is sanitized, that a black overlay is legal-grade
redaction, or that the operating system itself was physically disconnected. The
process-scoped network denial is strong, repeatable evidence for these processes;
for the recording, disabling machine networking remains a useful visible check.
