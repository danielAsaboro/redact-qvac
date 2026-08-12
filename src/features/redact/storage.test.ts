import { beforeEach, describe, expect, it } from "vitest";

import { seedState } from "./domain";
import { readState, resetState, STORAGE_KEY, writeState } from "./storage";

describe("redact storage", () => {
  beforeEach(() => localStorage.clear());

  it("seeds an empty browser store", () => {
    expect(readState(localStorage)).toEqual(seedState());
  });

  it("recovers from malformed JSON", () => {
    localStorage.setItem(STORAGE_KEY, "{broken");

    expect(readState(localStorage)).toEqual(seedState());
  });

  it("resets an incompatible fixture version", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 99 }));

    expect(readState(localStorage)).toEqual(seedState());
  });

  it("round-trips valid state", () => {
    const state = { ...seedState(), activeDocumentId: "passport-scan" };

    writeState(localStorage, state);

    expect(readState(localStorage)).toEqual(state);
  });

  it("replaces edited data on reset", () => {
    writeState(localStorage, { ...seedState(), documents: [] });

    const reset = resetState(localStorage);

    expect(reset).toEqual(seedState());
    expect(readState(localStorage)).toEqual(seedState());
  });
});

