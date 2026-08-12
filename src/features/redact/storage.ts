import { seedState, type RedactState } from "./domain";

export const STORAGE_KEY = "bring-ai-home:redact:v1";

function isRedactState(value: unknown): value is RedactState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<RedactState>;
  return (
    candidate.version === 1 &&
    typeof candidate.activeDocumentId === "string" &&
    Array.isArray(candidate.documents) &&
    Array.isArray(candidate.marks) &&
    Array.isArray(candidate.audit) &&
    Array.isArray(candidate.exports)
  );
}

export function readState(storage: Pick<Storage, "getItem">): RedactState {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return seedState();

  try {
    const parsed: unknown = JSON.parse(raw);
    return isRedactState(parsed) ? parsed : seedState();
  } catch {
    return seedState();
  }
}

export function writeState(
  storage: Pick<Storage, "setItem">,
  state: RedactState,
): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function resetState(
  storage: Pick<Storage, "setItem">,
): RedactState {
  const state = seedState();
  writeState(storage, state);
  return state;
}

