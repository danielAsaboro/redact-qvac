import { describe, expect, it } from "vitest";

import { validateCandidateForEvidence } from "./candidate-validation";

const proposal = {
  blockIndex: 0,
  label: "name" as const,
  explanation: "Model explanation",
  confidence: 0.8,
};

describe("candidate semantic validation", () => {
  it.each([
    ["maya.chen@example com", "name", "email"],
    ["Please send this to 18 Willow Road.", "phone", "address"],
    ["phone is +1 415 555 0184", "name", "phone"],
    ["account 8841 0932", "name", "account"],
    ["reference APOLLO-4471", "name", "reference"],
    ["Maya Chen", "name", "name"],
  ])("grounds %s proposed as %s to %s", (text, label, expected) => {
    expect(validateCandidateForEvidence({ ...proposal, label: label as typeof proposal.label }, text)).toMatchObject({ label: expected });
  });

  it.each(["My", "Got it.", "Thanks", "Controlled test document", "no real personal information"])(
    "drops an ungrounded name proposal for %s",
    (text) => expect(validateCandidateForEvidence(proposal, text)).toBeNull(),
  );
});
