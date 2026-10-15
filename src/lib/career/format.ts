import type { CareerOutput } from "@/lib/ai/schemas/career";

/** 職務経歴書 본문을 복사·편집용 일반 텍스트로 만든다. 사용자 편집본이 있으면 그것을 쓴다. */
export function careerToPlainText(output: CareerOutput): string {
  if (output.edited_text_ja?.trim()) return output.edited_text_ja;
  const lines: string[] = ["■職務要約", output.shokumu_youyaku_ja.trim(), "", "■職務内容"];
  for (const job of output.shokumu_naiyou) {
    lines.push(`${job.period}　${job.company_ja}`, `　${job.position_ja}`);
    if (job.duties_ja.length) {
      lines.push("　【担当業務】");
      job.duties_ja.forEach((d) => lines.push(`　・${d}`));
    }
    if (job.achievements_ja.length) {
      lines.push("　【実績】");
      job.achievements_ja.forEach((a) => lines.push(`　・${a}`));
    }
    lines.push("");
  }
  if (output.ikaseru_keiken_ja.length) {
    lines.push("■活かせる経験・知識");
    output.ikaseru_keiken_ja.forEach((x) => lines.push(`・${x}`));
    lines.push("");
  }
  if (output.chishiki_gijutsu_ja.length) {
    lines.push("■技術・スキル");
    output.chishiki_gijutsu_ja.forEach((x) => lines.push(`・${x}`));
  }
  return lines.join("\n").trimEnd();
}
