# Redact QVAC submission evidence — 24 September 2026

`verified` describes only the environment and behavior cited in its row. Earlier investigations remain in [verification.md](verification.md), [mask-audit.md](mask-audit.md), and [public-pdfs/report.md](public-pdfs/report.md). Fresh results are summarized in [2026-09-24-run.md](2026-09-24-run.md).

| Claim | Status | Evidence |
|---|---|---|
| SDK 0.20.0 and supported calls | verified | `package.json` pins `@qvac/sdk` 0.20.0; `qvac-service/index.ts`, `qvac-analyzer.ts`, and `reasoning.ts` call `loadModel`, `ocr`, and `completion` |
| Real local OCR and reasoning | verified | `2026-09-24-run.md`: live Chromium receipt passed; `ai-output.png` shows 12 OCR regions and six suggestions from the fictional fixture |
| Cached inference while remote networking is denied | verified | `2026-09-24-run.md` and `clean-clone.md`: `npm run qvac:offline` returned `osNetworkDenied: true`, 12 OCR blocks and six suggestions |
| Human review and flattened PNG export | verified | `2026-09-24-run.md`: real-QVAC Chromium test accepted and rejected suggestions, added a mark, downloaded PNG, checked an opaque name pixel, and checked unchanged source bytes |
| Multipage PDF download in Chromium | verified | `2026-09-24-run.md`: desktop and mobile Playwright tests downloaded a two-page PDF and loaded it with `pdf-lib`; the older in-app browser save issue remains environment-specific |
| Manual fallback and common file paths | verified | `2026-09-24-run.md`: browser tests blocked the service, then exercised PNG/JPEG import, drawing, resize, export, two-page PDF, and 390px layout; invalid-PDF coverage is in `rasterize.test.ts` |
| Automated tests, types, lint, and production build | verified | `2026-09-24-run.md` and `clean-clone.md`: 103 unit tests; seven browser tests passed with live QVAC enabled and one mobile live case intentionally skipped; clean install, lint, typecheck, and build exited zero |
| Controlled real-model evaluation | verified | `2026-09-24-run.md`: four fixtures passed declared thresholds; the partially obscured case missed one of six fields |
| Production dependency audit | verified | `2026-09-24-run.md`: `npm audit --audit-level=high --omit=dev` found zero vulnerabilities |
| Source fixture unchanged | verified | `2026-09-24-run.md`: live browser receipt compared SHA-256 and exact source bytes before and after export |
| Open bounty and Nigeria eligibility | verified | [Live Whop bounty page](https://whop.com/qvac/exp_wznos5cmQd7SQY/app/app/posts/post_1Cf6BActRMK2RVY3m4Lqcd/?a=qvacai) showed Open and listed Nigeria on 24 September 2026 |
| Standalone authored history | verified | The [public Redact-only release](https://github.com/danielAsaboro/redact-qvac) preserves 18 earlier subtree commits and three substantive release commits authored as `danielAsaboro` with the configured GitHub no-reply address |
| Public licensed GitHub release | verified | [Public repository](https://github.com/danielAsaboro/redact-qvac) showed its README, MIT license, screenshot, source, and 21 commits in Daniel Chrome on 24 September 2026 |
| X post linking repo and tagging @qvac | incomplete | Draft saved under `@useLeash` with the public repo URL, `@qvac` tag, AI-output image, and alt text; no published X URL |
| Final Whop entry | incomplete | The page requires the public GitHub and X URLs plus visual proof; Daniel Chrome is signed out of Whop and no entry has been submitted |

The screenshot uses a controlled fictional file. Evaluation recall and a successful export do not guarantee that every sensitive field in an arbitrary document was found or covered; the user must inspect each page.
