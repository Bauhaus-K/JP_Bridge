import { z } from "zod";

export const careerTranslationSchema = z.object({
  shokumu_youyaku_ja: z.string().describe("職務要約 (일본어, 3~5문장)"),
  shokumu_naiyou: z
    .array(
      z.object({
        period: z
          .string()
          .describe("재직 기간 (예: 2022年4月〜2024年3月, 사용자가 쓴 범위 안에서)"),
        company_ja: z.string().describe("회사명·업종 소개 (일본어)"),
        position_ja: z.string().describe("소속·직위 (일본식 표현)"),
        duties_ja: z.array(z.string()).describe("담당 업무 (일본어, 항목별)"),
        achievements_ja: z.array(z.string()).describe("성과 (일본어, 사용자가 말한 사실·수치만)"),
      }),
    )
    .describe("職務内容 (회사·직무 단위, 최신순)"),
  ikaseru_keiken_ja: z.array(z.string()).describe("活かせる経験・知識 (일본어)"),
  chishiki_gijutsu_ja: z.array(z.string()).describe("技術・スキル·자격 (일본어)"),
  term_notes: z
    .array(
      z.object({
        source_ko: z.string().describe("원문 한국어 용어 (직급·제도 등)"),
        ja: z.string().describe("일본식 표현"),
        note_ko: z.string().describe("설명 (한국어)"),
      }),
    )
    .describe("한국 특유 직급·제도 용어 주석"),
  questions_ko: z.array(z.string()).describe("더 정확한 번역을 위해 확인할 점 (한국어)"),
});

export type CareerTranslation = z.infer<typeof careerTranslationSchema>;

/** career_translations.output 에 저장하는 형태 (사용자 편집본 포함) */
export type CareerOutput = CareerTranslation & { edited_text_ja?: string | null };
