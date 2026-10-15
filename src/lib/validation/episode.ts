import { episodeSchema } from "@/lib/ai/schemas/episode";

export function splitTags(value: string, max: number): string[] {
  return Array.from(
    new Set(
      value
        .split(/[,、，\n]/)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ).slice(0, max);
}

export function episodeFormToObject(form: FormData) {
  return {
    title: String(form.get("title") ?? ""),
    situation: String(form.get("situation") ?? ""),
    task: String(form.get("task") ?? ""),
    action: String(form.get("action") ?? ""),
    result: String(form.get("result") ?? ""),
    keywords: splitTags(String(form.get("keywords") ?? ""), 8),
    strengths: splitTags(String(form.get("strengths") ?? ""), 6),
  };
}

export function parseEpisodeForm(form: FormData) {
  const parsed = episodeSchema.safeParse(episodeFormToObject(form));
  if (parsed.success && !parsed.data.action.trim() && !parsed.data.situation.trim()) {
    return { success: false as const, message: "상황이나 행동 중 하나는 입력해 주세요." };
  }
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = String(issue?.path[0] ?? "");
    const label: Record<string, string> = {
      title: "제목(1~60자)",
      situation: "상황(1000자 이내)",
      task: "과제(1000자 이내)",
      action: "행동(1000자 이내)",
      result: "결과(1000자 이내)",
      keywords: "키워드(각 30자 이내)",
      strengths: "강점(각 30자 이내)",
    };
    return { success: false as const, message: `${label[field] ?? "입력값"}을 확인해 주세요.` };
  }
  return { success: true as const, data: parsed.data };
}
