# Redact

Redact is a review-first application for creating a separate, rasterized copy of
a PNG, JPEG, or PDF while leaving the original file unchanged.

## Workflow

1. Upload or drop one supported file.
2. Choose **Private** or **Confidential** and optionally describe what else to
   protect.
3. Redact rasterizes the file locally into review pages.
4. Compare the original with the safe-share preview, add and edit manual marks,
   and inspect the audit history.
5. Save the flattened copy or copy a single-page PNG to the clipboard.

This `main` checkpoint is the complete non-AI product. The course branch adds
QVAC evidence and suggestions without rebuilding or replacing this workflow.

## Run

```bash
npm install
npm run redact:test-files
npm run dev -- --port 3101
```

Controlled fictional files used by automated tests and course recording live in
`public/test-files/redact`. They are test infrastructure, not customer content.

## Verify

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
```

## Security boundary

Done creates a new raster PNG or an image-page PDF; it does not overwrite the
uploaded bytes. The implementation does not claim legal-grade redaction,
sanitation of every possible metadata channel, guaranteed detection of every
sensitive field, or protection from local malware and screen capture. Human
review remains responsible for the final set of marks.
