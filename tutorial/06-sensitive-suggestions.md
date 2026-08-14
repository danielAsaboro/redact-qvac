# Turn OCR evidence into grounded suggestions

This checkpoint adds cached local Qwen reasoning after OCR. It receives only the
validated OCR block list, confidentiality level, and optional user direction.
It returns block indices—not text or geometry—under a JSON schema.

## Trust pipeline

1. QVAC constrains generation with a JSON schema.
2. The service drains the event stream and inspects the aggregated final result.
3. Natural EOS is accepted as either `undefined` (the SDK's documented value),
   `eos`, or `stopSequence`; truncation and cancellation fail closed.
4. JSON is parsed and validated independently with Zod.
5. Unknown labels, invalid confidence, duplicate indices, and out-of-range
   indices are rejected.
6. A deterministic semantic gate canonicalizes strong local cues and drops
   obvious label/text contradictions and controlled-test disclaimers.
7. The browser grounds each surviving index to its already-normalized OCR block.

The user's direction is serialized as untrusted policy data. It cannot alter the
response schema or authorize invented evidence.

## Real iteration receipt

- First live request: failed closed because the final stop reason was undefined.
  QVAC documents that as natural EOS, so the validator was corrected and tested.
- First accepted model output: seven proposals, including false names such as
  `My`, `Got it.`, and `Thanks`, while missing several obvious fields.
- Stronger prompt: improved recall, but the 600M model still ignored negative
  instructions and produced semantic contradictions.
- Prompt plus semantic gate: six grounded proposals on the controlled chat page:
  name, email, address, phone, account, and reference. OCR took about 31.1s and
  reasoning about 26.3s on the measured run.

The model scores are not calibrated probabilities. Suggestions remain advisory
in this checkpoint, and export permits unresolved suggestions until Episode 07
adds Accept/Reject controls.

## Verification

```bash
npm test -- qvac-service/reasoning.test.ts qvac-service/candidate-validation.test.ts
npm run lint
npm run typecheck
npm test
npm run build
git diff --check
```
