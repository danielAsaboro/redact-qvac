import sharp from "sharp";
import { z } from "zod";

import type { AnalysisResponse } from "../src/features/redact/analysis-contract";
import type { DocumentAnalyzer } from "./analyzer";
import type { DocumentReasoner } from "./reasoning";

const qvacBlockSchema = z.object({
  text: z.string(),
  bbox: z.tuple([
    z.number().finite(),
    z.number().finite(),
    z.number().finite(),
    z.number().finite(),
  ]),
  confidence: z.number().min(0).max(1).optional(),
});

export type QvacOcrRuntime = {
  loadModel(options: {
    modelSrc: unknown;
    modelConfig: {
      langList: string[];
      magRatio: number;
      defaultRotationAngles: number[];
      contrastRetry: boolean;
      lowConfidenceThreshold: number;
      recognizerBatchSize: number;
    };
  }): Promise<string>;
  ocr(options: {
    modelId: string;
    image: Buffer;
    options: { paragraph: boolean };
  }): { blocks: Promise<unknown[]>; stats: Promise<unknown> };
  unloadModel(options: { modelId: string; clearStorage: boolean }): Promise<unknown>;
  close(): Promise<unknown>;
};

type Options = {
  runtime: QvacOcrRuntime;
  modelSource: unknown;
  readImageSize?: (bytes: Buffer) => Promise<{ width: number; height: number }>;
  now?: () => number;
  reasoner?: DocumentReasoner;
};

export function createQvacOcrAnalyzer(options: Options): DocumentAnalyzer {
  let modelId: string | null = null;
  let loading: Promise<string> | null = null;
  let failed = false;
  const now = options.now ?? Date.now;
  const readImageSize =
    options.readImageSize ??
    (async (bytes: Buffer) => {
      const metadata = await sharp(bytes).metadata();
      if (!metadata.width || !metadata.height) {
        throw new Error("Raster dimensions are unavailable");
      }
      return { width: metadata.width, height: metadata.height };
    });

  async function ensureModel() {
    if (modelId) return modelId;
    loading ??= options.runtime.loadModel({
      modelSrc: options.modelSource,
      modelConfig: {
        langList: ["en"],
        magRatio: 1.5,
        defaultRotationAngles: [90, 180, 270],
        contrastRetry: false,
        lowConfidenceThreshold: 0.5,
        recognizerBatchSize: 1,
      },
    });
    try {
      modelId = await loading;
      failed = false;
      return modelId;
    } catch (error) {
      failed = true;
      loading = null;
      throw error;
    }
  }

  return {
    getState: () => ({
      service: failed ? "error" : "ready",
      models: [
        {
          kind: "ocr",
          id: "qvac-ocr-latin",
          state: failed
            ? "error"
            : modelId
              ? "ready"
              : loading
                ? "loading"
                : "not_loaded",
        },
        options.reasoner
          ? { kind: "reasoning", ...options.reasoner.getState() }
          : { kind: "reasoning", id: "not-configured", state: "not_loaded" },
      ],
    }),
    async analyzePage(input): Promise<AnalysisResponse> {
      const started = now();
      const bytes = Buffer.from(input.pngBase64, "base64");
      if (bytes.length === 0 || bytes.toString("base64") !== input.pngBase64) {
        throw new Error("Raster bytes are invalid");
      }
      const dimensions = await readImageSize(bytes);
      if (dimensions.width !== input.width || dimensions.height !== input.height) {
        throw new Error("Raster dimensions do not match the request");
      }

      const loadedModelId = await ensureModel();
      const operation = options.runtime.ocr({
        modelId: loadedModelId,
        image: bytes,
        options: { paragraph: false },
      });
      const [unknownBlocks] = await Promise.all([operation.blocks, operation.stats]);
      const blocks = z
        .array(qvacBlockSchema)
        .parse(unknownBlocks)
        .filter((block) => block.text.trim().length > 0);
      const ocrCompleted = now();
      const reasoning = options.reasoner
        ? await options.reasoner.classify({
            documentId: input.documentId,
            level: input.level,
            direction: input.direction,
            blocks: blocks.map((block) => ({
              text: block.text,
              bbox: block.bbox,
              confidence: block.confidence ?? null,
            })),
          })
        : { candidates: [], reasoningMs: null };
      const completed = options.reasoner ? now() : ocrCompleted;
      return {
        run: {
          id: `analysis-${input.documentId}-${input.pageId}-${started}`,
          documentId: input.documentId,
          status: "ready",
          startedAt: new Date(started).toISOString(),
          completedAt: new Date(completed).toISOString(),
          ocrModel: "qvac-ocr-latin",
          ocrMs: ocrCompleted - started,
          reasoningModel: options.reasoner?.getState().id ?? "not-configured",
          reasoningMs: reasoning.reasoningMs,
          error: null,
        },
        page: {
          id: input.pageId,
          number: input.pageNumber,
          width: input.width,
          height: input.height,
        },
        ocrBlocks: blocks.map((block) => ({
          text: block.text,
          bbox: block.bbox,
          confidence: block.confidence ?? null,
        })),
        candidates: reasoning.candidates,
      };
    },
    async close() {
      await options.reasoner?.close();
      if (modelId) {
        await options.runtime.unloadModel({ modelId, clearStorage: false });
        modelId = null;
      }
      await options.runtime.close();
    },
  };
}
