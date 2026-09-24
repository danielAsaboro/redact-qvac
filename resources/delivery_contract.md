# Redact QVAC release delivery

## Vertical Slice
Open a fictional PNG or PDF locally, run QVAC OCR and sensitivity classification, review proposals, add manual coverage, and export a separate flattened copy.

## Definition of Done
QVAC SDK >=0.19.0 pinned; production build and automated checks pass; computer-use inspection proves live AI suggestions, human review, export, PDF handling, and manual fallback. Source bytes remain unchanged. README documents exact setup and version; open-source license included. Publication and submission remain pending user review.

## Judging Traceability
- QVAC dependency and API calls: manifest plus actual loadModel/ocr/completion execution.
- On-device inference: loopback service and a network-denied cached-model run.
- Working application: computer-use workflow and exported copy.
- Reproducible source: installation instructions, license, existing authored history.
- Public GitHub/X and country eligibility: external gates, not local implementation proof.

## Build Sequence
1. Restore AI branch in isolated workspace and upgrade SDK.
2. Run static, unit, integration, and build checks; correct incompatibilities.
3. Warm models and run real inference.
4. Exercise application with computer use and inspect output.
5. Record evidence and remaining external gates.

## Demo Route
Verification only: fictional image -> Private -> local analysis -> accept/reject -> manual mark -> export; then multipage PDF and service-unavailable fallback. No submission media is produced.

## Failure Conditions
Cloud inference, missing model output, silent acceptance, recoverable source text in output PDF, modified originals, unsupported SDK calls, or claims based only on mocks invalidate the corresponding proof.
