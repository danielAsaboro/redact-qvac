# Redact QVAC release handoff — review before publication

This packet stops before public publication and the final Whop entry. The standalone release branch is `codex/redact-qvac-submission`, built from the Redact-only subtree. Its working copy is `/private/tmp/redact-release-candidate-2026-09-24`. The durable Git bundle is `submission/redact-qvac-review.bundle` beside this handoff (generated after the documentation commit). The candidate has no private-parent Git remote.

## Review now

1. Read the [evidence manifest](evidence/manifest.md), [fresh run](evidence/2026-09-24-run.md), [clean-clone report](evidence/clean-clone.md), and [known limits](blockers.md).
2. Inspect [AI-output screenshot](evidence/ai-output.png), [submission copy](submission-copy.md), and [checklist](submission-checklist.md).
3. Inspect the standalone source and history: `git clone -b codex/redact-qvac-submission submission/redact-qvac-review.bundle /private/tmp/redact-qvac-bundle-review` from this app directory, then `cd /private/tmp/redact-qvac-bundle-review && git log -3 --format='%h %an <%ae> %s' && git status --short`.

The planned public URL is `https://github.com/danielAsaboro/redact-qvac`. That repository did not exist at the time of preparation. It is a proposed destination, not a verified submission link.

## Publish only after review

Use a fresh clone of the bundle or the standalone candidate. The standalone candidate has no remote; a bundle clone has a local `origin` pointing back to the bundle. Remove any existing remote, rename the release branch to `main`, and confirm the source tree is clean before creating the public repository. With `gh` authenticated to `danielAsaboro`, the intended commands are:

```sh
git remote remove origin # only if git remote -v shows a local bundle origin
git branch -m main
git status --short
gh repo create danielAsaboro/redact-qvac --public --source . --remote origin --push
```

After publication, open the repository without signing in and verify its README, MIT license, source, history, and screenshot. Replace `[PUBLIC_GITHUB_REPO_URL]` in the [X draft](submission-copy.md), attach the screenshot, and publish the post tagging `@qvac`. Verify its public URL. Sign in to the [Whop bounty](https://whop.com/qvac/exp_wznos5cmQd7SQY/app/app/posts/post_1Cf6BActRMK2RVY3m4Lqcd/?a=qvacai), stage the repository URL, X URL, description, and screenshot, then let the user review the filled entry. The final Whop submission is reserved for the user.

## Run the app from the standalone candidate

Use Node 22.17 or newer. On a fresh machine, `npm ci` and the first QVAC analysis download local model files into ignored `.qvac/models`. In separate terminals, run `npm run qvac:service` and `npm run dev -- --hostname 127.0.0.1 --port 3101`; then open `http://127.0.0.1:3101`. On macOS, `npm run qvac:service:offline` runs the cached service with remote network denied. The fresh install, build, real inference, and production browser results are recorded in the linked reports.
