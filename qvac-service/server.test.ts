import { once } from "node:events";
import { request as httpRequest } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DocumentAnalyzer } from "./analyzer";
import { createQvacService, type ServiceOptions } from "./server";

const servers: ReturnType<typeof createQvacService>[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) => new Promise<void>((resolve) => server.close(() => resolve())),
    ),
  );
});

async function start(
  analyzer: DocumentAnalyzer,
  options: Omit<ServiceOptions, "analyzer"> = {},
) {
  const server = createQvacService({ analyzer, ...options });
  servers.push(server);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;
  return `http://127.0.0.1:${port}`;
}

const validRequest = {
  documentId: "document-1",
  pageId: "page-1",
  pageNumber: 1,
  width: 2,
  height: 1,
  pngBase64: "AQID",
  level: "private" as const,
  direction: "",
};

function validResult() {
  return {
    run: {
      id: "run-1",
      documentId: "document-1",
      status: "ready" as const,
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
  };
}

describe("QVAC loopback service", () => {
  it("reports service and lazy model state", async () => {
    const analyzer: DocumentAnalyzer = {
      getState: () => ({
        service: "ready",
        models: [{ kind: "ocr", id: "qvac-ocr-latin", state: "not_loaded" }],
      }),
      analyzePage: vi.fn(),
      close: vi.fn(),
    };
    const baseUrl = await start(analyzer);

    const response = await fetch(`${baseUrl}/health`);
    await expect(response.json()).resolves.toEqual({
      service: "ready",
      busy: false,
      models: [{ kind: "ocr", id: "qvac-ocr-latin", state: "not_loaded" }],
    });
  });

  it("validates page requests before calling the analyzer", async () => {
    const analyzePage = vi.fn();
    const analyzer: DocumentAnalyzer = {
      getState: () => ({ service: "ready", models: [] }),
      analyzePage,
      close: vi.fn(),
    };
    const baseUrl = await start(analyzer);

    const response = await fetch(`${baseUrl}/v1/analyze-page`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ documentId: "document-1" }),
    });

    expect(response.status).toBe(400);
    expect(analyzePage).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      error: { code: "invalid_request", message: "Invalid analyze-page request" },
    });
  });

  it("keeps the boundary explicit while inference is not connected", async () => {
    const analyzer: DocumentAnalyzer = {
      getState: () => ({ service: "ready", models: [] }),
      analyzePage: vi.fn(async () => {
        throw new Error("OCR is not connected at this checkpoint");
      }),
      close: vi.fn(),
    };
    const baseUrl = await start(analyzer);

    const response = await fetch(`${baseUrl}/v1/analyze-page`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        documentId: "document-1",
        pageId: "page-1",
        pageNumber: 1,
        width: 2,
        height: 1,
        pngBase64: "AQID",
        level: "private",
        direction: "",
      }),
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: { code: "analyzer_unavailable", message: "Local analysis is unavailable" },
    });
  });

  it("does not expose private page analysis to arbitrary web origins", async () => {
    const analyzer: DocumentAnalyzer = {
      getState: () => ({ service: "ready", models: [] }),
      analyzePage: vi.fn(),
      close: vi.fn(),
    };
    const baseUrl = await start(analyzer);

    const response = await fetch(`${baseUrl}/health`, {
      headers: { origin: "https://attacker.example" },
    });

    expect(response.status).toBe(403);
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("reserves one inference slot and reports busy to concurrent requests", async () => {
    let release!: () => void;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    const analyzePage = vi.fn(async () => { await pending; return validResult(); });
    const analyzer: DocumentAnalyzer = {
      getState: () => ({ service: "ready", models: [] }),
      analyzePage,
      close: vi.fn(),
    };
    const baseUrl = await start(analyzer);
    const request = () => fetch(`${baseUrl}/v1/analyze-page`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validRequest),
    });

    const first = request();
    await vi.waitFor(() => expect(analyzePage).toHaveBeenCalledOnce());
    const second = await request();
    expect(second.status).toBe(409);
    await expect(second.json()).resolves.toMatchObject({ error: { code: "busy" } });
    release();
    expect((await first).status).toBe(200);
  });

  it("reserves the slot before awaiting a staged request body", async () => {
    const analyzePage = vi.fn(async () => validResult());
    const analyzer: DocumentAnalyzer = {
      getState: () => ({ service: "ready", models: [] }),
      analyzePage,
      close: vi.fn(),
    };
    const baseUrl = await start(analyzer);
    const body = JSON.stringify(validRequest);
    const url = new URL("/v1/analyze-page", baseUrl);
    const staged = httpRequest({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: "POST",
      headers: { "content-type": "application/json", "content-length": Buffer.byteLength(body) },
    });
    staged.on("error", () => undefined);
    staged.flushHeaders();

    await vi.waitFor(async () => {
      await expect(fetch(`${baseUrl}/health`).then((value) => value.json())).resolves.toMatchObject({ busy: true });
    });
    const second = await fetch(`${baseUrl}/v1/analyze-page`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });
    expect(second.status).toBe(409);

    const firstResponse = new Promise<number>((resolve) => {
      staged.on("response", (response) => {
        response.resume();
        response.on("end", () => resolve(response.statusCode ?? 0));
      });
    });
    staged.end(body);
    await expect(firstResponse).resolves.toBe(200);
    expect(analyzePage).toHaveBeenCalledOnce();
  });

  it("times out the response but stays busy until native inference settles", async () => {
    let release!: () => void;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    const analyzer: DocumentAnalyzer = {
      getState: () => ({ service: "ready", models: [] }),
      analyzePage: vi.fn(async () => { await pending; return validResult(); }),
      close: vi.fn(),
    };
    const baseUrl = await start(analyzer, { timeoutMs: 20 });
    const response = await fetch(`${baseUrl}/v1/analyze-page`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validRequest),
    });

    expect(response.status).toBe(504);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "analysis_timeout" } });
    await expect(fetch(`${baseUrl}/health`).then((value) => value.json())).resolves.toMatchObject({ busy: true });
    release();
    await vi.waitFor(async () => {
      await expect(fetch(`${baseUrl}/health`).then((value) => value.json())).resolves.toMatchObject({ busy: false });
    });
  });

  it("returns stable body, media, method, and malformed-output failures", async () => {
    const analyzer: DocumentAnalyzer = {
      getState: () => ({ service: "ready", models: [] }),
      analyzePage: vi.fn(async () => ({ invalid: true }) as never),
      close: vi.fn(),
    };
    const baseUrl = await start(analyzer, { maxBodyBytes: 120 });
    const oversized = await fetch(`${baseUrl}/v1/analyze-page`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...validRequest, direction: "x".repeat(500) }),
    });
    const media = await fetch(`${baseUrl}/v1/analyze-page`, { method: "POST", body: "{}" });
    const method = await fetch(`${baseUrl}/v1/analyze-page`, { method: "PATCH" });

    expect(oversized.status).toBe(413);
    expect(media.status).toBe(415);
    expect(method.status).toBe(405);

    const malformedBase = await start(analyzer);
    const malformed = await fetch(`${malformedBase}/v1/analyze-page`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validRequest),
    });
    expect(malformed.status).toBe(502);
    await expect(malformed.json()).resolves.toMatchObject({
      error: { code: "invalid_analysis_response" },
    });
  });
});
