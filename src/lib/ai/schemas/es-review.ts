import { z } from "zod";

// structured outputs 는 min/max 등을 지원하지 않는다.
// SDK 가 API 로 보내는 스키마에서 제거하고, 우리는 아래 zod 로 다시 검증한다.
const score = z.object({
  score: z.number().int().min(1).max(5).describe("1~5 정수"),
  comment_ko: z.string().describe("점수 근거 (한국어, 1~2문장)"),
});

export const CHANGE_CATEGORIES = [
  "structure",
  "specificity",
  "naturalness",
  "keigo",
  "company_fit",
  "length",
] as const;

export const esReviewSchema = z.object({
  overall_comment_ko: z.string().describe("종합 코멘트 (한국어, 3~5문장)"),
  scores: z.object({
    structure: score.describe("구조: 결론 우선, 문단 흐름"),
    specificity: score.describe("구체성: 숫자·행동·결과"),
    naturalness: score.describe("일본어 자연스러움·문체 통일·경어"),
    company_fit: score.describe("기업·직종 적합성"),
  }),
  revised_text_ja: z
    .string()
    .describe("수정본 전문 (일본어). 사용자가 쓰지 않은 사실을 추가하지 않는다"),
  changes: z
    .array(
      z.object({
        before_ja: z.string().describe("원문 문장 (그대로 인용, 새 문장 추가면 빈 문자열)"),
        after_ja: z.string().describe("수정 문장 (삭제면 빈 문자열)"),
        reason_ko: z.string().describe("수정 이유 (한국어)"),
        category: z.enum(CHANGE_CATEGORIES),
      }),
    )
    .describe("문장 단위 주요 변경 사항"),
  questions_ko: z
    .array(z.string())
    .describe("구체화를 위해 사용자에게 되묻는 질문 (정보가 부족할 때, 없으면 빈 배열)"),
});

export type EsReview = z.infer<typeof esReviewSchema>;
export type EsScoreKey = keyof EsReview["scores"];

export const SCORE_LABELS: Record<EsScoreKey, string> = {
  structure: "구조",
  specificity: "구체성",
  naturalness: "일본어 자연스러움",
  company_fit: "기업 적합성",
};

export const CATEGORY_LABELS: Record<(typeof CHANGE_CATEGORIES)[number], string> = {
  structure: "구조",
  specificity: "구체성",
  naturalness: "자연스러움",
  keigo: "경어·문체",
  company_fit: "기업 적합성",
  length: "분량",
};
