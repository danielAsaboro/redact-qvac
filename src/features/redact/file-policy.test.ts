import { describe, expect, it } from "vitest";

import {
  normalizeDirection,
  safeOutputName,
  validateUploadMeta,
} from "./file-policy";

describe("upload policy", () => {
  it.each([
    ["scan.png", "image/png", "image"],
    ["photo.jpg", "image/jpeg", "image"],
    ["report.pdf", "application/pdf", "pdf"],
  ] as const)("accepts %s as a %s source", (name, type, kind) => {
    expect(validateUploadMeta({ name, type, size: 1024 })).toEqual({
      kind,
      mimeType: type,
    });
  });

  it("rejects unsupported document types", () => {
    expect(() =>
      validateUploadMeta({
        name: "book.xlsx",
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        size: 1024,
      }),
    ).toThrow("Choose a PNG, JPEG, or PDF file");
  });

  it("rejects empty and oversized files", () => {
    expect(() =>
      validateUploadMeta({ name: "empty.png", type: "image/png", size: 0 }),
    ).toThrow("File cannot be empty");
    expect(() =>
      validateUploadMeta({
        name: "large.pdf",
        type: "application/pdf",
        size: 25 * 1024 * 1024 + 1,
      }),
    ).toThrow("File must be 25 MB or smaller");
  });

  it("normalizes additional direction and enforces its boundary", () => {
    expect(normalizeDirection("  hide   Apollo   IDs ")).toBe(
      "hide Apollo IDs",
    );
    expect(() => normalizeDirection("x".repeat(501))).toThrow(
      "Additional direction must be 500 characters or fewer",
    );
  });

  it("derives a separate safe-copy filename", () => {
    expect(safeOutputName("report.final.pdf", "pdf")).toBe(
      "report.final.redacted.pdf",
    );
    expect(safeOutputName("chat.jpg", "png")).toBe("chat.redacted.png");
  });
});
