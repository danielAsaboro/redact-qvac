import { z } from "zod";

export const modelStateSchema = z.object({
  kind: z.enum(["ocr", "reasoning"]),
  id: z.string().min(1),
  state: z.enum(["not_loaded", "loading", "ready", "error"]),
});

export const healthResponseSchema = z.object({
  service: z.enum(["ready", "error"]),
  busy: z.boolean(),
  models: z.array(modelStateSchema),
});

export const analyzePageRequestSchema = z.object({
  documentId: z.string().min(1),
  pageId: z.string().min(1),
  pageNumber: z.number().int().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  pngBase64: z.string().min(1),
  level: z.enum(["private", "confidential"]),
  direction: z.string().max(500),
});

export const rawOcrBlockSchema = z.object({
  text: z.string(),
  bbox: z.tuple([
    z.number().finite(),
    z.number().finite(),
    z.number().finite(),
    z.number().finite(),
  ]),
  confidence: z.number().min(0).max(1).nullable(),
});

export const analysisRunReceiptSchema = z.object({
  id: z.string().min(1),
  documentId: z.string().min(1),
  status: z.enum(["ready", "unavailable", "error"]),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
  ocrModel: z.string().min(1),
  ocrMs: z.number().nonnegative().nullable(),
  reasoningModel: z.string().min(1),
  reasoningMs: z.number().nonnegative().nullable(),
  error: z.string().nullable(),
});

export const redactionLabelSchema = z.enum([
  "name",
  "email",
  "phone",
  "address",
  "account",
  "identity",
  "amount",
  "date",
  "reference",
  "business",
  "other",
]);

export const candidateSuggestionSchema = z.object({
  blockIndex: z.number().int().nonnegative(),
  label: redactionLabelSchema,
  explanation: z.string().min(1).max(280),
  confidence: z.number().min(0).max(1),
});

export const analysisResponseSchema = z.object({
  run: analysisRunReceiptSchema,
  page: z.object({
    id: z.string().min(1),
    number: z.number().int().positive(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }),
  ocrBlocks: z.array(rawOcrBlockSchema),
  candidates: z.array(candidateSuggestionSchema),
});

export const serviceErrorSchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
  }),
});

export type AnalyzePageRequest = z.infer<typeof analyzePageRequestSchema>;
export type AnalysisResponse = z.infer<typeof analysisResponseSchema>;
export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type CandidateSuggestion = z.infer<typeof candidateSuggestionSchema>;
