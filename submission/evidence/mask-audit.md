# Mask geometry audit — 22 September 2026

The earlier public-PDF checks established import and export plumbing, not adequate visual redaction quality. Arbitrary rectangles and one black-pixel probe per page did not establish target coverage, correct region size, shape, or interaction stability.

## Defects reproduced and fixed

1. Manual IDs reused the remaining mark count. Delete the first of two masks, add another, then nudge it: both surviving masks shared an ID and moved together, uncovering the car plate. Manual masks now use unique IDs. The exact sequence was repeated in Chrome; the plate geometry remained unchanged while the new mask moved.
2. Fast northwest resizing updated position against the old dimensions before updating size. The opposite corner drifted. Geometry now updates atomically against the new dimensions. A regression that expected x=80%, width=10% previously received x=20% and now passes.
3. Preview edges used fractional percentages and a minimum CSS size while export rounded outward to whole raster pixels. Preview now uses the same pixel rectangle as export, pure black, square corners, and no minimum CSS enlargement. A subpixel regression fails before the change and passes after it.

## Actual browser visual checks

Source: the public Ricoh excellent scanned PDF (1680 × 1191 raster), containing text, car photographs and charts. Manual targets were chosen deliberately; this is not an AI detection accuracy result.

- A header-text mask was inspected through the browser-generated clipboard PNG: text covered, adjacent blue decorations preserved.
- After the ID fix, deletion/replacement and keyboard nudge left the plate mask unchanged.
- Northwest, northeast and southeast corner adjustments were performed on the plate. Southwest handle was exercised at its existing corner, so it is not evidence of a substantive southwest resize.
- Final plate geometry: x=42.7%, y=58%, width=7.1%, height=3.5%. Preview rounds outward to the same raster boundaries as export.
- Final second target: the 4.0s text at upper left. The actual browser-generated clipboard PNG was viewed at 1680 × 1191: both this text and the blue car plate are fully covered with solid rectangular masks; no visible target fragments remain at their edges. Nearby text, charts, and car imagery remain visible.
- At 390px viewport, masks retained their document-relative positions and preview rounding. Small-mask resize handles visibly overlap. Viewport override was reset afterward.

The clipboard PNG is actual browser Canvas output. It does not prove that the PDF download-to-disk path works; that remains unverified.

## Remaining limitations

There is no blur mode or nonrectangular mask shape: output uses opaque rectangles. Default Add redaction boxes have arbitrary placement and size. Raw OCR outlines clutter dense documents. There is no zoom, and tiny targets have overlapping resize handles on mobile. These are unresolved editing-quality limitations, not passing acceptance criteria. The three correctness fixes do not establish comprehensive visual QA across the entire corpus.

## Automated verification

103 tests pass, including three newly failing-then-passing regressions. Lint, typecheck and production build pass. Logs are in masks/. These checks support the specific fixes; they do not substitute for visual coverage inspection.
