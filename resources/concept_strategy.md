# Redact QVAC: existing product narrative

This records the already built product for submission packaging. It does not select a new concept.

## Selected Concept

Redact

## One-Line Pitch

Redact uses local QVAC OCR and reasoning to suggest private details in an image or PDF, then lets a person review every mark before exporting a separate flattened copy.

## Target User

Someone who needs to share a screenshot, scan, or PDF while withholding specific personal or business details.

## Job To Be Done

Find likely sensitive fields, correct any misses or false positives, and create a shareable copy without modifying the original document.

## Sponsor Fit

The app declares `@qvac/sdk` 0.20.0 and calls `loadModel`, `ocr`, and `completion` on a local QVAC service. Cached model inference works while outbound network traffic is denied.

## Differentiator

QVAC suggestions are reviewable evidence rather than automatic edits: the user can accept, reject, draw, move, and resize marks, inspect an audit history, and export image-only output. Manual editing remains available if analysis fails.

## Three-Minute Demo

Open the fictional chat image, select Private, show local OCR and six suggestions, accept and reject examples, add a manual mark, and export the flattened PNG. Show the saved copy and unchanged source hash. A separate browser test covers multipage PDF export and manual fallback.
