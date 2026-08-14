import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DocumentAnalyzer } from "./analyzer";
import { createQvacService } from "./server";

const servers: ReturnType<typeof createQvacService>[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) => new Promise<void>((resolve) => server.close(() => resolve())),
    ),
  );
});

async function start(analyzer: DocumentAnalyzer) {
  const server = createQvacService({ analyzer });
  servers.push(server);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;
  return `http://127.0.0.1:${port}`;
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
});
