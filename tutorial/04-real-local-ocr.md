# Replace the empty bridge with real local OCR

This checkpoint sends Redact's existing rasterized PNG pages to the loopback
service, runs the pinned QVAC OCR model, and returns raw pixel evidence. Manual
review remains available when health, model load, inference, or response
validation fails.

## Run it

In one terminal:

```bash
npm run qvac:service
```

In another:

```bash
npm run dev
```

Upload a supported document, choose the privacy level and optional direction,
then prepare it. The browser rasterizes first and submits pages sequentially.
The Review stage lists recognized text and recognition confidence; Episode 05
will place validated geometry on the document surface.

## Real receipt

The controlled 1200×1600 chat PNG returned HTTP 200, 12 OCR blocks, and an
`ocrMs` receipt of 34,789 ms on the measured service run. Health then reported
the OCR model as `ready`. The result contained the same useful and imperfect
evidence seen in Episode 02.

## Failures found while building

1. `tsx` emitted this package as CommonJS, so top-level `await` failed at live
   service startup despite typecheck passing. Initialization now lives in an
   async `main()`.
2. A request claimed 900×1500 for a decoded 1200×1600 PNG. The analyzer rejected
   it before OCR. Coordinates are meaningless unless bytes and dimensions refer
   to the same raster.
3. Buffer-based QVAC OCR writes a transient image under the worker home. The
   model cache existed, but the worker temp directory did not. The service now
   owns `.qvac/runtime-home/.qvac/tmp`, creates it before importing the SDK, and
   keeps that lifecycle separate from `.qvac/models`.

Service responses remain generic, while stderr records the local diagnostic
message without printing document text or bytes.

## Verification

```bash
npm test -- qvac-service/qvac-analyzer.test.ts src/features/redact/RedactApp.test.tsx
npm run lint
npm run typecheck
npm test
npm run build
git diff --check
```
