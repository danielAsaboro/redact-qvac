# Redact production document workflow design

**Date:** 2026-08-14
**Status:** Approved for implementation
**Scope:** Replace the fixture-led single-screen Redact workspace with a real, guided, local-first image and PDF redaction workflow; then rebuild the ten-episode QVAC course history and scripts around that finished starting product.

## Product claim

People commonly share screenshots, chat captures, scans, and PDFs by manually drawing over private information. That familiar workflow is fragile: a reviewer may miss another identifier, cover a region incompletely, or create only the appearance of removal while the underlying file still contains recoverable text or metadata.

Redact provides a guided workflow for uploading a real image or PDF, selecting a confidentiality policy, adding document-specific instructions, running local QVAC analysis, reviewing every proposed region, and creating a separate flattened safe copy without modifying the original.

QVAC supplies local OCR and grounded suggestions. It never grants final redaction authority. Human decisions and deterministic export code produce the safe copy.

## Goals

- Accept real PNG, JPEG, and PDF uploads through drag-and-drop or a file picker.
- Preserve the original input bytes and never overwrite the source file.
- Provide two confidentiality levels: Private and Confidential.
- Accept a short optional prompt describing additional content to redact.
- Analyze raster pages locally through the loopback QVAC service.
- Present a dedicated split review stage with original and safe-share views.
- Support accept, reject, adjust, relabel, remove, and manual redaction actions.
- Generate a separate flattened PNG or raster-image PDF.
- Provide Copy to clipboard and Save actions where the platform supports them.
- Keep the manual workflow available when QVAC is unavailable.
- Keep all customer-facing language product-grade; controlled test documents remain test infrastructure only.
- Preserve exactly ten tutorial episode commits, each matching the behavior taught in its script.

## Non-goals

- Excel or other spreadsheet redaction.
- Preserving selectable PDF text in the generated safe copy.
- Modifying or replacing the original input file.
- Cloud OCR or reasoning fallback.
- Automatic acceptance of model suggestions.
- Legal certification that every possible sensitive category was detected.
- Persistent storage of uploaded source files across browser sessions.
- A general document-management dashboard, inbox, or dossier system.

## Product flow

The product uses four visible stages and one completion state.

### 1. Upload

The first viewport contains the Redact identity, a short local-processing assurance, and one dominant upload surface. Users may drag a file onto the page or open the system file picker.

Accepted input types are PNG, JPEG, and PDF. Validation occurs before leaving the stage:

- supported MIME type and extension;
- non-empty file;
- maximum source size of 25 MB;
- maximum PDF page count of 25 pages;
- PDF is readable and not password-protected;
- every page can be rasterized.

An invalid file remains on Upload with a specific, recoverable explanation. The interface contains no seeded customer documents, demo reset, fixture disclaimer, dossier tray, or simulated export.

### 2. Configure

The user sees the selected filename, file type, page count, a local preview, and two confidentiality choices.

**Private** proposes personal identifiers:

- natural-person names;
- email addresses;
- phone numbers;
- postal addresses;
- account numbers;
- passport, national ID, tax ID, and similar identifiers.

**Confidential** includes every Private category plus:

- financial amounts;
- dates and periods when document context makes them sensitive;
- transaction and reference numbers;
- project, customer, employee, or business-sensitive text supported by the document evidence.

The user may add a short instruction such as “also hide employee IDs and the Apollo project name.” The prompt is local reasoning guidance, not an executable command and not permission to accept marks.

Changing the confidentiality level or prompt after a completed analysis marks that result stale and requires a new analysis before export.

### 3. Analyze

Redact rasterizes input locally and processes pages sequentially to bound memory use. The interface reports truthful page-level stages:

- preparing pages;
- reading text;
- finding sensitive fields.

It does not display invented completion percentages. The user may cancel. Cancellation returns to Configure without mutating the original or retaining a late result.

If the service is unavailable, times out, returns malformed output, or fails inference, the user may retry or continue to manual review. No failure silently changes the privacy boundary or routes the document to a cloud service.

### 4. Review

Desktop review presents the original and safe-share preview side by side, with a separate review queue. Responsive layouts may stack the panes, but the distinction remains explicit.

Each proposed region shows its label, evidence, explanation, available OCR confidence, and review controls. The user may:

- accept a proposal;
- reject a proposal;
- adjust its bounds;
- relabel it;
- add a manual region;
- move, resize, relabel, or remove an accepted/manual region;
- navigate pages while seeing unresolved counts.

Only accepted and manual regions appear as covered pixels in the safe-share preview. Proposed and rejected candidates remain evidence and audit history, not output authority.

Done is blocked while unresolved suggestions remain unless the user explicitly confirms “Finish with unresolved suggestions.” That confirmation is auditable and does not silently mark the suggestions accepted.

