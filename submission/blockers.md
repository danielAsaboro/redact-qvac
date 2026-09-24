# Submission blockers and limits

## Required external gates

1. **X post URL:** A [draft](submission-copy.md) with the [public repository](https://github.com/danielAsaboro/redact-qvac), `@qvac` tag, and [AI-output screenshot](evidence/ai-output.png) is saved under `@useLeash`. It has not been posted, so there is no X URL yet.
2. **Whop entry:** The inspected page displayed “Sign in to attempt this bounty.” Once signed in, the public GitHub URL, X URL, description, and screenshot must be staged and reviewed. The final submission is reserved for the user.

## Product limits to keep visible

- One of six expected fields was missed in the partially obscured evaluation case. Human review of every page remains necessary.
- OCR outlines can clutter dense pages. There is no zoom; small mobile resize handles can overlap; default manual boxes require placement by the user.
- The Chromium tests verified two-page PDF download and parsing. An earlier Codex in-app browser session could generate a PDF but could not save it to disk; that browser-host behavior remains unverified.
- Local Mac and Chromium tests do not prove every operating system, browser, document, or redaction policy. The product does not claim legal-grade redaction or universal metadata sanitation.
