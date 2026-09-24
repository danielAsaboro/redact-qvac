# QVAC bounty submission checklist

Official source: [QVAC SDK bounty on Whop](https://whop.com/qvac/exp_wznos5cmQd7SQY/app/app/posts/post_1Cf6BActRMK2RVY3m4Lqcd/?a=qvacai). Checked 24 September 2026: Open; Nigeria listed as eligible. Recheck status immediately before submission.

## Product and evidence

- [x] `@qvac/sdk` 0.20.0 declared; real `loadModel`, `ocr`, and `completion` calls.
- [x] Cached local inference proved with remote network denied; no cloud AI service used in the tested path.
- [x] Human review, manual fallback, PNG export, and two-page PDF download exercised in Chromium.
- [x] Production build, TypeScript, lint, 103 unit tests, and browser suite passed in the recorded environment.
- [x] MIT license, install/run README, and a standalone Redact history with three new commits under the configured GitHub no-reply identity.
- [x] [Screenshot with visible AI output](evidence/ai-output.png) on a fictional file.
- [x] [Evidence manifest](evidence/manifest.md), [fresh run report](evidence/2026-09-24-run.md), and [clean-clone report](evidence/clean-clone.md) state the limits, including one missed field in the obscured evaluation case.

## Publication and final entry

- [ ] Review the [release handoff](release-handoff.md) and standalone candidate; confirm the planned public repository name/account. Keep the private `bring-ai-home` monorepo private.
- [ ] Publish only the standalone Redact candidate as a public GitHub repository; verify the URL, MIT license, README, source history, and screenshot are visible without login.
- [ ] Publish the [X draft](submission-copy.md) with the verified public repository URL, tag `@qvac`, and attach the AI-output screenshot. Verify the public X URL.
- [ ] Sign in to Whop, stage the public GitHub URL, X URL, one or two-line description, and screenshot from [submission-copy.md](submission-copy.md).
- [ ] Review the filled entry and perform the final Whop submission yourself.

No public repository, X post, or Whop entry has been created by this packet.
