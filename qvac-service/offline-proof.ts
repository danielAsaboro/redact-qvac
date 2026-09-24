import { connect } from "node:net";

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

// Connect without sending application data. Only an explicit OS denial proves
// the sandbox; DNS, routing, and timeout failures are inconclusive.
function probeRemoteConnection(): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = connect({ host: "1.1.1.1", port: 443 });
    socket.setTimeout(5_000);
    socket.once("connect", () => { socket.destroy(); resolve(); });
    socket.once("error", (error) => { socket.destroy(); reject(error); });
    socket.once("timeout", () => {
      socket.destroy();
      reject(Object.assign(new Error("Network probe timed out"), { code: "ETIMEDOUT" }));
    });
  });
}

export async function assertRemoteNetworkingDenied(
  probe: () => Promise<void> = probeRemoteConnection,
): Promise<void> {
  try {
    await probe();
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    if (code === "EPERM" || code === "EACCES") return;
    throw new Error(`Offline proof requires an OS permission denial; received ${code ?? "unknown error"}`);
  }
  throw new Error("Remote networking is not blocked by the process sandbox");
}
