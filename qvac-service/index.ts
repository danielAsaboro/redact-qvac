import type { DocumentAnalyzer } from "./analyzer";
import { createQvacService } from "./server";

const port = Number.parseInt(process.env.REDACT_QVAC_PORT ?? "4317", 10);

const analyzer: DocumentAnalyzer = {
  getState: () => ({
    service: "ready",
    models: [
      { kind: "ocr", id: "qvac-ocr-latin", state: "not_loaded" },
      { kind: "reasoning", id: "not-configured", state: "not_loaded" },
    ],
  }),
  analyzePage: async () => {
    throw new Error("OCR is not connected at this checkpoint");
  },
  close: async () => undefined,
};

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
