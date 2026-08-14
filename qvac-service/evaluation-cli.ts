import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import { normalizeOcrBbox } from "../src/features/redact/ocr-geometry";
import { createQvacOcrAnalyzer } from "./qvac-analyzer";
import { createStructuredReasoner } from "./reasoning";
import { EVALUATION_CASES, EVALUATION_IDENTIFIERS, runEvaluationCases } from "./evaluation";
import { resolveLocalQvacPaths } from "./local-config";

async function main() {
  const appDirectory = fileURLToPath(new URL("../", import.meta.url));
  const paths = resolveLocalQvacPaths(appDirectory);
  await Promise.all([
    mkdir(paths.cacheDirectory, { recursive: true }),
    mkdir(paths.tempDirectory, { recursive: true }),
  ]);
  if ((await readdir(paths.cacheDirectory)).length === 0) {
    throw new Error("QVAC cache is empty. Run npm run qvac:ocr-smoke and one app analysis first.");
  }
  await writeFile(paths.configPath, `${JSON.stringify({ cacheDirectory: paths.cacheDirectory }, null, 2)}\n`);
  process.env.QVAC_CONFIG_PATH = paths.configPath;
  process.env.SNAP_USER_COMMON = paths.runtimeHome;

  const qvac = await import("@qvac/sdk");
  const modelLoadMs = { ocr: 0, reasoning: 0 };
  const reasoner = createStructuredReasoner({
    modelSource: qvac.QWEN3_600M_INST_Q4,
    runtime: {
      async loadModel(options) {
        const started = Date.now();
        try { return await qvac.loadModel(options as never); }
        finally { modelLoadMs.reasoning += Date.now() - started; }
      },
      completion: (options) => qvac.completion(options as never),
      unloadModel: (options) => qvac.unloadModel(options),
    },
  });
  const analyzer = createQvacOcrAnalyzer({
    modelSource: qvac.OCR_LATIN,
    runtime: {
      async loadModel(options) {
        const started = Date.now();
        try { return await qvac.loadModel(options as never); }
        finally { modelLoadMs.ocr += Date.now() - started; }
      },
      ocr: (options) => qvac.ocr(options),
      unloadModel: (options) => qvac.unloadModel(options),
      close: () => qvac.close(),
    },
    reasoner,
  });
  let peakRssBytes = process.memoryUsage().rss;
  let peakHeapUsedBytes = process.memoryUsage().heapUsed;
  const timings: Array<{ caseId: string; ocrInferenceMs: number; reasoningInferenceMs: number }> = [];
  try {
    let previousOcrLoad = 0;
    let previousReasoningLoad = 0;
    const requestedCase = process.env.REDACT_EVALUATION_CASE;
    const cases = requestedCase
      ? EVALUATION_CASES.filter((item) => item.id === requestedCase)
      : EVALUATION_CASES;
    if (cases.length === 0) throw new Error(`Unknown evaluation case: ${requestedCase}`);
    const results = await runEvaluationCases(cases, async (item) => {
      const fixture = path.resolve(appDirectory, item.fixturePath);
      const bytes = await readFile(fixture);
      const metadata = await sharp(bytes).metadata();
      if (!metadata.width || !metadata.height) throw new Error(`Missing dimensions for ${item.id}`);
      const response = await analyzer.analyzePage({
        documentId: `evaluation-${item.id}`,
        pageId: `${item.id}-page-1`,
        pageNumber: 1,
        width: metadata.width,
        height: metadata.height,
        pngBase64: bytes.toString("base64"),
        level: "private",
        direction: "Redact direct personal identifiers, account numbers, and reference codes.",
      });
      const ocrLoadThisCase = modelLoadMs.ocr - previousOcrLoad;
      const reasoningLoadThisCase = modelLoadMs.reasoning - previousReasoningLoad;
      previousOcrLoad = modelLoadMs.ocr;
      previousReasoningLoad = modelLoadMs.reasoning;
      timings.push({
        caseId: item.id,
        ocrInferenceMs: Math.max(0, (response.run.ocrMs ?? 0) - ocrLoadThisCase),
        reasoningInferenceMs: Math.max(0, (response.run.reasoningMs ?? 0) - reasoningLoadThisCase),
      });
      const memory = process.memoryUsage();
      peakRssBytes = Math.max(peakRssBytes, memory.rss);
      peakHeapUsedBytes = Math.max(peakHeapUsedBytes, memory.heapUsed);
      return response.candidates.flatMap((candidate) => {
        const block = response.ocrBlocks[candidate.blockIndex];
        if (!block) return [];
        const bbox = normalizeOcrBbox(block.bbox, response.page.width, response.page.height);
        return bbox ? [{ id: `${item.id}-${candidate.blockIndex}`, label: candidate.label, bbox }] : [];
      });
    }, {
      onCaseStart: (item) => process.stderr.write(`Evaluating ${item.condition}…\n`),
    });
    const passed = results.every((item) => item.result.passed);
    process.stdout.write(`${JSON.stringify({
      mode: "real-cached-local-qvac",
      identifiers: EVALUATION_IDENTIFIERS,
      passed,
      modelLoadMs,
      timings,
      memory: { peakRssBytes, peakHeapUsedBytes },
      results,
    }, null, 2)}\n`);
    if (!passed) process.exitCode = 1;
  } finally {
    await analyzer.close();
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(`QVAC evaluation failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
