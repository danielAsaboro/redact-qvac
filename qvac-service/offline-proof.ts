export function assertWarmedCache(files: readonly string[]) {
  const hasDetector = files.some((file) => /craft/i.test(file));
  const hasRecognizer = files.some((file) => /latin/i.test(file));
  const hasReasoner = files.some((file) => /qwen/i.test(file));
  if (!hasDetector || !hasRecognizer || !hasReasoner) {
    throw new Error(
      "QVAC cache is incomplete; warm both models with qvac:ocr-smoke and one successful app analysis first.",
    );
  }
}

export async function withRemoteFetchBlocked<T>(operation: () => Promise<T>): Promise<T> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
    const raw = input instanceof Request ? input.url : String(input);
    const url = new URL(raw);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return Promise.reject(new Error(`Remote fetch blocked during offline proof: ${url.origin}`));
    }
    return originalFetch(input, init);
  }) as typeof fetch;
  try {
    return await operation();
  } finally {
    globalThis.fetch = originalFetch;
  }
}
