import { describe, expect, it } from "vitest";

import {
  addManualMark,
  configureSession,
  createSession,
  finishReview,
  moveMark,
  openManualReview,
  recordGeneratedCopy,
  removeMark,
  resizeMark,
  type RasterPage,
  type RedactionCandidate,
  type SourceDocument,
} from "./workflow-domain";

const originalBytes = new Uint8Array([1, 2, 3, 4]).buffer;
const source: SourceDocument = {
  id: "document-1",
  name: "chat.png",
  mimeType: "image/png",
  byteSize: 4,
  pageCount: 1,
  originalBytes,
  originalDigest: "sha256-source",
};
const page: RasterPage = {
  id: "document-1-page-1",
  documentId: "document-1",
  pageNumber: 1,
  width: 1200,
  height: 1600,
  pngBytes: new Uint8Array([9, 8, 7]).buffer,
};

function reviewSession() {
  return openManualReview(createSession(source, "2026-08-14T10:00:00.000Z"), [
    page,
  ]);
}

describe("redact workflow domain", () => {
  it("creates a session without copying or changing the original bytes", () => {
    const session = createSession(source, "2026-08-14T10:00:00.000Z");

    expect(session.stage).toBe("configure");
    expect(session.source.originalBytes).toBe(originalBytes);
    expect(session.marks).toEqual([]);
    expect(session.candidates).toEqual([]);
  });

  it("marks prior analysis stale when the policy changes", () => {
    const session = {
      ...configureSession(createSession(source, "2026-08-14T10:00:00.000Z"), {
        level: "confidential" as const,
        direction: "hide Apollo",
      }),
      lastAnalyzedRevision: 1,
    };

    const next = configureSession(session, {
      level: "private",
      direction: "",
    });

    expect(next.analysisRevision).toBe(2);
    expect(next.lastAnalyzedRevision).toBeNull();
  });

  it("adds, moves, resizes, and removes a manual mark within the page", () => {
    const added = addManualMark(reviewSession(), {
      id: "manual-1",
      documentId: source.id,
      pageId: page.id,
      pageNumber: 1,
      x: 80,
      y: 85,
      width: 15,
      height: 10,
      label: "other",
      source: "manual",
      createdAt: "2026-08-14T10:01:00.000Z",
    });
    const moved = moveMark(added, "manual-1", { x: 99, y: -5 });
    const resized = resizeMark(moved, "manual-1", {
      width: 40,
      height: 30,
    });
    const removed = removeMark(
      resized,
      "manual-1",
      "2026-08-14T10:02:00.000Z",
    );

    expect(moved.marks[0]).toMatchObject({ x: 85, y: 0 });
    expect(resized.marks[0]).toMatchObject({ width: 15, height: 30 });
    expect(removed.marks).toEqual([]);
    expect(removed.audit[0].action).toBe("Removed redaction");
  });

  it("blocks completion while suggestions remain unresolved", () => {
    const candidate: RedactionCandidate = {
      id: "candidate-1",
      documentId: source.id,
      pageId: page.id,
      pageNumber: 1,
      x: 10,
      y: 20,
      width: 30,
      height: 5,
      label: "name",
      evidenceText: "Amara Okeke",
      explanation: "Natural-person name",
      confidence: 0.94,
      status: "proposed",
    };
    const session = { ...reviewSession(), candidates: [candidate] };

    expect(() => finishReview(session)).toThrow(
      "Resolve every suggestion before creating a safe copy",
    );

    const allowed = finishReview(session, { allowUnresolved: true });
    expect(allowed.stage).toBe("exporting");
    expect(allowed.audit[0].action).toBe(
      "Finished with unresolved suggestions",
    );
  });

  it("records a generated copy without mutating source identity", () => {
    const exporting = finishReview(reviewSession());
    const complete = recordGeneratedCopy(exporting, {
      name: "chat.redacted.png",
      mimeType: "image/png",
      pageCount: 1,
      byteSize: 2048,
      createdAt: "2026-08-14T10:03:00.000Z",
    });

    expect(complete.stage).toBe("complete");
    expect(complete.generatedCopy?.name).toBe("chat.redacted.png");
    expect(complete.source.originalDigest).toBe("sha256-source");
    expect(complete.source.originalBytes).toBe(originalBytes);
  });
});