### Completion

Done creates a new flattened copy from the current reviewed state. The original remains available in the session but untouched.

- Image input produces a separate PNG.
- PDF input produces a new PDF whose pages contain flattened raster images only.
- Image output provides Copy to clipboard and Save copy.
- PDF output provides Save safe PDF; Copy copies the current safe page as a PNG.
- Returning to Review keeps the upload and decisions alive for the current session.

Export failure preserves the entire review session and permits retry.

## Application state model

The product state is session-oriented and explicit.

```ts
type WorkflowStage =
  | "upload"
  | "configure"
  | "analyzing"
  | "review"
  | "exporting"
  | "complete";

type ConfidentialityLevel = "private" | "confidential";

type SourceDocument = {
  id: string;
  name: string;
  mimeType: "image/png" | "image/jpeg" | "application/pdf";
  byteSize: number;
  pageCount: number;
  originalBytes: ArrayBuffer;
  originalDigest: string;
};

type RasterPage = {
  id: string;
  documentId: string;
  pageNumber: number;
  width: number;
  height: number;
  pngBytes: ArrayBuffer;
};
```

Analysis runs record the document digest, raster configuration, confidentiality level, prompt, model identifiers, timings, completion state, and error. A result is current only when all analysis inputs match the active configuration.

Redaction candidates preserve proposed, accepted, and rejected states. Accepted output regions and manual regions share one deterministic geometry model. Stable candidate identity prevents repeated analyses from resurrecting previously reviewed evidence or duplicating marks.

Uploaded bytes, raster pages, generated blobs, and active workflow state remain in memory by default. Redact does not write source files into localStorage. Temporary loopback-service resources are scoped to an analysis session and removed after completion, cancellation, expiration, or service shutdown.

## Local file-processing architecture

### Browser responsibilities

- read the selected `File` without mutating it;
- calculate a digest used for run identity and unchanged-input verification;
- rasterize images and PDF pages;
- maintain object URLs for current-session previews;
- render the split review surface;
- draw accepted/manual masks into new canvases;
- produce flattened PNG blobs;
- assemble flattened raster pages into a new PDF;
- invoke clipboard and download APIs;
- release object URLs and in-memory bytes when the session ends.

PDF rasterization and PDF creation use pinned libraries compatible with the existing Next.js application. Each page is rasterized with a maximum long edge of 2400 pixels, preserving aspect ratio, and processed sequentially to prevent unbounded memory growth.

### Loopback-service responsibilities

The browser sends raster page bytes and trusted session metadata over loopback. The service does not accept arbitrary filesystem paths from the UI.

The service:

- validates origin, request size, document/run identifiers, MIME type, page number, and raster dimensions;
- reserves the single-analysis lock before awaiting request data;
- invokes cached QVAC OCR on the supplied raster;
- sends grounded OCR evidence into the pinned local reasoning model;
- applies runtime schema and semantic validation;
- returns percentage geometry associated with page IDs;
- owns model loading, reuse, unload, timeout, and shutdown.

The service never modifies the original upload and has no cloud fallback.

## Analysis policy and custom prompt

The base policy is deterministic application configuration. Private and Confidential expand into explicit allowed labels and written classification rules before the model request.

The custom prompt is bounded:

- maximum length of 500 characters is enforced;
- it is framed as additional categories or context to inspect;
- it cannot change the response schema;
- it cannot request file operations or automatic acceptance;
- every selected block must still reference supplied OCR evidence;
- returned categories must map into an allowed product label;
- unknown or ungrounded references fail validation.

Prompt-driven proposals remain proposed. The UI identifies their evidence and reason in the same review queue as base-policy proposals.

## Raster export guarantees

The exporter constructs output from raster pages and reviewed geometry rather than copying source PDF objects.

For each page it:

1. creates a canvas at the pinned export resolution;
2. draws the source raster;
3. draws opaque masks over every accepted or manual region;
4. encodes a new PNG;
5. for PDF output, embeds only the flattened PNG into a newly created page.

The exporter does not copy original PDF metadata, attachments, annotations, form objects, JavaScript, hidden layers, or selectable text. Generated filenames are derived safely, for example `report.redacted.pdf` and `screenshot.redacted.png`.

The original digest is recalculated after export in tests and must remain unchanged. Rasterization deliberately trades selectable text and vector fidelity for a smaller, auditable v1 safety boundary.

Clipboard writes use `navigator.clipboard.write` when permitted. Permission or browser failure produces a visible message and leaves Save available. Clipboard support never gates export completion.

## Error and recovery contract

