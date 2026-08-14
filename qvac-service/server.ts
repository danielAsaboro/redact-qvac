import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";

import { analyzePageRequestSchema } from "../src/features/redact/analysis-contract";
import type { DocumentAnalyzer } from "./analyzer";

const MAX_REQUEST_BYTES = 20 * 1024 * 1024;

export type ServiceOptions = {
  analyzer: DocumentAnalyzer;
};

function localAppOrigin(request: IncomingMessage): string | null {
  const origin = request.headers.origin;
  if (!origin) return null;
  try {
    const url = new URL(origin);
    return url.protocol === "http:" &&
      (url.hostname === "127.0.0.1" || url.hostname === "localhost")
      ? origin
      : null;
  } catch {
    return null;
  }
}

function sendJson(
  request: IncomingMessage,
  response: ServerResponse,
  status: number,
  body: unknown,
): void {
  const encoded = JSON.stringify(body);
  const origin = localAppOrigin(request);
  response.writeHead(status, {
    "access-control-allow-headers": "content-type, accept",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    ...(origin ? { "access-control-allow-origin": origin, vary: "Origin" } : {}),
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(encoded),
  });
  response.end(encoded);
}

async function readJson(request: AsyncIterable<unknown>): Promise<unknown> {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
    length += bytes.length;
    if (length > MAX_REQUEST_BYTES) throw new Error("request_too_large");
    chunks.push(bytes);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export function createQvacService(options: ServiceOptions): Server {
  let busy = false;

  return createServer(async (request, response) => {
    if (request.headers.origin && !localAppOrigin(request)) {
      sendJson(request, response, 403, {
        error: { code: "origin_forbidden", message: "Origin is not allowed" },
      });
      return;
    }
    if (request.method === "OPTIONS") {
      sendJson(request, response, 204, null);
      return;
    }
    if (request.method === "GET" && request.url === "/health") {
      sendJson(request, response, 200, { ...options.analyzer.getState(), busy });
      return;
    }
    if (request.method === "POST" && request.url === "/v1/analyze-page") {
      let input;
      try {
        input = analyzePageRequestSchema.parse(await readJson(request));
      } catch {
        sendJson(request, response, 400, {
          error: { code: "invalid_request", message: "Invalid analyze-page request" },
        });
        return;
      }

      busy = true;
      try {
        sendJson(request, response, 200, await options.analyzer.analyzePage(input));
      } catch {
        sendJson(request, response, 503, {
          error: { code: "analyzer_unavailable", message: "Local analysis is unavailable" },
        });
      } finally {
        busy = false;
      }
      return;
    }
    sendJson(request, response, 404, {
      error: { code: "not_found", message: "Route not found" },
    });
  });
}
