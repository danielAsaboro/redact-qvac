import path from "node:path";
import { describe, expect, it } from "vitest";

import { buildOcrReceipt, resolveLocalQvacPaths } from "./local-config";

describe("standalone QVAC configuration", () => {
  it("keeps configuration and downloaded models inside the app", () => {
    expect(resolveLocalQvacPaths("/workspace/redact")).toEqual({
      qvacDirectory: path.join("/workspace/redact", ".qvac"),
      cacheDirectory: path.join("/workspace/redact", ".qvac", "models"),
      configPath: path.join("/workspace/redact", ".qvac", "config.json"),
    });
  });

  it("builds a source-bound OCR receipt without exposing an arbitrary path", () => {
    expect(
      buildOcrReceipt({
        sourceName: "chat-private.png",
        sourceDigest: "sha256-chat",
        cacheDirectory: "/workspace/redact/.qvac/models",
        blocks: [{ text: "Maya Chen", bbox: [1, 2, 3, 4] }],
        stats: { elapsedMs: 42 },
      }),
    ).toEqual({
      sourceName: "chat-private.png",
      sourceDigest: "sha256-chat",
      cacheDirectory: "/workspace/redact/.qvac/models",
      blocks: [{ text: "Maya Chen", bbox: [1, 2, 3, 4] }],
      stats: { elapsedMs: 42 },
    });
  });
});