| Failure | User outcome | Preserved state | Recovery |
|---|---|---|---|
| Unsupported or invalid upload | Remain on Upload with exact reason | No session mutation | Choose another file |
| Encrypted/unreadable PDF | Remain on Upload | Original selection details only | Choose an unlocked copy |
| Rasterization failure | Remain on Upload or Configure by phase | Original bytes | Retry or replace file |
| Service unavailable | Analyze reports local service unavailable | Upload and configuration | Retry or continue manually |
| Analysis timeout | User-facing request ends; service lock remains honest until work settles | Upload and configuration | Retry when available or continue manually |
| Cancellation/navigation | Late result ignored | Upload and configuration | Restart analysis |
| Malformed model/service output | No partial candidate mutation | Upload, configuration, prior reviewed work | Retry or continue manually |
| Export failure | Remain in Review with decisions intact | Entire review session | Retry Copy/Save/export |
| Clipboard denied | Safe copy remains ready | Generated blob and review state | Save copy instead |

No error automatically advances the workflow or sends data externally.

## Testing strategy

### Deterministic tests

- stage transition and back-navigation rules;
- upload MIME, size, encryption, page-count, and rasterization validation;
- confidentiality-level policy expansion;
- prompt length, grounding, and stale-analysis behavior;
- coordinate conversion and page association;
- candidate identity and accept/reject idempotency;
- adjust, relabel, manual add, move, resize, and remove transitions;
- unresolved-suggestion completion gate;
- filename generation;
- canvas/PDF export dimensions and page count;
- output masks cover the expected pixels;
- output PDF contains raster page images and no copied source text/metadata;
- original input digest remains unchanged;
- clipboard denial preserves Save.

### Controlled file corpus

Private test assets cover:

- PNG and JPEG;
- single-page and multi-page PDF;
- portrait, landscape, and rotated pages;
- low-contrast and partially obscured text;
- password-protected/unreadable PDF;
- oversized file and page-count rejection;
- private and confidential policy differences;
- prompt-specific project or employee identifiers.

These assets are test infrastructure and are never presented as customer demo documents.

### Browser workflow tests

- upload through file picker and drag-and-drop;
- configure each confidentiality level and custom direction;
- analyze progress, cancellation, retry, and manual continuation;
- original/safe split review across pages;
- accept, reject, adjust, and manual correction;
- unresolved completion confirmation;
- Done creates a safe copy;
- image clipboard/save behavior;
- PDF current-page clipboard and full-document save;
- review state survives export failure;
- original bytes remain unchanged.

### Real QVAC receipts

Real-model verification remains opt-in and uses cached pinned models. It covers image and multi-page PDF raster analysis, policy-sensitive proposal sets, review, and export. Quality evaluation keeps labelled clear, rotated, low-contrast, and partially obscured cases. Offline proof distinguishes a process-level network guard from an operating-system-disconnected recording.

## Course and Git history

The current course history is rebuilt because it starts from an obsolete fixture-led product surface.

1. A new Redact starter commit on `main` contains the finished non-AI upload, configure, manual review, and raster export workflow.
2. `course/redact-qvac` is rebuilt from that baseline with exactly ten episode commits.
3. Episode 01 opens and explains the already-finished product. It does not teach UI construction.
4. Episode 02 proves standalone local OCR against controlled test documents.
5. Episodes 03–10 progressively add the loopback boundary, uploaded-page OCR, overlays, policy reasoning, human review, resilience, evaluation, and warmed offline proof.
6. Every checkpoint remains buildable, tested, manually usable, and restricted to behavior taught in its matching script.

Customer-facing code and narration remove “demo,” “fixture,” “dossier,” “simulated export,” and “reset demo data.” The word “fixture” remains only where the course is explicitly discussing controlled test/evaluation data.

## Script direction

Episode 01 begins with the familiar sharing scenario:

- someone needs to send a chat capture, screenshot, scan, or PDF;
- they take a screenshot or open an annotation tool;
- they blot out names, emails, private conversations, account details, or references;
- they may miss another critical region or cover one incompletely;
- Redact turns that improvised behavior into a deliberate local workflow.

The narration then enters the real Upload screen, chooses a confidentiality level and optional direction, analyzes locally, reviews original versus safe-share output, and generates a separate flattened copy.

Every episode follows challenge → observable symptom → diagnosis → correction → focused receipt. Measured failures are shown honestly. Deterministic tests reproduce timing-dependent or malformed-output failures. No staged model error is presented as a live result.

## Completion criteria

Implementation is complete only when:

- the product flow and language match this design;
- PNG, JPEG, and PDF input work end to end;
- raster safe-copy output is generated without changing original bytes;
- clipboard and save paths behave as specified;
- manual review remains available without QVAC;
- deterministic, browser, real-model, evaluation, and offline receipts pass at their documented scopes;
- the rebuilt branch contains exactly ten matching episode commits;
- all ten production scripts match the code and visible behavior at their pinned commits.
