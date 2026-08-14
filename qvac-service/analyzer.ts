import type {
  AnalyzePageRequest,
  AnalysisResponse,
} from "../src/features/redact/analysis-contract";

export type AnalyzerState = {
  service: "ready" | "error";
  models: Array<{
    kind: "ocr" | "reasoning";
    id: string;
    state: "not_loaded" | "loading" | "ready" | "error";
  }>;
};

export interface DocumentAnalyzer {
  getState(): AnalyzerState;
  analyzePage(input: AnalyzePageRequest): Promise<AnalysisResponse>;
  close(): Promise<void>;
}
