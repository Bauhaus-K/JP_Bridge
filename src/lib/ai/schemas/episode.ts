import { z } from "zod";

/** 에피소드 카드 (자기분석 결과 / 직접 입력 공통) */
export const episodeSchema = z.object({
  title: z.string().trim().min(1).max(60).describe("카드 제목 (한국어, 20자 내외)"),
  situation: z.string().trim().max(1000).describe("상황 (한국어)"),
  task: z.string().trim().max(1000).describe("과제·목표 (한국어)"),
  action: z.string().trim().max(1000).describe("본인의 행동 (한국어, 가장 구체적으로)"),
  result: z.string().trim().max(1000).describe("결과·배운 점 (한국어, 사용자가 말한 수치만)"),
  keywords: z.array(z.string().trim().min(1).max(30)).max(8).describe("ES에 쓸 일본어 키워드"),
  strengths: z
    .array(z.string().trim().min(1).max(30))
    .max(6)
    .describe("강점 태그, '日本語(한국어)' 형식 예: 主体性(주체성)"),
});

export type EpisodeInput = z.infer<typeof episodeSchema>;

export const episodeExtractionSchema = z.object({
  episodes: z.array(episodeSchema).max(5).describe("대화에서 확인된 에피소드 (0~5개)"),
  missing_info_ko: z
    .array(z.string())
    .describe("카드를 더 구체적으로 만들려면 추가로 물어볼 점 (한국어)"),
});

export type EpisodeExtraction = z.infer<typeof episodeExtractionSchema>;
