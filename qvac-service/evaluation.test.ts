// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import {
  EVALUATION_CASES,
  EVALUATION_IDENTIFIERS,
  EVALUATION_THRESHOLDS,
  evaluateRegions,
  intersectionOverUnion,
  runEvaluationCases,
  type LabelledRegion,
} from "./evaluation";

const expected: LabelledRegion[] = [
  { id: "name", label: "name", bbox: { x: 10, y: 10, width: 20, height: 10 } },
  { id: "account", label: "account", bbox: { x: 50, y: 50, width: 20, height: 10 } },
];

describe("labelled QVAC evaluation", () => {
  it("pins the tested runtime and gate configuration", () => {
    expect(EVALUATION_IDENTIFIERS).toMatchObject({
      sdk: "@qvac/sdk@0.17.1",
      ocr: "OCR_LATIN/qvac-ocr-latin",
      reasoning: "QWEN3_600M_INST_Q4/qwen3-600m-instruct-q4",
      policy: "redact-sensitive-fields-v2",
    });
    expect(EVALUATION_THRESHOLDS).toEqual({
      iou: 0.45,
      minimumPrecision: 0.7,
      minimumRecall: 0.7,
      minimumF1: 0.7,
    });
  });

  it("computes IoU plus false positives and false negatives", () => {
    expect(
      intersectionOverUnion(expected[0].bbox, {
        x: 20,
        y: 10,
        width: 20,
        height: 10,
      }),
    ).toBeCloseTo(1 / 3);

    expect(
      evaluateRegions(expected, [
        { ...expected[0], id: "proposal-name" },
        { id: "wrong-label", label: "address", bbox: expected[1].bbox },
      ]),
    ).toMatchObject({
      truePositives: 1,
      falsePositives: 1,
      falseNegatives: 1,
      precision: 0.5,
      recall: 0.5,
      f1: 0.5,
      passed: false,
    });
  });

  it("matches the highest-IoU same-label regions one-to-one", () => {
    const proposals: LabelledRegion[] = [
      { id: "near", label: "name", bbox: { x: 14, y: 10, width: 20, height: 10 } },
      { id: "exact", label: "name", bbox: expected[0].bbox },
    ];
    const duplicateExpected: LabelledRegion[] = [
      expected[0],
      { id: "nearby-name", label: "name", bbox: { x: 15, y: 10, width: 20, height: 10 } },
    ];
    const forward = evaluateRegions(duplicateExpected, proposals, 0.3);
    const reversed = evaluateRegions(
      [...duplicateExpected].reverse(),
      [...proposals].reverse(),
      0.3,
    );
    expect(forward.matches).toEqual(reversed.matches);
    expect(forward.matches).toEqual([
      expect.objectContaining({ expectedId: "name", proposedId: "exact" }),
      expect.objectContaining({ expectedId: "nearby-name", proposedId: "near" }),
    ]);
  });

  it("ships four real raster conditions with six labelled sensitive regions", () => {
    expect(EVALUATION_CASES.map((item) => item.condition)).toEqual([
      "clear",
      "rotated",
      "low-contrast",
      "partially-obscured",
    ]);
    expect(EVALUATION_CASES.every((item) => item.expected.length === 6)).toBe(true);
    expect(EVALUATION_CASES.every((item) => item.fixturePath.endsWith(".png"))).toBe(true);
  });

  it("runs cases sequentially and exposes profiling hooks", async () => {
    const onCaseStart = vi.fn();
    const onCaseComplete = vi.fn();
    const [receipt] = await runEvaluationCases(
      [EVALUATION_CASES[0]],
      async (item) => [{ ...item.expected[0], id: "proposal" }],
      { onCaseStart, onCaseComplete },
      () => 100,
    );
    expect(onCaseStart).toHaveBeenCalledOnce();
    expect(onCaseComplete).toHaveBeenCalledOnce();
    expect(receipt.result.truePositives).toBe(1);
  });
});
