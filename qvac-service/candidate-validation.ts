import type { CandidateSuggestion } from "../src/features/redact/analysis-contract";

const explanations: Record<CandidateSuggestion["label"], string> = {
  name: "The block contains a person name.",
  email: "The block contains an email address.",
  phone: "The block contains a telephone number.",
  address: "The block contains a physical address.",
  account: "The block contains an account identifier.",
  identity: "The block contains an identity identifier.",
  amount: "The block contains an explicit monetary amount.",
  date: "The block contains a potentially sensitive date.",
  reference: "The block contains a tracking or case reference.",
  business: "The block contains a private business detail.",
  other: "The block contains other potentially sensitive information.",
};

function groundedLabel(text: string, proposed: CandidateSuggestion["label"]): CandidateSuggestion["label"] | null {
  const value = text.trim();
  const lower = value.toLowerCase();
  if (/controlled test document|no real personal information/.test(lower)) return null;
  if (value.includes("@")) return "email";
  if (/\b(reference|ref(?:erence)?[.:#])\b/i.test(value)) return "reference";
  if (/\b(account|acct|card)\b/i.test(value) && /\d/.test(value)) return "account";
  if (/\b(phone|telephone|mobile|tel[.:])\b/i.test(value) && (value.match(/\d/g)?.length ?? 0) >= 7) return "phone";
  if (/\b\d{1,5}\s+.+\b(road|rd|street|st|close|avenue|ave|lane|ln|drive|dr|boulevard|blvd|way)\b/i.test(value)) return "address";
  if (/\b(passport|social security|ssn|national id|employee id|driver'?s licen[cs]e)\b/i.test(value)) return "identity";
  if (/[₦$£€¥]\s*\d|\bamount\b[^\d]{0,8}\d/i.test(value)) return "amount";
  if (/\b(?:19|20)\d{2}[-/]\d{1,2}[-/]\d{1,2}\b|\b\d{1,2}[-/]\d{1,2}[-/](?:\d{2}|\d{4})\b/.test(value)) return "date";
  if (/\b(?:ltd|limited|llc|inc|company|corporation|corp)\b/i.test(value)) return "business";
  if (
    proposed === "name" &&
    /^[A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+){1,3}$/.test(value)
  ) return "name";
  return proposed === "other" ? "other" : null;
}

export function validateCandidateForEvidence(
  candidate: CandidateSuggestion,
  evidenceText: string,
): CandidateSuggestion | null {
  const label = groundedLabel(evidenceText, candidate.label);
  return label
    ? { ...candidate, label, explanation: explanations[label] }
    : null;
}
