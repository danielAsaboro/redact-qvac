// @vitest-environment node

import { describe, expect, it } from "vitest";

import { assertWarmedCache, assertRemoteNetworkingDenied, withRemoteFetchBlocked } from "./offline-proof";

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

// A DNS failure or unreachable host is not evidence of an OS sandbox.
describe("OS networking evidence", () => {
  it.each(["ENOTFOUND", "ETIMEDOUT", "ECONNREFUSED"])("rejects inconclusive %s failures", async (code) => {
    await expect(assertRemoteNetworkingDenied(async () => {
      throw Object.assign(new Error("connection failed"), { code });
    })).rejects.toThrow("permission denial");
  });
  it("rejects a successful remote connection", async () => {
    await expect(assertRemoteNetworkingDenied(async () => {})).rejects.toThrow("not blocked");
  });
  it.each(["EPERM", "EACCES"])("accepts OS permission denial %s", async (code) => {
    await expect(assertRemoteNetworkingDenied(async () => {
      throw Object.assign(new Error("denied"), { code });
    })).resolves.toBeUndefined();
  });
});
