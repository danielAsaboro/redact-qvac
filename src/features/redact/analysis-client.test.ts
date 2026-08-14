import { describe, expect, it, vi } from "vitest";

import { createAnalysisClient } from "./analysis-client";

describe("local analysis client", () => {
  it("validates health instead of trusting localhost JSON", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          service: "ready",
          busy: false,
          models: [{ kind: "ocr", id: "qvac-ocr-latin", state: "not_loaded" }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const client = createAnalysisClient({ fetchImpl });

    await expect(client.health()).resolves.toMatchObject({ service: "ready" });
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://127.0.0.1:4317/health",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("serializes one raster page without exposing the original file", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body).toEqual({
        documentId: "document-1",
        pageId: "page-1",
        pageNumber: 1,
        width: 2,
        height: 1,
        pngBase64: "AQID",
        level: "private",
        direction: "Hide phone numbers",
      });
      return new Response(
        JSON.stringify({
          run: {
            id: "run-1",
            documentId: "document-1",
            status: "ready",
            startedAt: "2026-08-14T10:00:00.000Z",
            completedAt: "2026-08-14T10:00:01.000Z",
            ocrModel: "qvac-ocr-latin",
            ocrMs: 1000,
            reasoningModel: "qwen3-600m-instruct-q4",
            reasoningMs: 200,
            error: null,
          },
          page: { id: "page-1", number: 1, width: 2, height: 1 },
          ocrBlocks: [],
          candidates: [],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    const client = createAnalysisClient({ fetchImpl });

    await expect(
      client.analyzePage({
        documentId: "document-1",
        pageId: "page-1",
        pageNumber: 1,
        width: 2,
        height: 1,
        pngBytes: new Uint8Array([1, 2, 3]).buffer,
        level: "private",
        direction: "Hide phone numbers",
      }),
    ).resolves.toMatchObject({ page: { id: "page-1" } });
  });

  it("rejects a successful response with invalid geometry", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          run: {
            id: "run-1",
            documentId: "document-1",
            status: "ready",
            startedAt: "2026-08-14T10:00:00.000Z",
            completedAt: "2026-08-14T10:00:01.000Z",
            ocrModel: "qvac-ocr-latin",
            ocrMs: 1000,
            reasoningModel: "qwen3-600m-instruct-q4",
            reasoningMs: 200,
            error: null,
          },
          page: { id: "page-1", number: 1, width: 0, height: 1 },
          ocrBlocks: [],
          candidates: [],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    await expect(
      createAnalysisClient({ fetchImpl }).analyzePage({
        documentId: "document-1",
        pageId: "page-1",
        pageNumber: 1,
        width: 2,
        height: 1,
        pngBytes: new ArrayBuffer(0),
        level: "private",
        direction: "",
      }),
    ).rejects.toThrow("invalid analysis response");
  });

  it("aborts a stalled request at the configured local timeout", async () => {
    vi.useFakeTimers();
    const client = createAnalysisClient({
      requestTimeoutMs: 25,
      fetchImpl: vi.fn(async (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        }),
      ),
    });

    const assertion = expect(client.health()).rejects.toThrow(
      "Local analysis request timed out",
    );
    await vi.advanceTimersByTimeAsync(25);
    await assertion;
    vi.useRealTimers();
  });

  it("reports caller cancellation separately from a timeout", async () => {
    const controller = new AbortController();
    const client = createAnalysisClient({
      fetchImpl: vi.fn(async (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        }),
      ),
    });

    const assertion = expect(client.health(controller.signal)).rejects.toThrow(
      "Local analysis request was cancelled",
    );
    controller.abort();
    await assertion;
  });
});
