# Redact

> **Status:** Implemented non-AI UI starter. Redaction is visual and export is simulated; QVAC capabilities remain planned course work.

## 1. Product thesis

A review-first workspace for preparing safer copies of sensitive documents and images.

## 2. Relatable problem

People routinely share screenshots, IDs, receipts, and statements that contain names, account details, faces, QR codes, addresses, or hidden document data. A rushed crop or drawn rectangle can miss something important.

## 3. Target users and jobs

Individuals, support teams, journalists, educators, and small organizations that need a deliberate pre-share check.

## 4. Why this is a complete application

It has a durable collection, repeat visits, editing, inspection, state transitions, history, and a return loop. Its value does not depend on opening a chat box.

## 5. Non-AI starter experience

Browse three deterministic fixture dossiers, place and reposition marks, compare original and safe-share views, inspect a local audit strip, record a simulated export, and reset the entire workspace. State persists in browser storage.

## 6. Detailed use cases

Manual region marking; reversible editing; original-versus-preview inspection; review checklist; auditable export decision.

## 7. Bespoke metaphor and interaction model

A classified dossier on a light table. Marks feel like deliberate black-marker decisions, and trust outranks spectacle. Desktop uses a three-bay intake, light-table, and review layout; narrow screens unfold it as a sequential case file.

## 8. Planned QVAC transformation

Planned QVAC OCR supplies text regions and confidence; multimodal reasoning proposes sensitive areas and explains them. Every candidate remains optional and reviewable.

## 9. Why local inference matters

Uploading the unredacted original to obtain privacy assistance defeats the job. OCR and review should run where the original already lives.

## 10. Capability-to-feature mapping

OCR, multimodal input, and text generation for checklists. OCR does not prove that source content or metadata was securely removed.

## 11. Filmable course demonstration

Manually redact a fixture statement, then compare that with locally proposed regions, catch one false negative, approve the final set, and inspect the audit.

## 12. Research evidence

[QVAC OCR](https://docs.qvac.tether.io/ai-capabilities/ocr/), [NIST de-identification guidance](https://www.nist.gov/publications/de-identifying-government-datasets-techniques-and-governance), [Adobe’s apply-and-sanitize workflow](https://helpx.adobe.com/sg/acrobat/using/removing-sensitive-content-pdfs.html), and a [first-person on-device redaction discussion](https://www.reddit.com/r/SideProject/comments/1ur3f4c/i_built_an_app_that_checks_pdfs_photos_and/).

These sources are evidence of capabilities, existing workflows, or first-person pain signals; they are not presented as market-size proof.

## 13. Alternatives and differentiation

Adobe Acrobat proves that real redaction includes applying removals and inspecting hidden information; Presidio supplies a developer toolkit. Redact differentiates through a focused, inspectable local-learning case study.

## 14. Technical feasibility and boundaries

The starter is a browser UI over fixture media. Export is simulated. Secure PDF object removal, metadata sanitation, video tracking, and legal-grade anonymization are outside its claims.

## 15. Safety, privacy, and failure modes

Automatic detection can miss identifiers or remove useful context. The interface always states that its visual overlay does not securely rewrite a source file or remove hidden metadata.

## 16. Course-fit score

**9.25/10.** The portfolio score weights relatability, local/privacy necessity, filmable transformation, coherent QVAC coverage, implementation feasibility, and case-study depth. See the [portfolio ranking](../README.md#ranked-course-sequence).

## 17. Run, test, and reset

```bash
npm install
npm run dev
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
```

Use the visible **Reset demo data** action to restore the three fixture dossiers. The browser tests expect the local app at `http://localhost:3101`.
