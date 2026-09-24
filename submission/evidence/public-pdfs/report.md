> Scope correction: the export probes below do not establish adequate visual mask coverage, size, or editing stability. See [the subsequent mask audit](../mask-audit.md) for three reproduced defects, fixes, actual browser-output inspection, and remaining limitations.

# Public internet PDF robustness test

Tested 22 September 2026 using Chrome computer use and an independent export-integrity harness. Four downloaded PDFs, 22 pages total. Downloads remain local under `.qvac/public-pdf-tests/` (ignored by Git).

## Corpus

| PDF | Source | Properties verified from the file |
|---|---|---|
| ricoh-normal.pdf | https://origin.pfultd.com/downloads/IMAGE/sample/iX2500_c_normal.pdf | 1 landscape color scan, photographs/charts, zero text objects, fractional page height |
| ricoh-excellent.pdf | https://origin.pfultd.com/downloads/IMAGE/sample/iX2500_c_excellent.pdf | 1 higher-resolution landscape scan, zero text objects, fractional dimensions |
| mozilla-paper.pdf | https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf | 14 pages, dense columns, diagrams/tables, 90 image operations |
| irs-w9.pdf | https://www.irs.gov/pub/irs-pdf/fw9.pdf | 6 pages, 23 form annotations, fractional page dimensions |

The image-only PDF offered at pdftoolskit.org returned HTTP 403 to the downloader and is excluded. Ricoh's two actual image-only scans provide that coverage. Source URLs, sizes and SHA-256 hashes are in sources.json; full page inspection is in inspection.json.

## Defects found and fixed

1. Fractional PDF dimensions failed the integer-only local analysis contract. Raster dimensions now round to actual pixels.
2. PDF rendering used 72 DPI. It now targets 144 DPI within the existing 2400-pixel long-edge cap, while retaining original PDF physical dimensions for output.
3. Dense OCR overflowed Qwen's 4096-token context (observed 6262 input units). OCR is now classified in bounded batches with original block indices retained, including long-line fragmentation and output deduplication.
4. Multipage PDF generation temporarily showed an empty screen. An accessible export-progress state now remains visible.

Regression tests were observed failing before fixes. Final unit/integration suite: 100 passing. Lint, typecheck and production build pass.

## Computer-use results

| PDF | Browser result | AI coverage |
|---|---|---|
| Ricoh normal | Imported, rendered, rejected six spurious proposals, added a manual mask, generated a 1-page 2048 KB PDF | Real offline OCR/reasoning completed: 135 OCR regions; six false suggestions on tiny/blurred text |
| Ricoh excellent | Imported, rendered, rejected nine spurious proposals, added manual mask, generated a 1-page 2503 KB PDF | Real offline OCR/reasoning completed: 140 OCR regions; nine false suggestions |
| Mozilla paper | All 14 pages navigated and marked; generated 14-page 5165 KB PDF | Concurrent analyzer busy state fell back to manual review; NOT a full 14-page AI accuracy test |
| IRS form | All six pages navigated and marked; generated six-page 2200 KB PDF | Concurrent analyzer busy state fell back to manual review; NOT a six-page AI accuracy test |

The full-color images, charts, layout, and form appearance were visible in browser review. The scan results demonstrate pipeline recovery and an OCR quality limitation, not accurate automatic redaction. Human review rejected the inappropriate suggestions. These public documents are not a labelled sensitive-field recall benchmark.

## Independent output integrity

The shared production `generateSafeCopy` function was exercised with Poppler-rendered source pages and a Sharp opaque-mask adapter. This is separate from the browser Canvas adapter and does not stand in for browser-download evidence.

All 22 generated pages were reopened and rendered. Checks passed: page count, original physical dimensions, zero selectable text, zero annotations, opaque black probe pixels on every test mask, and unchanged source hashes. Representative outputs were visually inspected. See export-validation.json and export.log.

Re-run from the workspace:

```sh
cp submission/evidence/public-pdfs/check.mts.txt .qvac/public-pdf-check.mts
node_modules/.bin/tsx .qvac/public-pdf-check.mts
```

The harness is preserved next to this report; inputs/outputs are under `.qvac/`. It requires the installed Poppler utilities. Example generated outputs are test copies with arbitrary manual masks, not documents certified to contain no sensitive information.

## Remaining gaps

- Browser Save copy did not produce a verifiable file in Downloads, and no download event arrived. Opening Chrome's download manager was blocked by browser URL security policy; no workaround was used. Browser download remains unverified.
- OCR on very small scanned text is noisy; both scans produced false suggestions. Do not treat all extracted text or model classifications as correct.
- Complete AI analysis of the 14-page paper and six-page form was not run in this pass.
- This sample set does not cover every PDF feature (e.g. signed, encrypted, XFA, non-Latin OCR, or maximum-size documents).

Final Chrome recheck: cancelling the six-page form analysis kept every page available; selecting Done displayed the accessible Creating your safe copy progress state.

## Final labelled regression evaluation

Bounded reasoning was rerun on all four original labelled fixtures: clear, rotated and low-contrast precision/recall/F1 = 1.0; partially obscured precision = 1.0, recall = 0.8333, F1 = 0.9091. All declared thresholds passed. These results do not measure accuracy on the public PDFs. See evaluation.log.

The final six-page cancellation/progress run reached Your safe copy is ready (2211 KB).
