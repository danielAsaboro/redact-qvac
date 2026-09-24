For the latest public internet PDF testing and subsequent fixes, see [public-pdfs/report.md](public-pdfs/report.md). The earlier run below is retained as history.

# Redact verification and handoff

Tested with computer use in Codex's in-app browser, using fictional fixtures only. No private documents uploaded. No public publication or bounty submission performed.

## Active configuration

- Workspace: `/Users/MAC/.codex/worktrees/redact-qvac-release/apps/redact`
- Branch: `codex/redact-qvac-release` (based on `course/redact-qvac`)
- Original main/course checkout preserved.
- SDK 0.20.0; Next 16.3.5; OCR_LATIN and QWEN3_600M_INST_Q4.
- Frontend: http://127.0.0.1:3101
- Local QVAC service left running using `npm run qvac:service:offline`.

## Commands

From the workspace above:

```sh
npm ci
npm run qvac:ocr-smoke
npm run qvac:service:offline
# Separate terminal:
npm run build
npm run start -- --hostname 127.0.0.1 --port 3101
# Verification:
npm run lint
npm run typecheck
npm test
npm run qvac:evaluate
npm run qvac:offline
```

Offline service requires warmed model cache. Initial model downloads require internet. macOS sandbox-exec provides the recorded outbound-network denial; other operating systems need their own firewall isolation for equivalent proof.

## Browser observations

- PNG: 12 OCR blocks and six proposals, mandatory human review, accept/reject, manual drawing/resizing, flattened output and clipboard.
- Saved PNG in the operator's Downloads folder: 1200x1600, 81731 bytes. Name/manual-email/phone test pixels were opaque black.
- Confidential two-page PDF: 12 proposals per page after correction (24 total), reviewed independently; generated two-page output.
- Service-off manual fallback: manual masks on both pages, output generation, clipboard success.
- JPEG: imported and flattened to PNG. Malformed PDF: readable error and recovery to new upload.
- 390px viewport: document panels stacked, document width matched viewport, no horizontal overflow.

## Remaining verification gap

In-app browser Save copy did not yield a PDF on disk, including with a persistent native download link and the browser file-download action. Therefore this report does not claim verified saved-PDF integrity or complete cross-browser export. The persistent link has a unit-verified filename/blob URL and lifecycle cleanup; its final browser PNG download also did not create an additional file. The earlier PNG adapter download did save successfully. Browser-host download behavior remains unresolved. The Playwright E2E suite was not executed; computer-use checks above are separate evidence.

## Source integrity

PNG SHA-256 before and after: `6c19d1f974f4a66aad5823d3ec6bc8d5f2b37e7cd1e62bc3cfe1cc651a1e2521`.

PDF SHA-256 before and after: `eb0d175fbdad8a3dc29ebfc643b59860e777a4bda9a4e3400daa8baf380f18cf`.

## Scope limits

Human review remains required. OCR and model recall are imperfect; a small fictional-fixture evaluation is not a privacy guarantee. Public repository/X evidence and bounty submission remain outstanding. Nigeria was present in the official eligible-country dialog at inspection time.

## Final labelled evaluation

SDK 0.20.0, policy v3: all four cases passed the declared thresholds. Clear, rotated, and low-contrast cases: precision/recall/F1 1.0. Partially obscured: precision 1.0, recall 0.8333, F1 0.9091 (one missed field). Full real-runtime output is in evaluation.log.
