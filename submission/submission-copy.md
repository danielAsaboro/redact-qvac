# QVAC bounty submission copy — review draft

## One or two lines for Whop

Redact uses `@qvac/sdk` 0.20.0 with `loadModel`, `ocr`, and `completion` to find likely sensitive details locally in images and PDFs. People review each suggestion, add or adjust masks, and export a separate flattened copy; manual editing works when analysis is unavailable.

## Optional why-I-built-it line

I wanted a practical way to check private details before sharing a document while keeping inference and the original file on my machine.

## X post draft

> Your document may expose more than you meant.
>
> I built Redact with @qvac SDK 0.20.0: OCR + reasoning run locally and suggest private details. Review every mask, then export a flattened copy; the original stays untouched.
>
> Code: https://github.com/danielAsaboro/redact-qvac

This draft is saved in Daniel Chrome under `@useLeash` with [ai-output.png](evidence/ai-output.png) attached and descriptive alt text. The image shows real local model output on a fictional fixture. Review the account and copy before posting.

## Exact Whop entry values to stage after publication

- **Public GitHub repository URL:** `https://github.com/danielAsaboro/redact-qvac`
- **X post URL:** `[PUBLISHED_X_POST_URL]`
- **Description:** Use the two-line copy above.
- **Visual proof:** Upload [ai-output.png](evidence/ai-output.png). It shows 12 locally found text regions and six suggestions.
- **Optional reason:** Use the line above only if the form offers the field.

The [evidence manifest](evidence/manifest.md) supports the local-product claims. This draft does not claim guaranteed detection or a published X post.
