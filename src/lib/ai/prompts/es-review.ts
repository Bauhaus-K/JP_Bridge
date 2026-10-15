import { COACH_ROLE, COACH_RULES } from "./shared";

export const PROMPT_VERSION = "es-review@2026-10-16.1";

export const QUESTION_TYPE_LABELS = {
  self_pr: "自己PR",
  gakuchika: "ガクチカ（学生時代に力を入れたこと）",
  shiboudouki: "志望動機",
  free: "自由設問",
} as const;

export type EsQuestionType = keyof typeof QUESTION_TYPE_LABELS;

export const SYSTEM_PROMPT = `${COACH_ROLE}

これからエントリーシート（ES）の下書きを添削します。

${COACH_RULES}

## 添削の観点（各1〜5点、4観点）
- structure（構成）：結論ファースト、根拠→行動→結果→学び・貢献の流れ、段落の論理。
- specificity（具体性）：状況・自分の行動・数値や変化が具体的か。ただし数値は本人が書いたものだけを使う。
- naturalness（日本語の自然さ）：韓国語直訳調の表現、助詞・語順、です・ます調の統一、敬語、「貴社」の使用。
- company_fit（企業・職種への適合）：企業名や職種が分かる場合はその視点で。分からない場合は希望職種の一般的な期待に照らして評価し、その旨をコメントに書く。

点数はコーチングのための文章完成度の目安であり、合否の予測ではない。

## 修正版（revised_text_ja）
- 本人の経験と主張を保ったまま、伝わりやすい日本語に書き直す。
- 文字数制限がある場合は必ず制限以内に収め、できれば制限の9割以上を使う。
- 本人が書いていない事実は足さない。足りない情報は questions_ko で聞く。

## 変更点（changes）
- 主な修正を文単位で最大8件。before_ja は原文から正確に引用する。reason_ko は韓国語で、なぜ日本の採用担当者に伝わりやすくなるのかを説明する。

## 例

良い修正の例：
原文「私はリーダーシップがあります。サークルで多くのことを頑張りました。」
修正「私の強みは、メンバーの意見を引き出して目標に巻き込む力です。」（原文にない数値や役職は追加していない）
理由（韓国語）：結論을 먼저 구체적인 강점으로 제시. "많은 것을 노력했다"는 모호하므로, 실제 무엇을 했는지 questions_ko 로 되묻는다.

悪い修正の例（してはいけない）：
原文「アルバイトで売上に貢献しました。」
修正「アルバイトリーダーとして売上を前年比30%向上させました。」
→ 「リーダー」「30%」は本人が書いていない。捏造であり禁止。`;

export type EsReviewInput = {
  questionType: EsQuestionType;
  questionText?: string | null;
  company?: string | null;
  charLimit?: number | null;
  charCount: number;
  draft: string;
  profile?: {
    personaLabel?: string | null;
    desiredRoles?: string[];
    jlptLevel?: string | null;
  };
  episodes?: { title: string; situation: string; task: string; action: string; result: string }[];
};

function escapeTag(text: string) {
  return text.replace(/<\/?draft>/gi, "");
}

export function buildUserMessage(input: EsReviewInput): string {
  const lines: string[] = [];
  lines.push(`設問タイプ: ${QUESTION_TYPE_LABELS[input.questionType]}`);
  if (input.questionText) lines.push(`設問文: ${input.questionText}`);
  lines.push(`応募企業: ${input.company?.trim() || "（未入力）"}`);
  lines.push(
    input.charLimit
      ? `文字数制限: ${input.charLimit}字以内（現在 ${input.charCount}字）`
      : `文字数制限: なし（現在 ${input.charCount}字）`,
  );
  if (input.profile) {
    const p = input.profile;
    if (p.personaLabel) lines.push(`応募区分: ${p.personaLabel}`);
    if (p.desiredRoles?.length) lines.push(`希望職種: ${p.desiredRoles.join(" / ")}`);
    if (p.jlptLevel) lines.push(`日本語レベル: JLPT ${p.jlptLevel}`);
  }
  if (input.episodes?.length) {
    lines.push("", "本人が登録したエピソード（ここにある事実は使ってよい）:");
    input.episodes.forEach((e, i) => {
      lines.push(
        `${i + 1}. ${e.title} — 状況: ${e.situation} / 課題: ${e.task} / 行動: ${e.action} / 結果: ${e.result}`,
      );
    });
  }
  lines.push("", "<draft>", escapeTag(input.draft), "</draft>");
  lines.push("", "上の下書きを添削し、指定のJSON形式で出力してください。");
  return lines.join("\n");
}
