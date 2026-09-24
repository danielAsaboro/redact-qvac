export type WorkflowStage =
  | "configure"
  | "analyzing"
  | "review"
  | "exporting"
  | "complete";

export type ConfidentialityLevel = "private" | "confidential";

export type SupportedSourceMimeType =
  | "image/png"
  | "image/jpeg"
  | "application/pdf";

export type SourceDocument = {
  id: string;
  name: string;
  mimeType: SupportedSourceMimeType;
  byteSize: number;
  pageCount: number;
  originalBytes: ArrayBuffer;
  originalDigest: string;
};

export type RasterPage = {
  id: string;
  documentId: string;
  pageNumber: number;
  width: number;
  height: number;
  pngBytes: ArrayBuffer;
  pdfWidth?: number;
  pdfHeight?: number;
};

export type RedactionLabel =
  | "name"
  | "email"
  | "phone"
  | "address"
  | "account"
  | "identity"
  | "amount"
  | "date"
  | "reference"
  | "business"
  | "other";

export type RedactionMark = {
  id: string;
  documentId: string;
  pageId: string;
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  label: RedactionLabel;
  source: "manual" | "accepted";
  createdAt: string;
};

export type BoundingBox = Pick<
  RedactionMark,
  "x" | "y" | "width" | "height"
>;

export type CandidateStatus = "proposed" | "accepted" | "rejected";

export type OCRBlock = {
  id: string;
  documentId: string;
  pageId: string;
  pageNumber: number;
  text: string;
  rawBbox: [number, number, number, number];
  bbox: BoundingBox;
  confidence: number | null;
};

export type RedactionCandidate = {
  id: string;
  documentId: string;
  pageId: string;
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  label: RedactionLabel;
  evidenceText: string;
  explanation: string;
  confidence: number | null;
  status: CandidateStatus;
};

export type AnalysisRun = {
  id: string;
  documentId: string;
  revision: number;
  status: "loading" | "analyzing" | "ready" | "unavailable" | "error";
  startedAt: string;
  completedAt: string | null;
  error: string | null;
  pageId?: string;
  ocrModel?: string;
  ocrMs?: number | null;
  reasoningModel?: string;
  reasoningMs?: number | null;
};

export type AuditEntry = {
  id: string;
  action: string;
  detail: string;
  at: string;
};

export type GeneratedCopyRecord = {
  name: string;
  mimeType: "image/png" | "application/pdf";
  pageCount: number;
  byteSize: number;
  createdAt: string;
};

export type RedactSession = {
  id: string;
  stage: WorkflowStage;
  source: SourceDocument;
  pages: RasterPage[];
  activePageNumber: number;
  configuration: {
    level: ConfidentialityLevel;
    direction: string;
  };
  analysisRevision: number;
  lastAnalyzedRevision: number | null;
  marks: RedactionMark[];
  candidates: RedactionCandidate[];
  ocrBlocks: OCRBlock[];
  analysisRuns: AnalysisRun[];
  audit: AuditEntry[];
  generatedCopy: GeneratedCopyRecord | null;
};

export function createSession(source: SourceDocument, at: string): RedactSession {
  return {
    id: `session-${source.id}`,
    stage: "configure",
    source,
    pages: [],
    activePageNumber: 1,
    configuration: { level: "private", direction: "" },
    analysisRevision: 0,
    lastAnalyzedRevision: null,
    marks: [],
    candidates: [],
    ocrBlocks: [],
    analysisRuns: [],
    audit: [
      {
        id: `audit-upload-${source.id}-${at}`,
        action: "Added document",
        detail: source.name,
        at,
      },
    ],
    generatedCopy: null,
  };
}

export function configureSession(
  session: RedactSession,
  configuration: RedactSession["configuration"],
): RedactSession {
  if (
    session.configuration.level === configuration.level &&
    session.configuration.direction === configuration.direction
  ) {
    return session;
  }
  return {
    ...session,
    stage: "configure",
    configuration,
    analysisRevision: session.analysisRevision + 1,
    lastAnalyzedRevision: null,
    candidates: session.candidates.filter(
      (candidate) => candidate.status !== "proposed",
    ),
    generatedCopy: null,
  };
}

export function beginPreparation(session: RedactSession): RedactSession {
  return { ...session, stage: "analyzing", generatedCopy: null };
}

export function openManualReview(
  session: RedactSession,
  pages: RasterPage[],
  evidence: {
    ocrBlocks?: OCRBlock[];
    candidates?: RedactionCandidate[];
    analysisRuns?: AnalysisRun[];
  } = {},
): RedactSession {
  if (pages.length === 0) throw new Error("At least one page is required");
  return {
    ...session,
    stage: "review",
    pages,
    activePageNumber: 1,
    ocrBlocks: evidence.ocrBlocks ?? session.ocrBlocks,
    candidates: evidence.candidates ?? session.candidates,
    analysisRuns: evidence.analysisRuns ?? session.analysisRuns,
    generatedCopy: null,
  };
}

export function addManualMark(
  session: RedactSession,
  mark: RedactionMark,
): RedactSession {
  return {
    ...session,
    marks: [...session.marks, mark],
    generatedCopy: null,
    audit: [
      {
        id: `audit-add-${mark.id}`,
        action: "Added redaction",
        detail: mark.label,
        at: mark.createdAt,
      },
      ...session.audit,
    ],
  };
}

