import { access, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { createQvacOcrAnalyzer } from "./qvac-analyzer";
import { resolveLocalQvacPaths } from "./local-config";
import { createQvacService } from "./server";

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
  const analyzer = createQvacOcrAnalyzer({
    runtime: qvac,
    modelSource: qvac.OCR_LATIN,
  });
  const server = createQvacService({ analyzer });
  server.listen(port, "127.0.0.1", () => {
    process.stdout.write(`Redact QVAC service listening on http://127.0.0.1:${port}\n`);
  });

  async function close() {
    server.close();
    await analyzer.close();
  }

  process.once("SIGINT", close);
  process.once("SIGTERM", close);
}

main().catch((error) => {
  process.stderr.write(`Redact QVAC service failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
