import path from "node:path";

export function resolveLocalQvacPaths(appDirectory: string) {
  const qvacDirectory = path.join(appDirectory, ".qvac");
  return {
    qvacDirectory,
    cacheDirectory: path.join(qvacDirectory, "models"),
    configPath: path.join(qvacDirectory, "config.json"),
  };
}

export function buildOcrReceipt<TBlock, TStats>(input: {
  sourceName: string;
  sourceDigest: string;
  cacheDirectory: string;
  blocks: TBlock[];
  stats: TStats;
}) {
  return {
    sourceName: input.sourceName,
    sourceDigest: input.sourceDigest,
    cacheDirectory: input.cacheDirectory,
    blocks: input.blocks,
    stats: input.stats,
  };
}
