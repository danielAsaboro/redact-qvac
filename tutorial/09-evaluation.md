# Evaluate the local intelligence

This checkpoint replaces anecdotes with a labelled, executable gate. It uses
the real cached OCR and reasoning models; expected regions are used only for
scoring after inference.

## Prepare the controlled rasters

```bash
npm run redact:test-files
```

The generator writes clear, 90-degree rotated, low-contrast, and partially
obscured PNGs under `public/test-files/redact/evaluation`. The source documents
remain controlled, fictional test material.

## Run the gate

Warm both models first with `npm run qvac:ocr-smoke` and one successful Analyze
from the app. Then stop the service so the evaluation process owns the runtime:

```bash
npm run qvac:evaluate
```

Set `REDACT_EVALUATION_CASE=chat-rotated` to isolate one case while diagnosing a
failure. The complete command exits nonzero unless every condition meets:

- IoU at least 0.45 for a same-label, one-to-one region match
- precision at least 0.70
- recall at least 0.70
- F1 at least 0.70

The JSON receipt includes false positives, false negatives, matches, QVAC model
load time, inference-only OCR/reasoning time, and sampled RSS/heap. RSS and heap
are process samples, not operating-system high-water measurements.

## What the first real run taught us

The first complete run failed. Clear and low-contrast passed, partially obscured
missed two labelled regions, and the rotated page produced only one suggestion.
This was not a network problem: all models were already cached and inference ran
locally.

The rotated OCR arrived as vertically fragmented blocks. The analyzer now
detects that shape on a landscape page, retries on a counter-clockwise raster,
and maps the recovered boxes clockwise into the untouched original page's
coordinate system. A real isolated rerun then found six of six regions. This
recovery increased OCR inference to roughly 70 seconds on the recording machine.

The labelled boxes were also tightened to the actual visible text regions. The
earlier boxes covered whole chat-row columns, so correct classifications could
fail IoU. That was an evaluation-label error, not a model error.

The obscured case deliberately retains the hidden address in ground truth. Its
real rerun found five of six: precision 1.00, recall 0.83, F1 0.91. Missing
occluded evidence remains a false negative; the human review workflow is still
required.
