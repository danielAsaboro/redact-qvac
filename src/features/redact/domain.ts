export type DocumentKind = "statement" | "identity" | "screenshot";

export type DocumentFixture = {
  id: string;
  title: string;
  kind: DocumentKind;
  receivedOn: string;
  pageCount: number;
  riskLabel: string;
  accent: string;
};

export type RedactionMark = {
  id: string;
  documentId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: "name" | "address" | "account" | "other";
  createdAt: string;
};

export type AuditEntry = {
  id: string;
  documentId: string;
  action: string;
  detail: string;
  at: string;
};

export type ExportRecord = {
  id: string;
  documentId: string;
  createdAt: string;
  markCount: number;
  kind: "simulation";
};

export type RedactState = {
  version: 1;
  activeDocumentId: string;
  documents: DocumentFixture[];
  marks: RedactionMark[];
  audit: AuditEntry[];
  exports: ExportRecord[];
};

const DOCUMENTS: DocumentFixture[] = [
  {
    id: "bank-statement",
    title: "June account statement",
    kind: "statement",
    receivedOn: "2026-07-03",
    pageCount: 2,
    riskLabel: "Financial identifiers",
    accent: "#c34b35",
  },
  {
    id: "passport-scan",
    title: "Travel document scan",
    kind: "identity",
    receivedOn: "2026-07-18",
    pageCount: 1,
    riskLabel: "Identity document",
    accent: "#2e5d4b",
  },
  {
    id: "support-screenshot",
    title: "Support conversation",
    kind: "screenshot",
    receivedOn: "2026-08-01",
    pageCount: 1,
    riskLabel: "Contact details",
    accent: "#345c8c",
  },
];

const MARKS: RedactionMark[] = [
  {
    id: "mark-account-name",
    documentId: "bank-statement",
    x: 12,
    y: 16,
    width: 28,
    height: 6,
    label: "name",
    createdAt: "2026-08-12T09:00:00.000Z",
  },
  {
    id: "mark-account-number",
    documentId: "bank-statement",
    x: 63,
    y: 16,
    width: 24,
    height: 6,
    label: "account",
    createdAt: "2026-08-12T09:01:00.000Z",
  },
  {
    id: "mark-address",
    documentId: "bank-statement",
    x: 12,
    y: 25,
    width: 36,
    height: 8,
    label: "address",
    createdAt: "2026-08-12T09:02:00.000Z",
  },
];

export function seedState(): RedactState {
  return {
    version: 1,
    activeDocumentId: DOCUMENTS[0].id,
    documents: structuredClone(DOCUMENTS),
    marks: structuredClone(MARKS),
    audit: [
      {
        id: "audit-seeded",
        documentId: "bank-statement",
        action: "Opened dossier",
        detail: "Fixture document prepared for review",
        at: "2026-08-12T09:00:00.000Z",
      },
    ],
    exports: [],
  };
}

export function addMark(
  state: RedactState,
  mark: RedactionMark,
): RedactState {
  return {
    ...state,
    marks: [...state.marks, mark],
    audit: [
      {
        id: `audit-${mark.id}`,
        documentId: mark.documentId,
        action: "Added mark",
        detail: mark.label,
        at: mark.createdAt,
      },
      ...state.audit,
    ],
  };
}

export function moveMark(
  state: RedactState,
  markId: string,
  position: Pick<RedactionMark, "x" | "y">,
): RedactState {
  return {
    ...state,
    marks: state.marks.map((mark) =>
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

export function removeMark(
  state: RedactState,
  markId: string,
  at: string,
): RedactState {
  const mark = state.marks.find((candidate) => candidate.id === markId);
  if (!mark) return state;

  return {
    ...state,
    marks: state.marks.filter((candidate) => candidate.id !== markId),
    audit: [
      {
        id: `audit-remove-${markId}-${at}`,
        documentId: mark.documentId,
        action: "Removed mark",
        detail: mark.label,
        at,
      },
      ...state.audit,
    ],
  };
}

export function recordExport(state: RedactState, at: string): RedactState {
  const markCount = state.marks.filter(
    (mark) => mark.documentId === state.activeDocumentId,
  ).length;

  return {
    ...state,
    exports: [
      {
        id: `export-${at}`,
        documentId: state.activeDocumentId,
        createdAt: at,
        markCount,
        kind: "simulation",
      },
      ...state.exports,
    ],
    audit: [
      {
        id: `audit-export-${at}`,
        documentId: state.activeDocumentId,
        action: "Recorded simulated export",
        detail: `${markCount} marks reviewed`,
        at,
      },
      ...state.audit,
    ],
  };
}

