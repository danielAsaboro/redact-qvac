export const MAX_SOURCE_BYTES = 25 * 1024 * 1024;
export const MAX_PDF_PAGES = 25;
export const MAX_RASTER_LONG_EDGE = 2400;
export const MAX_DIRECTION_CHARACTERS = 500;

export type SupportedMimeType =
  | "image/png"
  | "image/jpeg"
  | "application/pdf";

export type UploadKind = "image" | "pdf";
export type ValidatedUpload =
  | { kind: "image"; mimeType: "image/png" | "image/jpeg" }
  | { kind: "pdf"; mimeType: "application/pdf" };

const SUPPORTED_TYPES: Record<SupportedMimeType, UploadKind> = {
  "image/png": "image",
  "image/jpeg": "image",
  "application/pdf": "pdf",
};

export function validateUploadMeta(
  input: Pick<File, "name" | "type" | "size">,
): ValidatedUpload {
  if (input.size === 0) throw new Error("File cannot be empty");
  if (input.size > MAX_SOURCE_BYTES) {
    throw new Error("File must be 25 MB or smaller");
  }
  const mimeType = input.type as SupportedMimeType;
  const kind = SUPPORTED_TYPES[mimeType];
  if (!kind) throw new Error("Choose a PNG, JPEG, or PDF file");
  return { kind, mimeType } as ValidatedUpload;
}

export function normalizeDirection(value: string): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length > MAX_DIRECTION_CHARACTERS) {
    throw new Error("Additional direction must be 500 characters or fewer");
  }
  return normalized;
}

export function safeOutputName(
  sourceName: string,
  output: "png" | "pdf",
): string {
  const baseName = sourceName.replace(/\.[^.]+$/, "") || "document";
  return `${baseName}.redacted.${output}`;
}
