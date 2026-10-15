import { esReviewSchema } from "@/lib/ai/schemas/es-review";
import type { EsVersion } from "@/lib/db/database.types";
import type { EsAiFeedback, EsReviewView } from "./types";

/** AI 버전 행 → 화면용 첨삭 결과. 형식이 맞지 않으면 null. */
export function toReviewView(version: EsVersion): EsReviewView | null {
  if (version.source !== "ai" || !version.ai_feedback || !version.scores) return null;
  const fb = version.ai_feedback as unknown as EsAiFeedback;
  const scores = esReviewSchema.shape.scores.safeParse(version.scores);
  if (!scores.success || !fb.reviewed_version_id) return null;
  return {
    aiVersionId: version.id,
    reviewedVersionId: fb.reviewed_version_id,
    revisedText: version.content,
    revisedCharCount: version.char_count,
    overallComment: fb.overall_comment_ko,
    scores: scores.data,
    changes: fb.changes ?? [],
    questions: fb.questions_ko ?? [],
    createdAt: version.created_at,
  };
}
