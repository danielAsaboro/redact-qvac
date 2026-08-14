import {
  analysisResponseSchema,
  healthResponseSchema,
  serviceErrorSchema,
  type AnalysisResponse,
  type HealthResponse,
} from "./analysis-contract";
import type { ConfidentialityLevel } from "./workflow-domain";

export type AnalyzeRasterPageInput = {
  documentId: string;
  pageId: string;
  pageNumber: number;
  width: number;
  height: number;
  pngBytes: ArrayBuffer;
  level: ConfidentialityLevel;
  direction: string;
};

export type AnalysisClient = {
  health(signal?: AbortSignal): Promise<HealthResponse>;
  analyzePage(input: AnalyzeRasterPageInput, signal?: AbortSignal): Promise<AnalysisResponse>;
};

type ClientOptions = {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  requestTimeoutMs?: number;
};

function bytesToBase64(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes);
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < view.length; offset += chunkSize) {
    binary += String.fromCharCode(...view.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

export function createAnalysisClient(options: ClientOptions = {}): AnalysisClient {
  const baseUrl = (
    options.baseUrl ??
    process.env.NEXT_PUBLIC_REDACT_QVAC_URL ??
    "http://127.0.0.1:4317"
  ).replace(/\/$/, "");
  const fetchImpl = options.fetchImpl ?? fetch;
  const requestTimeoutMs = options.requestTimeoutMs ?? 190_000;

  async function request(
    url: string,
    init: RequestInit,
    externalSignal?: AbortSignal,
  ) {
    const controller = new AbortController();
    let timedOut = false;
    const cancel = () => controller.abort(externalSignal?.reason);
    if (externalSignal?.aborted) cancel();
    else externalSignal?.addEventListener("abort", cancel, { once: true });
    const timer = globalThis.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, requestTimeoutMs);
    try {
      return await fetchImpl(url, { ...init, signal: controller.signal });
    } catch (error) {
      if (externalSignal?.aborted) {
        throw new Error("Local analysis request was cancelled");
      }
      if (timedOut) throw new Error("Local analysis request timed out");
      throw error;
    } finally {
      globalThis.clearTimeout(timer);
      externalSignal?.removeEventListener("abort", cancel);
    }
  }

  async function parse<T>(
    response: Response,
    schema: { safeParse(value: unknown): { success: boolean; data?: T } },
    invalidMessage: string,
  ): Promise<T> {
    let value: unknown;
    try {
      value = await response.json();
    } catch {
      throw new Error(invalidMessage);
    }
    if (!response.ok) {
      const parsedError = serviceErrorSchema.safeParse(value);
      throw new Error(
        parsedError.success ? parsedError.data.error.message : invalidMessage,
      );
    }
    const parsed = schema.safeParse(value);
    if (!parsed.success) throw new Error(invalidMessage);
    return parsed.data as T;
  }

  return {
    async health(signal) {
      const response = await request(`${baseUrl}/health`, {
        headers: { accept: "application/json" },
      }, signal);
      return parse(response, healthResponseSchema, "Local service returned an invalid health response");
    },
    async analyzePage(input, signal) {
      const response = await request(`${baseUrl}/v1/analyze-page`, {
        method: "POST",
        headers: { accept: "application/json", "content-type": "application/json" },
        body: JSON.stringify({
          documentId: input.documentId,
          pageId: input.pageId,
          pageNumber: input.pageNumber,
          width: input.width,
          height: input.height,
          pngBase64: bytesToBase64(input.pngBytes),
          level: input.level,
          direction: input.direction,
        }),
      }, signal);
      return parse(response, analysisResponseSchema, "Local service returned an invalid analysis response");
    },
  };
}