export function moveMark(
  session: RedactSession,
  markId: string,
  position: Pick<RedactionMark, "x" | "y">,
): RedactSession {
  return {
    ...session,
    generatedCopy: null,
    marks: session.marks.map((mark) =>
      mark.id === markId
        ? {
            ...mark,
            x: Math.max(0, Math.min(100 - mark.width, position.x)),
            y: Math.max(0, Math.min(100 - mark.height, position.y)),
          }
        : mark,
    ),
  };
}

export function setMarkGeometry(
  session: RedactSession,
  markId: string,
  geometry: Pick<RedactionMark, "x" | "y" | "width" | "height">,
): RedactSession {
  if (!Object.values(geometry).every(Number.isFinite) || geometry.width <= 0 || geometry.height <= 0) return session;
  const width = Math.min(100, geometry.width);
  const height = Math.min(100, geometry.height);
  return {
    ...session,
    generatedCopy: null,
    marks: session.marks.map(mark => mark.id === markId ? {
      ...mark,
      x: Math.max(0, Math.min(100 - width, geometry.x)),
      y: Math.max(0, Math.min(100 - height, geometry.y)),
      width,
      height,
    } : mark),
  };
}

export function resizeMark(
  session: RedactSession,
  markId: string,
  size: Pick<RedactionMark, "width" | "height">,
): RedactSession {
  return {
    ...session,
    generatedCopy: null,
    marks: session.marks.map((mark) =>
      mark.id === markId
        ? {
            ...mark,
            width: Math.max(0.5, Math.min(100 - mark.x, size.width)),
            height: Math.max(0.5, Math.min(100 - mark.y, size.height)),
          }
        : mark,
    ),
  };
}

export function removeMark(
  session: RedactSession,
  markId: string,
  at: string,
): RedactSession {
  const mark = session.marks.find((candidate) => candidate.id === markId);
  if (!mark) return session;
  const acceptedCandidateId = mark.source === "accepted"
    ? mark.id.replace(/^accepted-/, "")
    : null;
  return {
    ...session,
    marks: session.marks.filter((candidate) => candidate.id !== markId),
    candidates: acceptedCandidateId
      ? session.candidates.map((candidate) =>
          candidate.id === acceptedCandidateId
            ? { ...candidate, status: "rejected" }
            : candidate,
        )
      : session.candidates,
    generatedCopy: null,
    audit: [
      {
        id: `audit-remove-${mark.id}-${at}`,
        action: "Removed redaction",
        detail: mark.label,
        at,
      },
      ...session.audit,
    ],
  };
}

export function acceptCandidate(
  session: RedactSession,
  candidateId: string,
  at: string,
): RedactSession {
  const candidate = session.candidates.find((item) => item.id === candidateId);
  if (!candidate || candidate.status !== "proposed") return session;
  const mark: RedactionMark = {
    id: `accepted-${candidate.id}`,
    documentId: candidate.documentId,
    pageId: candidate.pageId,
    pageNumber: candidate.pageNumber,
    x: candidate.x,
    y: candidate.y,
    width: candidate.width,
    height: candidate.height,
    label: candidate.label,
    source: "accepted",
    createdAt: at,
  };
  return {
    ...session,
    generatedCopy: null,
    marks: [...session.marks, mark],
    candidates: session.candidates.map((item) =>
      item.id === candidateId ? { ...item, status: "accepted" } : item,
    ),
    audit: [
      {
        id: `audit-accept-${candidate.id}-${at}`,
        action: "Accepted local suggestion",
        detail: `${candidate.label} · ${candidate.evidenceText}`,
        at,
      },
      ...session.audit,
    ],
  };
}

export function rejectCandidate(
  session: RedactSession,
  candidateId: string,
  at: string,
): RedactSession {
  const candidate = session.candidates.find((item) => item.id === candidateId);
  if (!candidate || candidate.status !== "proposed") return session;
  return {
    ...session,
    generatedCopy: null,
    candidates: session.candidates.map((item) =>
      item.id === candidateId ? { ...item, status: "rejected" } : item,
    ),
    audit: [
      {
        id: `audit-reject-${candidate.id}-${at}`,
        action: "Rejected local suggestion",
        detail: `${candidate.label} · ${candidate.evidenceText}`,
        at,
      },
      ...session.audit,
    ],
  };
}

export function finishReview(
  session: RedactSession,
  options: { allowUnresolved?: boolean } = {},
): RedactSession {
  const unresolved = session.candidates.filter(
    (candidate) => candidate.status === "proposed",
  );
  if (unresolved.length > 0 && !options.allowUnresolved) {
    throw new Error("Resolve every suggestion before creating a safe copy");
  }
  const at = new Date().toISOString();
  return {
    ...session,
    stage: "exporting",
    audit:
      unresolved.length > 0
        ? [
            {
              id: `audit-unresolved-${session.id}-${at}`,
              action: "Finished with unresolved suggestions",
              detail: `${unresolved.length} suggestions remained unresolved`,
              at,
            },
            ...session.audit,
          ]
        : session.audit,
  };
}

export function recordGeneratedCopy(
  session: RedactSession,
  generatedCopy: GeneratedCopyRecord,
): RedactSession {
  return {
    ...session,
    stage: "complete",
    generatedCopy,
    audit: [
      {
        id: `audit-copy-${session.id}-${generatedCopy.createdAt}`,
        action: "Created safe copy",
        detail: generatedCopy.name,
        at: generatedCopy.createdAt,
      },
      ...session.audit,
    ],
  };
}
