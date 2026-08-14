import type { BoundingBox, RedactionLabel } from "../src/features/redact/workflow-domain";

export type LabelledRegion = {
  id: string;
  label: RedactionLabel;
  bbox: BoundingBox;
};

export type EvaluationCase = {
  id: string;
  condition: "clear" | "rotated" | "low-contrast" | "partially-obscured";
  fixturePath: string;
  expected: LabelledRegion[];
};

export const EVALUATION_THRESHOLDS = {
  iou: 0.45,
  minimumPrecision: 0.7,
  minimumRecall: 0.7,
  minimumF1: 0.7,
} as const;

export const EVALUATION_IDENTIFIERS = {
  sdk: "@qvac/sdk@0.17.1",
  ocr: "OCR_LATIN/qvac-ocr-latin",
  reasoning: "QWEN3_600M_INST_Q4/qwen3-600m-instruct-q4",
  policy: "redact-sensitive-fields-v2",
} as const;

const clearRegions: LabelledRegion[] = [
  { id: "name", label: "name", bbox: { x: 17.583333, y: 7.125, width: 15.5, height: 2.75 } },
  { id: "email", label: "email", bbox: { x: 17.75, y: 10.375, width: 22.083333, height: 1.75 } },
  { id: "address", label: "address", bbox: { x: 15.583333, y: 20.875, width: 44.333333, height: 1.9375 } },
  { id: "phone", label: "phone", bbox: { x: 19.166667, y: 23.75, width: 27, height: 2.125 } },
  { id: "account", label: "account", bbox: { x: 39.333333, y: 34.125, width: 27.583333, height: 2 } },
  { id: "reference", label: "reference", bbox: { x: 31.333333, y: 36.875, width: 30, height: 1.9375 } },
];

function rotateClockwise(region: LabelledRegion): LabelledRegion {
  const { x, y, width, height } = region.bbox;
  return {
    ...region,
    id: `${region.id}-rotated`,
    bbox: { x: 100 - y - height, y: x, width: height, height: width },
  };
}

function copyRegions(suffix: string) {
  return clearRegions.map((region) => ({ ...region, id: `${region.id}-${suffix}` }));
}

export const EVALUATION_CASES: EvaluationCase[] = [
  {
    id: "chat-clear",
    condition: "clear",
    fixturePath: "public/test-files/redact/evaluation/chat-clear.png",
    expected: clearRegions,
  },
  {
    id: "chat-rotated",
    condition: "rotated",
    fixturePath: "public/test-files/redact/evaluation/chat-rotated.png",
    expected: clearRegions.map(rotateClockwise),
  },
  {
    id: "chat-low-contrast",
    condition: "low-contrast",
    fixturePath: "public/test-files/redact/evaluation/chat-low-contrast.png",
    expected: copyRegions("low-contrast"),
  },
  {
    id: "chat-partially-obscured",
    condition: "partially-obscured",
    fixturePath: "public/test-files/redact/evaluation/chat-partially-obscured.png",
    expected: copyRegions("partially-obscured"),
  },
];

export function intersectionOverUnion(a: BoundingBox, b: BoundingBox): number {
  const width = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const height = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  const intersection = width * height;
  const union = a.width * a.height + b.width * b.height - intersection;
  return union > 0 ? intersection / union : 0;
}

export function evaluateRegions(
  expected: readonly LabelledRegion[],
  proposed: readonly LabelledRegion[],
  iouThreshold: number = EVALUATION_THRESHOLDS.iou,
) {
  const pairs = expected
    .flatMap((expectedRegion) =>
      proposed
        .filter((proposal) => proposal.label === expectedRegion.label)
        .map((proposal) => ({
          expectedId: expectedRegion.id,
          proposedId: proposal.id,
          iou: intersectionOverUnion(expectedRegion.bbox, proposal.bbox),
        })),
    )
    .filter((pair) => pair.iou >= iouThreshold)
    .sort((a, b) => b.iou - a.iou || a.expectedId.localeCompare(b.expectedId) || a.proposedId.localeCompare(b.proposedId));
  const usedExpected = new Set<string>();
  const usedProposed = new Set<string>();
  const matches = pairs.filter((pair) => {
    if (usedExpected.has(pair.expectedId) || usedProposed.has(pair.proposedId)) return false;
    usedExpected.add(pair.expectedId);
    usedProposed.add(pair.proposedId);
    return true;
  }).sort((a, b) => a.expectedId.localeCompare(b.expectedId) || a.proposedId.localeCompare(b.proposedId));
  const truePositives = matches.length;
  const falsePositives = proposed.length - truePositives;
  const falseNegatives = expected.length - truePositives;
  const precision = proposed.length === 0 ? 1 : truePositives / proposed.length;
  const recall = expected.length === 0 ? 1 : truePositives / expected.length;
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return {
    truePositives,
    falsePositives,
    falseNegatives,
    precision,
    recall,
    f1,
    passed:
      precision >= EVALUATION_THRESHOLDS.minimumPrecision &&
      recall >= EVALUATION_THRESHOLDS.minimumRecall &&
      f1 >= EVALUATION_THRESHOLDS.minimumF1,
    matches,
    thresholds: { ...EVALUATION_THRESHOLDS, iou: iouThreshold },
  };
}

export async function runEvaluationCases(
  cases: readonly EvaluationCase[],
  propose: (item: EvaluationCase) => Promise<LabelledRegion[]>,
  profiler: {
    onCaseStart?(item: EvaluationCase): void;
    onCaseComplete?(item: EvaluationCase, result: ReturnType<typeof evaluateRegions>, elapsedMs: number): void;
  } = {},
  now: () => number = Date.now,
) {
  const receipts = [];
  for (const item of cases) {
    profiler.onCaseStart?.(item);
    const started = now();
    const proposals = await propose(item);
    const result = evaluateRegions(item.expected, proposals);
    const elapsedMs = now() - started;
    profiler.onCaseComplete?.(item, result, elapsedMs);
    receipts.push({ caseId: item.id, proposals, result, elapsedMs });
  }
  return receipts;
}
