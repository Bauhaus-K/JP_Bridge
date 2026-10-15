import { z } from "zod";

export const interviewQuestionsSchema = z.object({
  questions: z
    .array(
      z.object({
        question_ja: z.string().describe("면접관의 질문 (일본어, 話し言葉)"),
        intent_ko: z.string().describe("질문 의도 (한국어, 1문장)"),
        tip_ko: z.string().describe("답변 포인트 (한국어, 1문장)"),
      }),
    )
    .describe("면접 질문 목록 (요청한 개수)"),
});

/** 질문 행(interview_turns.question)에 의도·팁을 함께 저장하기 위한 메타 (feedback 이전 단계) */
export type QuestionMeta = { intent_ko: string; tip_ko: string };

export const interviewFeedbackSchema = z.object({
  content_ko: z.string().describe("내용: 질문에 답했는가, 근거·구체성 (한국어)"),
  keigo_ko: z.string().describe("경어·표현: 尊敬語/謙譲語/丁寧語, 御社, 話し言葉 (한국어)"),
  logic_ko: z.string().describe("논리: 結論→理由→具体例→学び 구조 (한국어)"),
  good_points_ko: z.array(z.string()).describe("잘한 점 (한국어)"),
  keigo_fixes: z
    .array(
      z.object({
        before_ja: z.string().describe("답변 속 표현 (그대로 인용)"),
        after_ja: z.string().describe("더 자연스러운 표현"),
        note_ko: z.string().describe("이유 (한국어)"),
      }),
    )
    .describe("경어·표현 수정 (최대 5개)"),
  improved_answer_ja: z
    .string()
    .describe("개선 예시 답변 (일본어, 사용자가 말한 사실만 사용, 1분 분량)"),
  followup_question_ja: z
    .string()
    .nullable()
    .describe("꼬리질문 (일본어). 꼬리질문 답변에 대한 피드백이면 null"),
});

export type InterviewFeedback = z.infer<typeof interviewFeedbackSchema>;

export const interviewSummarySchema = z.object({
  overall_ko: z.string().describe("면접 전체 총평 (한국어, 3~5문장, 합격 가능성 언급 금지)"),
  strengths_ko: z.array(z.string()).describe("이번 면접에서 드러난 강점"),
  improvements_ko: z.array(z.string()).describe("다음 면접까지 개선할 점"),
  keigo_patterns: z
    .array(z.object({ wrong_ja: z.string(), right_ja: z.string(), note_ko: z.string() }))
    .describe("반복된 경어·표현 실수 패턴"),
  practice_tips_ko: z.array(z.string()).describe("구체적인 연습 방법"),
  next_questions_ja: z.array(z.string()).describe("다음에 연습하면 좋을 질문 (일본어)"),
});

export type InterviewSummary = z.infer<typeof interviewSummarySchema>;
