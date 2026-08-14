import type { BoundingBox } from "./workflow-domain";

function clamp(value: number, maximum: number) {
  return Math.max(0, Math.min(maximum, value));
}

function percentage(value: number, maximum: number) {
  return Math.round((value / maximum) * 100 * 1_000_000) / 1_000_000;
}

export function normalizeOcrBbox(
  raw: readonly [number, number, number, number],
  sourceWidth: number,
  sourceHeight: number,
): BoundingBox | null {
  if (!Number.isFinite(sourceWidth) || !Number.isFinite(sourceHeight) || sourceWidth <= 0 || sourceHeight <= 0) {
    throw new Error("Source dimensions must be positive");
  }
  if (!raw.every(Number.isFinite)) return null;

  const x1 = clamp(Math.min(raw[0], raw[2]), sourceWidth);
  const y1 = clamp(Math.min(raw[1], raw[3]), sourceHeight);
  const x2 = clamp(Math.max(raw[0], raw[2]), sourceWidth);
  const y2 = clamp(Math.max(raw[1], raw[3]), sourceHeight);
  if (x2 <= x1 || y2 <= y1) return null;

  return {
    x: percentage(x1, sourceWidth),
    y: percentage(y1, sourceHeight),
    width: percentage(x2 - x1, sourceWidth),
    height: percentage(y2 - y1, sourceHeight),
  };
}
