import type { InterviewTurn } from "@/lib/db/database.types";

export type AnswerEvent =
  | { type: "progress"; outputChars: number; attempt: number }
  | { type: "result"; turn: InterviewTurn; followup: InterviewTurn | null }
  | { type: "error"; code: string; message: string };
