# Run QVAC beside Redact

This checkpoint proves local OCR independently of the browser product. Redact remains the same complete manual workflow from Episode 01.

## Run the controlled page

```bash
npm ci
npm run redact:test-files
npm run qvac:ocr-smoke
```

The default input is `public/test-files/redact/chat-private.png`. You can pass another local PNG or JPEG path as the final argument.

The command creates `.qvac/config.json` and `.qvac/models/` inside the Redact app, sets `QVAC_CONFIG_PATH` before importing the SDK, loads the pinned `OCR_LATIN` model with its explicit configuration, runs OCR, awaits both blocks and timing statistics, unloads the model without clearing its cache, and closes the SDK.

The receipt prints:

- the source filename;
- the SHA-256 digest of the exact input bytes;
- the project-local cache directory;
- detected OCR blocks, including text and geometry supplied by QVAC;
- SDK timing statistics when available.

On the controlled chat page used for this checkpoint, the real run returned 12
blocks in about 28.5 seconds. It correctly found `Maya Chen`, `18 Willow Road`,
the phone number, the account number, and `APOLLO-4471`. It also returned
`maya.chen@example com` without the dot and split `My phone is ...` into two
blocks. That is useful evidence, not a redaction verdict: downstream code must
expect imperfect text and fragmented lines.

It deliberately does not print or accept a browser-facing `imagePath` contract. A filesystem path is acceptable inside this standalone command; later episodes send uploaded raster bytes across a typed loopback boundary.

## Cold and warm behavior

The first successful run may require network access to download the pinned OCR assets. A warm run reuses the project-local cache. If download or inference fails, do not treat a UI fixture as proof that OCR worked: preserve the error, distinguish network/model lifecycle from application code, and rerun the same source after the prerequisite is available.

During this checkpoint, an interrupted dependency installation left
`@qvac/sdk` visible while its native `@qvac/llm-llamacpp` plugin was absent. The
Bare worker then failed with `MODULE_NOT_FOUND`. The fix was to complete the
locked dependency installation—not to change OCR code or disguise the failure
with fixture output. A second cached run still spent about 27.1 seconds on OCR;
"warm" means no model download, not guaranteed instant inference.

## Verification

```bash
npm test -- qvac-service/local-config.test.ts
npm run lint
npm run typecheck
npm test
npm run build
git diff --check
```

The automated suite validates local path ownership and the digest-backed receipt shape without downloading a model. The opt-in smoke command is the real inference receipt.
