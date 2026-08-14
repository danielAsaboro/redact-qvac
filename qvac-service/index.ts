import { access, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { createQvacOcrAnalyzer } from "./qvac-analyzer";
import { resolveLocalQvacPaths } from "./local-config";
import { createStructuredReasoner } from "./reasoning";
import { closeQvacService, createQvacService } from "./server";

const port = Number.parseInt(process.env.REDACT_QVAC_PORT ?? "4317", 10);
const appDirectory = fileURLToPath(new URL("../", import.meta.url));
const { cacheDirectory, configPath, runtimeHome, tempDirectory } =
  resolveLocalQvacPaths(appDirectory);

async function main() {
  await Promise.all([
    mkdir(cacheDirectory, { recursive: true }),
    mkdir(tempDirectory, { recursive: true }),
  ]);
  await writeFile(configPath, `${JSON.stringify({ cacheDirectory }, null, 2)}\n`, "utf8");
  await access(configPath);
  process.env.QVAC_CONFIG_PATH = configPath;
  process.env.SNAP_USER_COMMON = runtimeHome;

  const qvac = await import("@qvac/sdk");
  const reasoner = createStructuredReasoner({
    runtime: {
      loadModel: (options) => qvac.loadModel(options as never),
      completion: (options) => qvac.completion(options as never),
      unloadModel: (options) => qvac.unloadModel(options),
    },
    modelSource: qvac.QWEN3_600M_INST_Q4,
  });
  const analyzer = createQvacOcrAnalyzer({
    runtime: qvac,
    modelSource: qvac.OCR_LATIN,
    reasoner,
  });
  const server = createQvacService({ analyzer });
  server.listen(port, "127.0.0.1", () => {
    process.stdout.write(`Redact QVAC service listening on http://127.0.0.1:${port}\n`);
  });

  let closing = false;
  async function close() {
    if (closing) return;
    closing = true;
    await closeQvacService(server, analyzer);
  }

  process.once("SIGINT", close);
  process.once("SIGTERM", close);
}

main().catch((error) => {
  process.stderr.write(`Redact QVAC service failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
