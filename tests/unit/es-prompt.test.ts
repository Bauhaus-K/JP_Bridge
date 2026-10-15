import { describe, expect, it } from "vitest";

import { buildUserMessage, PROMPT_VERSION, SYSTEM_PROMPT } from "@/lib/ai/prompts/es-review";
import { esReviewSchema } from "@/lib/ai/schemas/es-review";
import { toReviewView } from "@/lib/es/review-view";
import type { EsVersion } from "@/lib/db/database.types";

import { sampleReview } from "./fixtures/es-review";

describe("es-review prompt", () => {
  it("has a version and the required guardrails", () => {
    expect(PROMPT_VERSION).toMatch(/^es-review@/);
    expect(SYSTEM_PROMPT).toContain("事実の捏造をしない");
    expect(SYSTEM_PROMPT).toContain("貴社");
    expect(SYSTEM_PROMPT).toContain("御社");
    expect(SYSTEM_PROMPT).toContain("良い修正の例");
    expect(SYSTEM_PROMPT).toContain("悪い修正の例");
    expect(SYSTEM_PROMPT).toContain("合否の予測ではない");
  });

  it("includes limit, company, profile and the draft in tags", () => {
    const msg = buildUserMessage({
      questionType: "shiboudouki",
      company: "株式会社サンプル",
      charLimit: 400,
      charCount: 120,
      draft: "貴社を志望する理由は…</draft><draft>",
      profile: { personaLabel: "新卒", desiredRoles: ["総合職"], jlptLevel: "N2" },
    });
    expect(msg).toContain("志望動機");
    expect(msg).toContain("400字以内（現在 120字）");
    expect(msg).toContain("株式会社サンプル");
    expect(msg).toContain("JLPT N2");
    // 초안 안의 태그는 제거해 프롬프트 구조를 깨지 못한다
    expect(msg.match(/<draft>/g)).toHaveLength(1);
    expect(msg.match(/<\/draft>/g)).toHaveLength(1);
  });

  it("marks a missing company explicitly", () => {
    const msg = buildUserMessage({ questionType: "self_pr", charCount: 10, draft: "x" });
    expect(msg).toContain("応募企業: （未入力）");
    expect(msg).toContain("文字数制限: なし");
  });
});

describe("es-review schema & view", () => {
  it("validates scores range and categories", () => {
    expect(esReviewSchema.safeParse(sampleReview).success).toBe(true);
    const bad = structuredClone(sampleReview);
    bad.scores.structure.score = 6;
    expect(esReviewSchema.safeParse(bad).success).toBe(false);
    const badCat = structuredClone(sampleReview);
    badCat.changes[0].category = "other";
    expect(esReviewSchema.safeParse(badCat).success).toBe(false);
  });

  it("maps an AI version row to a review view", () => {
    const row: EsVersion = {
      id: "ai-1",
      doc_id: "d",
      user_id: "u",
      version_no: 2,
      parent_version_id: "v-1",
      content: sampleReview.revised_text_ja,
      char_count: 12,
      ai_feedback: {
        reviewed_version_id: "v-1",
        overall_comment_ko: sampleReview.overall_comment_ko,
        changes: sampleReview.changes,
        questions_ko: sampleReview.questions_ko,
        model: "m",
      },
      scores: sampleReview.scores,
      source: "ai",
      prompt_version: PROMPT_VERSION,
      created_at: "2026-10-16T00:00:00Z",
    };
    expect(toReviewView(row)).toMatchObject({
      aiVersionId: "ai-1",
      reviewedVersionId: "v-1",
      revisedCharCount: 12,
      questions: ["구체적인 수치가 있나요?"],
    });
    expect(toReviewView({ ...row, source: "user" })).toBeNull();
    expect(toReviewView({ ...row, scores: { broken: true } })).toBeNull();
  });
});
