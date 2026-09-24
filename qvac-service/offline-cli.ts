import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import { createQvacOcrAnalyzer } from "./qvac-analyzer";
import { resolveLocalQvacPaths } from "./local-config";
import { assertWarmedCache, assertRemoteNetworkingDenied, withRemoteFetchBlocked } from "./offline-proof";
import { createStructuredReasoner } from "./reasoning";

async function main() {
  const appDirectory = fileURLToPath(new URL("../", import.meta.url));
  const paths = resolveLocalQvacPaths(appDirectory);
  await Promise.all([
    mkdir(paths.cacheDirectory, { recursive: true }),
    mkdir(paths.tempDirectory, { recursive: true }),
  ]);
  assertWarmedCache(await readdir(paths.cacheDirectory));
  await writeFile(paths.configPath, `${JSON.stringify({ cacheDirectory: paths.cacheDirectory }, null, 2)}\n`);
  process.env.QVAC_CONFIG_PATH = paths.configPath;
  process.env.SNAP_USER_COMMON = paths.runtimeHome;

  await assertRemoteNetworkingDenied();
  const osNetworkDenied = true;

  const qvac = await import("@qvac/sdk");
  const analyzer = createQvacOcrAnalyzer({
    modelSource: qvac.OCR_LATIN,
    runtime: qvac,
    reasoner: createStructuredReasoner({
      modelSource: qvac.QWEN3_600M_INST_Q4,
      runtime: {
        loadModel: (options) => qvac.loadModel(options as never),
        completion: (options) => qvac.completion(options as never),
        unloadModel: (options) => qvac.unloadModel(options),
      },
    }),
  });
  const source = await readFile(
    fileURLToPath(new URL("../public/test-files/redact/chat-private.png", import.meta.url)),
  );
  const metadata = await sharp(source).metadata();
  if (!metadata.width || !metadata.height) throw new Error("Offline test raster has no dimensions");
  try {
    const response = await withRemoteFetchBlocked(() =>
      analyzer.analyzePage({
        documentId: "offline-chat-private",
        pageId: "offline-page-1",
        pageNumber: 1,
        width: metadata.width!,
        height: metadata.height!,
        pngBase64: source.toString("base64"),
        level: "private",
        direction: "Redact direct identifiers, account numbers, and references.",
      }),
    );
    if (response.ocrBlocks.length === 0 || response.candidates.length === 0) {
      throw new Error("Cached analysis returned no review evidence");
    }
    process.stdout.write(`${JSON.stringify({
      mode: "macos-process-network-denied",
      osNetworkDenied,
      sourceSha256: createHash("sha256").update(source).digest("hex"),
      ocrBlocks: response.ocrBlocks.length,
      suggestions: response.candidates.length,
      labels: response.candidates.map((candidate) => candidate.label),
      run: response.run,
    }, null, 2)}\n`);
  } finally {
    await analyzer.close();
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(`Offline QVAC proof failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
