# Make local analysis survive failure

This checkpoint hardens both sides of the loopback boundary while preserving the
manual product path.

## Browser behavior

- Every health and analysis request has a 190-second client timeout.
- Caller cancellation and timeout produce different messages.
- One AbortController and monotonically increasing sequence guard each workflow
  run. A late completion from an old request cannot overwrite current review.
- Operational pages/evidence stay in refs; the visible `canCancel` flag is React
  state. Reading a ref during render was rejected because ref updates do not
  schedule a render.
- Continue without local analysis becomes available after rasterization. It
  opens Review with any pages and evidence already completed.
- Failed Review exposes Retry local analysis. Manual add/edit/export remains
  usable while the service is absent.

## Service behavior

- The service reserves its single inference slot before awaiting the request
  body. A staged upload cannot race a second request into QVAC.
- A concurrent request returns 409; wrong media returns 415; wrong method returns
  405; oversize payload returns 413; invalid input returns 400.
- The service timeout is 180 seconds and malformed analyzer output returns 502.
- A timeout or disconnected client does not imply native inference stopped. The
  service remains busy until the underlying operation settles, preventing an
  unsafe overlapping retry.
- Shutdown stops the server and then unloads models/closes the SDK once.

## Important limitation

The current QVAC operation is not cancelled at the native inference layer.
Browser cancellation is a product-control action: it stops waiting and opens
manual review. Health may remain `busy: true` until the local operation finishes.
Retry should be attempted after the slot is released.

The first combined verification shell also continued after lint failed, so a
later successful command produced a misleading final exit status. Check each
gate's status independently (or use a fail-fast runner); do not infer that every
earlier command passed from the last command alone.

## Verification

```bash
npm test -- src/features/redact/analysis-client.test.ts qvac-service/server.test.ts src/features/redact/RedactApp.test.tsx
npm run lint
npm run typecheck
npm test
npm run build
git diff --check
```
