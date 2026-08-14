# Infuse suggestions into human review

This checkpoint turns advisory candidates into explicit human decisions without
creating a second editor.

- Proposed candidates show Accept and Reject actions and remain outlined only on
  the Original surface.
- Accept creates a normal `RedactionMark` with `source: "accepted"`. The mark is
  editable, appears as an opaque mask in Safe-share preview, and enters export.
- Reject preserves candidate evidence and status but creates no mark.
- Repeating a decision is a no-op.
- Removing an accepted mark resolves the corresponding candidate as rejected.
- Manual marks are neither replaced nor deduplicated by AI state.
- Accept, Reject, manual add/remove, and copy generation appear in Recent
  activity.
- Done is disabled until every candidate on every page is resolved; the domain
  guard enforces the same invariant below the UI.

## Sequencing lesson

The domain guard already existed before review controls. As soon as Episode 06
introduced candidates, that guard made export impossible. Episode 06 therefore
kept candidates advisory with an explicit unresolved override. This checkpoint
adds both decision actions first, then removes the override and enables the real
gate. State invariants must become enforceable only when the user has a path to
satisfy them.

## Verification

```bash
npm test -- src/features/redact/domain.test.ts src/features/redact/RedactApp.test.tsx
npm run lint
npm run typecheck
npm test
npm run build
git diff --check
```
