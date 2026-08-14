# Create the local QVAC boundary

This checkpoint adds a typed loopback service beside Redact. It does not connect
OCR yet and it does not change the product UI.

## Run the boundary

```bash
npm run qvac:service
curl http://127.0.0.1:4317/health
```

The health response separates service readiness from lazy model state. At this
checkpoint the process is ready, the OCR model is `not_loaded`, and the
reasoning model is `not-configured`. A valid `/v1/analyze-page` request returns a
typed 503 instead of fixture analysis.

## Contract decisions

- The browser sends one already-rasterized PNG page, not the original document
  or a filesystem path.
- The request carries page dimensions, confidentiality level, and the optional
  500-character direction.
- The future OCR response deliberately preserves raw pixel `[x1,y1,x2,y2]`
  geometry. Episode 05 will validate and normalize it for the editor.
- Every response is runtime-validated with Zod. TypeScript types alone cannot
  make a process boundary trustworthy.
- The service binds to `127.0.0.1`; CORS accepts only HTTP origins hosted on
  `localhost` or `127.0.0.1` and rejects arbitrary websites.
- Requests are capped at 20 MiB and the service exposes a single `busy` flag.

## Build lesson

The first package update failed because the machine's default npm cache
contained root-owned files. The scoped recovery was to use the task cache at
`/private/tmp/redact-npm-cache`, not to change QVAC code or recursively change
ownership of a global directory.

## Verification

```bash
npm test -- src/features/redact/analysis-client.test.ts qvac-service/server.test.ts
npm run lint
npm run typecheck
npm test
npm run build
git diff --check
```
