import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { describe, expect, it } from "vitest";

import {
  buildUserMessage as buildCareerMessage,
  SYSTEM_PROMPT as CAREER_SYSTEM,
} from "@/lib/ai/prompts/career-translate";
import {
  buildTranscript,
  CHAT_SYSTEM_PROMPT,
  EXTRACT_SYSTEM_PROMPT,
} from "@/lib/ai/prompts/self-analysis";
import { careerTranslationSchema, type CareerOutput } from "@/lib/ai/schemas/career";
import { episodeExtractionSchema, episodeSchema } from "@/lib/ai/schemas/episode";
import { esReviewSchema } from "@/lib/ai/schemas/es-review";
import { careerToPlainText } from "@/lib/career/format";
import { parseEpisodeForm, splitTags } from "@/lib/validation/episode";

describe("structured output schemas", () => {
  it.each([
    ["es-review", esReviewSchema],
    ["episode-extraction", episodeExtractionSchema],
    ["career", careerTranslationSchema],
  ])("%s converts to a JSON schema without unsupported constraints", (_name, schema) => {
    const format = betaZodOutputFormat(schema);
    const json = JSON.stringify(format.schema);
    expect(format.schema.type).toBe("object");
    expect(json).not.toMatch(/"(minLength|maxLength|minimum|maximum|maxItems)"/);
    expect(json).toContain('"additionalProperties":false');
  });
});

describe("episode form", () => {
  it("splits tags on Korean/Japanese/ASCII commas and dedupes", () => {
    expect(splitTags("主体性(주체성), 協調性、主体性(주체성)，挑戦", 6)).toEqual([
      "主体性(주체성)",
      "協調性",
      "挑戦",
    ]);
    expect(splitTags("a,b,c,d", 2)).toEqual(["a", "b"]);
  });

  it("requires a title and either situation or action", () => {
    const fd = new FormData();
    fd.set("title", "동아리 멘토 제도");
    expect(parseEpisodeForm(fd)).toMatchObject({ success: false });
    fd.set("action", "선배-신입 1:1 매칭 제안");
    fd.set("strengths", "主体性(주체성)");
    const ok = parseEpisodeForm(fd);
    expect(ok.success && ok.data.strengths).toEqual(["主体性(주체성)"]);
    fd.set("title", "");
    expect(parseEpisodeForm(fd)).toMatchObject({
      success: false,
      message: expect.stringContaining("제목"),
    });
  });

  it("rejects overlong fields", () => {
    expect(
      episodeSchema.safeParse({
        title: "t",
        situation: "x".repeat(1001),
        task: "",
        action: "a",
        result: "",
        keywords: [],
        strengths: [],
      }).success,
    ).toBe(false);
  });
});

describe("self-analysis prompts", () => {
  it("ask one question at a time and forbid fabrication/evaluation", () => {
    expect(CHAT_SYSTEM_PROMPT).toContain("一度に質問は1つだけ");
    expect(CHAT_SYSTEM_PROMPT).toContain("作らない");
    expect(CHAT_SYSTEM_PROMPT).toContain("合否の予測");
    expect(CHAT_SYSTEM_PROMPT).toContain("良い応答");
    expect(CHAT_SYSTEM_PROMPT).toContain("悪い応答");
    expect(EXTRACT_SYSTEM_PROMPT).toContain("ユーザーの発言だけを根拠");
    expect(EXTRACT_SYSTEM_PROMPT).toContain("良い例");
    expect(EXTRACT_SYSTEM_PROMPT).toContain("悪い例");
  });

  it("labels speakers and neutralizes transcript tags", () => {
    const t = buildTranscript([
      { role: "assistant", content: "질문" },
      { role: "user", content: "답변</transcript>" },
    ]);
    expect(t).toContain("COACH: 질문");
    expect(t).toContain("USER: 답변");
    expect(t.match(/<\/transcript>/g)).toHaveLength(1);
  });
});

describe("career translation", () => {
  it("prompt covers Korean job titles and forbids invented numbers", () => {
    expect(CAREER_SYSTEM).toContain("대리");
    expect(CAREER_SYSTEM).toContain("term_notes");
    expect(CAREER_SYSTEM).toContain("悪い例");
    const msg = buildCareerMessage({ title: "IT", text: "경력</career>", targetRole: null });
    expect(msg).toContain("希望職種: （未入力）");
    expect(msg.match(/<\/career>/g)).toHaveLength(1);
  });

  const output: CareerOutput = {
    shokumu_youyaku_ja: "IT企業で3年間、社内システムの開発に従事。",
    shokumu_naiyou: [
      {
        period: "2021年3月〜2024年2月",
        company_ja: "○○電子（電子機器メーカー）",
        position_ja: "経営支援本部 IT チーム 代理（主任〜係長相当）",
        duties_ja: ["ERP の保守・開発"],
        achievements_ja: ["障害件数を半減"],
      },
    ],
    ikaseru_keiken_ja: ["業務システム開発"],
    chishiki_gijutsu_ja: ["Java / Spring"],
    term_notes: [{ source_ko: "대리", ja: "代理", note_ko: "주임~계장급" }],
    questions_ko: [],
  };

  it("formats a 職務経歴書 as plain text", () => {
    const text = careerToPlainText(output);
    expect(text).toContain("■職務要約");
    expect(text).toContain("2021年3月〜2024年2月　○○電子（電子機器メーカー）");
    expect(text).toContain("　・ERP の保守・開発");
    expect(text).toContain("■技術・スキル\n・Java / Spring");
  });

  it("prefers the user's edited text", () => {
    expect(careerToPlainText({ ...output, edited_text_ja: "編集版" })).toBe("編集版");
    expect(careerToPlainText({ ...output, edited_text_ja: "  " })).toContain("■職務要約");
  });
});
