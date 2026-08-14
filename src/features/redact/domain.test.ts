import { describe, expect, it } from "vitest";

import {
  acceptCandidate,
  addManualMark,
  configureSession,
  createSession,
  finishReview,
  moveMark,
  openManualReview,
  recordGeneratedCopy,
  rejectCandidate,
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
const proposal: RedactionCandidate = {
  id: "candidate-1",
  documentId: source.id,
  pageId: page.id,
  pageNumber: 1,
  x: 10,
  y: 20,
  width: 30,
  height: 5,
  label: "name",
  evidenceText: "Maya Chen",
  explanation: "The block contains a person name.",
  confidence: 0.94,
  status: "proposed",
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
    const session = { ...reviewSession(), candidates: [proposal] };

    expect(() => finishReview(session)).toThrow(
      "Resolve every suggestion before creating a safe copy",
    );

    const allowed = finishReview(session, { allowUnresolved: true });
    expect(allowed.stage).toBe("exporting");
    expect(allowed.audit[0].action).toBe(
      "Finished with unresolved suggestions",
    );
  });

  it("accepts a proposal once as an ordinary accepted mark and audit event", () => {
    const session = { ...reviewSession(), candidates: [proposal] };
    const accepted = acceptCandidate(session, proposal.id, "2026-08-14T10:04:00.000Z");
    const repeated = acceptCandidate(accepted, proposal.id, "2026-08-14T10:05:00.000Z");

    expect(accepted.candidates[0].status).toBe("accepted");
    expect(accepted.marks).toEqual([
      expect.objectContaining({
        id: `accepted-${proposal.id}`,
        pageId: page.id,
        source: "accepted",
        label: "name",
        x: 10,
        y: 20,
      }),
    ]);
    expect(accepted.audit[0]).toMatchObject({
      action: "Accepted local suggestion",
      detail: "name · Maya Chen",
    });
    expect(repeated).toBe(accepted);
  });

  it("rejects a proposal without changing manual or accepted marks", () => {
    const manual = addManualMark(reviewSession(), {
      id: "manual-1",
      documentId: source.id,
      pageId: page.id,
      pageNumber: 1,
      x: 1,
      y: 2,
      width: 3,
      height: 4,
      label: "other",
      source: "manual",
      createdAt: "2026-08-14T10:03:00.000Z",
    });
    const rejected = rejectCandidate(
      { ...manual, candidates: [proposal] },
      proposal.id,
      "2026-08-14T10:04:00.000Z",
    );

    expect(rejected.candidates[0].status).toBe("rejected");
    expect(rejected.marks).toEqual(manual.marks);
    expect(rejected.audit[0]).toMatchObject({
      action: "Rejected local suggestion",
      detail: "name · Maya Chen",
    });
  });

  it("treats removing an accepted mark as a resolved rejection", () => {
    const accepted = acceptCandidate(
      { ...reviewSession(), candidates: [proposal] },
      proposal.id,
      "2026-08-14T10:04:00.000Z",
    );
    const removed = removeMark(
      accepted,
      `accepted-${proposal.id}`,
      "2026-08-14T10:05:00.000Z",
    );

    expect(removed.marks).toEqual([]);
    expect(removed.candidates[0].status).toBe("rejected");
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
