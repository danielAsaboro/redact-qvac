// @vitest-environment node

import { describe, expect, it } from "vitest";

import { assertWarmedCache, withRemoteFetchBlocked } from "./offline-proof";

describe("offline ownership proof", () => {
  it("requires both OCR assets and the reasoning model", () => {
    expect(() =>
      assertWarmedCache([
        "latin_g2.gguf",
        "craft_mlt_25k.gguf",
        "Qwen3-0.6B-Q4_0.gguf",
      ]),
    ).not.toThrow();
    expect(() => assertWarmedCache(["latin_g2.gguf"])).toThrow("warm both models");
  });

  it("blocks remote HTTP fetch, permits data URLs, and restores fetch", async () => {
    const original = globalThis.fetch;
    const data = await withRemoteFetchBlocked(async () => {
      await expect(fetch("https://example.invalid/private")).rejects.toThrow(
        "Remote fetch blocked",
      );
      return (await fetch("data:text/plain,local")).text();
    });
    expect(data).toBe("local");
    expect(globalThis.fetch).toBe(original);
  });

  it("restores fetch even when the protected operation rejects", async () => {
    const original = globalThis.fetch;
    await expect(
      withRemoteFetchBlocked(async () => {
        throw new Error("analysis failed");
      }),
    ).rejects.toThrow("analysis failed");
    expect(globalThis.fetch).toBe(original);
  });
});
