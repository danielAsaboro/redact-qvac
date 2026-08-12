import { describe, expect, it } from "vitest";

import {
  addMark,
  moveMark,
  removeMark,
  recordExport,
  seedState,
  type RedactionMark,
} from "./domain";

describe("redact domain", () => {
  it("adds a mark without mutating the dossier", () => {
    const state = seedState();
    const mark: RedactionMark = {
      id: "mark-new",
      documentId: state.activeDocumentId,
      x: 12,
      y: 18,
      width: 32,
      height: 7,
      label: "account",
      createdAt: "2026-08-12T12:00:00.000Z",
    };

    const next = addMark(state, mark);

    expect(next).not.toBe(state);
    expect(next.marks).toContainEqual(mark);
    expect(state.marks).not.toContainEqual(mark);
  });

  it("clamps a moved mark to the document surface", () => {
    const state = seedState();
    const mark = state.marks[0];

    const next = moveMark(state, mark.id, { x: 94, y: -20 });

    expect(next.marks[0].x).toBe(100 - mark.width);
    expect(next.marks[0].y).toBe(0);
  });

  it("removes a mark and records the action", () => {
    const state = seedState();
    const markId = state.marks[0].id;

    const next = removeMark(state, markId, "2026-08-12T12:05:00.000Z");

    expect(next.marks.some((mark) => mark.id === markId)).toBe(false);
    expect(next.audit[0].action).toBe("Removed mark");
  });

  it("records an honest simulated export", () => {
    const state = seedState();

    const next = recordExport(state, "2026-08-12T12:10:00.000Z");

    expect(next.exports[0]).toMatchObject({
      documentId: state.activeDocumentId,
      markCount: state.marks.filter(
        (mark) => mark.documentId === state.activeDocumentId,
      ).length,
      kind: "simulation",
    });
  });
});
