import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";

import {
  analysisResponseSchema,
  analyzePageRequestSchema,
} from "../src/features/redact/analysis-contract";
import type { DocumentAnalyzer } from "./analyzer";

const DEFAULT_MAX_REQUEST_BYTES = 20 * 1024 * 1024;

export type ServiceOptions = {
  analyzer: DocumentAnalyzer;
  maxBodyBytes?: number;
  timeoutMs?: number;
};

class ServiceFailure extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

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

async function readJson(
  request: AsyncIterable<unknown>,
  maxBodyBytes: number,
): Promise<unknown> {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
    length += bytes.length;
    if (length > maxBodyBytes) {
      throw new ServiceFailure(413, "request_too_large", "Raster page request is too large");
    }
    chunks.push(bytes);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new ServiceFailure(400, "invalid_request", "Invalid analyze-page request");
  }
}

async function withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(
      () => reject(new ServiceFailure(504, "analysis_timeout", "Local analysis timed out")),
      timeoutMs,
    );
    timer.unref?.();
  });
  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function sendFailure(
  request: IncomingMessage,
  response: ServerResponse,
  failure: ServiceFailure,
) {
  sendJson(request, response, failure.status, {
    error: { code: failure.code, message: failure.message },
  });
}

export function createQvacService(options: ServiceOptions): Server {
  const maxBodyBytes = options.maxBodyBytes ?? DEFAULT_MAX_REQUEST_BYTES;
  const timeoutMs = options.timeoutMs ?? 180_000;
  let busy = false;

  return createServer(async (request, response) => {
    if (request.headers.origin && !localAppOrigin(request)) {
      sendJson(request, response, 403, {
        error: { code: "origin_forbidden", message: "Origin is not allowed" },
      });
      return;
    }
    if (request.method === "OPTIONS") {
      response.writeHead(204, {
        "access-control-allow-headers": "content-type, accept",
        "access-control-allow-methods": "GET, POST, OPTIONS",
        ...(localAppOrigin(request)
          ? { "access-control-allow-origin": localAppOrigin(request)!, vary: "Origin" }
          : {}),
      });
      response.end();
      return;
    }
    if (request.method === "GET" && request.url === "/health") {
      sendJson(request, response, 200, { ...options.analyzer.getState(), busy });
      return;
    }
    if (request.url === "/v1/analyze-page" && request.method !== "POST") {
      sendFailure(
        request,
        response,
        new ServiceFailure(405, "method_not_allowed", "Method is not allowed"),
      );
      return;
    }
    if (request.method === "POST" && request.url === "/v1/analyze-page") {
      if (busy) {
        sendFailure(
          request,
          response,
          new ServiceFailure(409, "busy", "Local analyzer is busy"),
        );
        return;
      }
      if (!request.headers["content-type"]?.startsWith("application/json")) {
        sendFailure(
          request,
          response,
          new ServiceFailure(415, "unsupported_media_type", "JSON is required"),
        );
        return;
      }

      busy = true;
      let operationStarted = false;
      try {
        const parsed = analyzePageRequestSchema.safeParse(
          await readJson(request, maxBodyBytes),
        );
        if (!parsed.success) {
          throw new ServiceFailure(400, "invalid_request", "Invalid analyze-page request");
        }
        const operation = options.analyzer.analyzePage(parsed.data);
        operationStarted = true;
        void operation.then(
          () => { busy = false; },
          () => { busy = false; },
        );
        const result = analysisResponseSchema.safeParse(
          await withTimeout(operation, timeoutMs),
        );
        if (!result.success) {
          throw new ServiceFailure(
            502,
            "invalid_analysis_response",
            "Local analysis returned an invalid response",
          );
        }
        sendJson(request, response, 200, result.data);
      } catch (error) {
        if (!operationStarted) busy = false;
        const failure = error instanceof ServiceFailure
          ? error
          : new ServiceFailure(503, "analyzer_unavailable", "Local analysis is unavailable");
        if (!(error instanceof ServiceFailure)) {
          process.stderr.write(
            `Redact QVAC analyze-page failed: ${error instanceof Error ? error.message : String(error)}\n`,
          );
        }
        sendFailure(request, response, failure);
      }
      return;
    }
    sendJson(request, response, 404, {
      error: { code: "not_found", message: "Route not found" },
    });
  });
}

export async function closeQvacService(
  server: Server,
  analyzer: DocumentAnalyzer,
): Promise<void> {
  if (server.listening) {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
  await analyzer.close();
}
