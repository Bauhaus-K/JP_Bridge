import type { EsReview } from "@/lib/ai/schemas/es-review";

/** es_versions.ai_feedback 에 저장하는 AI 첨삭 결과 (source = 'ai' 버전) */
export type EsAiFeedback = {
  reviewed_version_id: string;
  overall_comment_ko: string;
  changes: EsReview["changes"];
  questions_ko: string[];
  model: string;
};

export type EsReviewView = {
  aiVersionId: string;
  reviewedVersionId: string;
  revisedText: string;
  revisedCharCount: number;
  overallComment: string;
  scores: EsReview["scores"];
  changes: EsReview["changes"];
  questions: string[];
  createdAt: string;
};

/** 스트리밍 응답(NDJSON) 이벤트 */
export type EsReviewEvent =
  | { type: "saved"; sourceVersionId: string }
  | { type: "progress"; outputChars: number; attempt: number }
  | { type: "result"; sourceVersionId: string; review: EsReviewView }
  | { type: "error"; code: string; message: string };
