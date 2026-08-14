import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDirectory = fileURLToPath(new URL("../", import.meta.url));
const defaultSource = fileURLToPath(
  new URL("../public/test-files/redact/chat-private.png", import.meta.url),
);
const sourcePath = path.resolve(process.argv[2] ?? defaultSource);
const sourceName = path.basename(sourcePath);
const qvacDirectory = path.join(appDirectory, ".qvac");
const cacheDirectory = path.join(qvacDirectory, "models");
const configPath = path.join(qvacDirectory, "config.json");

let modelId;
let sdk;
try {
  await access(sourcePath);
  const sourceBytes = await readFile(sourcePath);
  const sourceDigest = createHash("sha256").update(sourceBytes).digest("hex");
  await mkdir(cacheDirectory, { recursive: true });
  await writeFile(
    configPath,
    `${JSON.stringify({ cacheDirectory }, null, 2)}\n`,
    "utf8",
  );
  process.env.QVAC_CONFIG_PATH = configPath;

  sdk = await import("@qvac/sdk");
  modelId = await sdk.loadModel({
    modelSrc: sdk.OCR_LATIN,
    modelConfig: {
      langList: ["en"],
      magRatio: 1.5,
      defaultRotationAngles: [90, 180, 270],
      contrastRetry: false,
      lowConfidenceThreshold: 0.5,
      recognizerBatchSize: 1,
    },
  });
  const run = sdk.ocr({
    modelId,
    image: sourcePath,
    options: { paragraph: false },
  });
  const [blocks, stats] = await Promise.all([run.blocks, run.stats]);
  process.stdout.write(
    `${JSON.stringify(
      {
        sourceName,
        sourceDigest,
        cacheDirectory,
        blocks,
        stats: stats ?? null,
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(
    `QVAC OCR smoke failed: ${message}\nThe first successful run downloads OCR assets into ${qvacDirectory}; warmed runs reuse that local cache.\n`,
  );
  process.exitCode = 1;
} finally {
  if (sdk && modelId) {
    await sdk.unloadModel({ modelId, clearStorage: false }).catch(() => undefined);
  }
  if (sdk) await sdk.close().catch(() => undefined);
}
