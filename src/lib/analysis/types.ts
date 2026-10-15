import type { EpisodeExtraction } from "@/lib/ai/schemas/episode";

export type ChatEvent =
  | { type: "conversation"; conversationId: string }
  | { type: "delta"; text: string }
  | { type: "done"; conversationId: string }
  | { type: "error"; code: string; message: string };

export type ExtractEvent =
  | { type: "progress"; outputChars: number; attempt: number }
  | { type: "result"; extraction: EpisodeExtraction }
  | { type: "error"; code: string; message: string };
