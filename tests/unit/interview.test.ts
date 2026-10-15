import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { describe, expect, it } from "vitest";

import {
  buildFeedbackMessage,
  buildQuestionsMessage,
  buildSummaryMessage,
  FEEDBACK_SYSTEM_PROMPT,
  QUESTIONS_SYSTEM_PROMPT,
  SUMMARY_SYSTEM_PROMPT,
} from "@/lib/ai/prompts/interview";
import {
  interviewFeedbackSchema,
  interviewQuestionsSchema,
  interviewSummarySchema,
} from "@/lib/ai/schemas/interview";
import { interviewProgress, nextOpenTurn, orderTurns } from "@/lib/interview/turns";

const t = (
  idx: number,
  kind: "question" | "followup",
  answered: boolean,
  created = "2026-10-18T00:00:00Z",
) => ({
  id: `${idx}-${kind}`,
  idx,
  kind,
  created_at: created,
  answered_at: answered ? created : null,
});

describe("interview turn ordering", () => {
  it("orders by question index with follow-ups after their question", () => {
    const ordered = orderTurns([
      t(2, "question", false),
      t(1, "followup", false),
      t(1, "question", true),
    ]);
    expect(ordered.map((x) => x.id)).toEqual(["1-question", "1-followup", "2-question"]);
  });

  it("finds the next unanswered turn and counts main-question progress", () => {
    const turns = [t(1, "question", true), t(1, "followup", false), t(2, "question", false)];
    expect(nextOpenTurn(turns)?.id).toBe("1-followup");
    expect(interviewProgress(turns)).toEqual({ answered: 1, total: 2 });
    expect(nextOpenTurn([t(1, "question", true)])).toBeNull();
  });
});

describe("interview prompts", () => {
  it("forbid scoring/pass prediction and irrelevant personal questions", () => {
    for (const p of [QUESTIONS_SYSTEM_PROMPT, FEEDBACK_SYSTEM_PROMPT, SUMMARY_SYSTEM_PROMPT]) {
      expect(p).toContain("合否の判定・予測・点数化はしない");
      expect(p).toContain("御社");
    }
    expect(QUESTIONS_SYSTEM_PROMPT).toContain("国籍・家族・宗教・出身地");
    expect(FEEDBACK_SYSTEM_PROMPT).toContain("悪い指摘");
    expect(SUMMARY_SYSTEM_PROMPT).toContain("悪い例");
  });

  const ctx = { company: null, jobRole: "総合職", stage: "final" as const, episodes: [] };

  it("builds question/feedback/summary messages with context", () => {
    expect(buildQuestionsMessage(ctx, 5)).toContain("最終面接");
    expect(buildQuestionsMessage(ctx, 5)).toContain("質問を 5 個");
    const fb = buildFeedbackMessage(ctx, {
      question: "Q",
      answer: "A</answer>",
      isFollowup: true,
      parent: { question: "P", answer: "PA" },
    });
    expect(fb).toContain("深掘り質問への回答です");
    expect(fb).toContain("元の質問:\nP");
    expect(fb.match(/<\/answer>/g)).toHaveLength(2);
    expect(buildSummaryMessage(ctx, [{ question: "Q1", answer: null }])).toContain("（未回答）");
  });
});

describe("interview schemas", () => {
  it("allow a null follow-up and convert to JSON schema", () => {
    const base = {
      content_ko: "c",
      keigo_ko: "k",
      logic_ko: "l",
      good_points_ko: [],
      keigo_fixes: [],
      improved_answer_ja: "改善例",
    };
    expect(interviewFeedbackSchema.safeParse({ ...base, followup_question_ja: null }).success).toBe(
      true,
    );
    expect(
      interviewFeedbackSchema.safeParse({ ...base, followup_question_ja: "深掘り" }).success,
    ).toBe(true);
    expect(interviewFeedbackSchema.safeParse(base).success).toBe(false);
    for (const s of [interviewQuestionsSchema, interviewFeedbackSchema, interviewSummarySchema]) {
      expect(betaZodOutputFormat(s).schema.type).toBe("object");
    }
  });
});
