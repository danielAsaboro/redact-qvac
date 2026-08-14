# Redact production baseline

Episode 01 starts with the finished non-AI product. We do not build its interface in the course; we use it to establish the behavior QVAC must enhance without taking over.

## Run the checkpoint

```bash
npm ci
npm run redact:test-files
npm run dev -- --port 3101
```

Open `http://localhost:3101`, then follow one complete path:

1. Upload `public/test-files/redact/chat-private.png`.
2. Choose **Confidential** and enter `Hide Apollo references` as additional direction.
3. Select **Prepare for review**. At this checkpoint, preparation rasterizes the document locally and opens manual review; it does not call QVAC.
4. Drag across private text on the original to create a manual redaction. Drag
   the mark to reposition it and use a corner handle to resize it. The collapsed
   **Precise positioning** controls remain available for exact values.
5. Compare **Original** with **Safe-share preview**.
6. Select **Done**, then save `chat-private.redacted.png`.
7. Repeat with `statement-multipage.pdf`. Add a mark on each page and save `statement-multipage.redacted.pdf`.

The source bytes stay in memory and retain their original digest. The output is a different file: a flattened PNG for an image source or a new image-only PDF for a PDF source.

## Product boundary before QVAC

- `RedactApp.tsx` orchestrates the staged workflow and injectable browser adapters.
- `workflow-domain.ts` owns pure session, mark, audit, and safe-copy transitions.
- `file-policy.ts` accepts PNG, JPEG, and PDF, enforces the 25 MB and 25-page boundaries, and normalizes the optional 500-character direction.
- `rasterize.ts` prepares bounded PNG pages without changing the uploaded bytes.
- `safe-copy.ts` draws opaque masks onto new canvases and creates a separate PNG or raster-image PDF.
- Manual redaction is already useful without a model and must remain available after QVAC is introduced.

The missing intelligence is narrow: inspect each prepared page, locate its text, and propose sensitive regions for human review. A proposal will never become an output mask automatically.

## Known traps established by this baseline

- Native browser objects can expose readable but non-enumerable properties. Returning an `ImageBitmap` as if it were a plain dimensions object caused object spread to drop `width` and `height`; the regression test now requires a plain result.
- `pdfjs-dist` needs an explicit browser worker URL in the production bundle. Unit tests did not expose that missing runtime configuration; the real PDF upload did.
- Canvas encoding can fail. Export therefore uses `OffscreenCanvas.convertToBlob()` where available and keeps a DOM-canvas fallback.
- A covered preview is not yet a safe file. Only **Done** creates flattened output.
- Raster output intentionally does not preserve selectable text or source metadata.
- The first editor exposed X, Y, width, and height as the primary interaction.
  That was useful scaffolding but poor product ergonomics. Direct manipulation
  now drives the same percentage geometry; number fields are a secondary tool.

## Verification receipt

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
git diff --check
```

At the starter baseline, 33 deterministic tests pass. Six Playwright runs cover
desktop and mobile image, JPEG, and multi-page PDF paths. The image test draws
and resizes a mark, downloads the PNG, and checks that a pixel inside the reviewed
mark is black. The PDF test reopens the downloaded file, confirms two pages, and
confirms that source text is not present in the new PDF bytes.
