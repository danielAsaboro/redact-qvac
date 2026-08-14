# Map OCR evidence onto the existing light table

QVAC returns pixel edges. Redact's editor and export pipeline use percentages.
This checkpoint introduces the single conversion boundary between them.

## Conversion order

1. The service runtime-validates QVAC's raw block shape.
2. The typed client runtime-validates the HTTP response.
3. `normalizeOcrBbox` verifies finite values and positive source dimensions.
4. It sorts reversed edges, clips them to the decoded raster, and drops
   zero-area or fully clipped boxes.
5. It converts the remaining box to six-decimal percentage geometry.
6. `DocumentSurface` renders evidence over the same raster bytes that were
   analyzed.

For the controlled page, QVAC's `[211,114,397,158]` box on a 1200×1600 raster
becomes:

```json
{ "x": 17.583333, "y": 7.125, "width": 15.5, "height": 2.75 }
```

The raw box remains on the `OCRBlock` receipt; normalized geometry drives the
UI. OCR evidence appears only on the Original surface. It is not blacked out in
the Safe-share preview because text detection is not yet a sensitivity decision.

## Build lesson

The first exact geometry assertion exposed JavaScript's
`7.124999999999999` floating-point representation. Normalizing to six decimal
places at the boundary makes state, styles, tests, and audit output stable.

The first verification attempt also ran `next typegen` and `next build` in
parallel. Both mutate `.next/types`, so typecheck briefly lost files while build
rewrote the directory. Run those two checks sequentially; parallel verification
is safe only when commands do not share generated state.

## Verification

```bash
npm test -- src/features/redact/ocr-geometry.test.ts src/features/redact/RedactApp.test.tsx
npm run lint
npm run typecheck
npm test
npm run build
git diff --check
```
