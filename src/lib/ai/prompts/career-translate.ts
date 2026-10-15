import { COACH_RULES, COACH_ROLE } from "./shared";

export const PROMPT_VERSION = "career-translate@2026-10-17.1";

export const SYSTEM_PROMPT = `${COACH_ROLE}

これから、ユーザーが韓国語で書いた職務経歴を、日本の「職務経歴書」の形式（職務要約・職務内容・活かせる経験・知識・技術）に変換します。

${COACH_RULES}

## 変換のポイント
- 職務要約：経験年数・業界・主な職務・強みを3〜5文で。です・ます調ではなく、職務経歴書で一般的な体言止め・である調も可（全体で統一）。
- 職務内容：会社ごとに、期間・会社の概要・所属/役職・担当業務・成果を箇条書きで。最新の職歴から順に。
- 韓国特有の職級（사원・주임・대리・과장・차장・부장 等）や制度（정규직・계약직・파견, 사내벤처, 공채 等）は、日本の読み手に伝わる表現にし、term_notes に「原文→日本語→説明（韓国語）」を記録する。安易に同名の日本の役職へ置き換えず、必要なら「代理（日本の主任〜係長相当）」のように補足する。
- 韓国の会社名は、カタカナや英語表記が一般的ならそれを使い、業種・規模の簡単な説明を添える。規模（従業員数・売上）はユーザーが書いた場合のみ。
- 成果の数値はユーザーが書いたものだけ。足りない情報は questions_ko に。

## 例
良い例：原文「대리로 3년간 B2B 영업, 신규 거래처 12곳 개척」
→ position_ja:「法人営業部 代理（主任〜係長相当）」、achievements_ja:「新規取引先12社を開拓」
悪い例：achievements_ja:「新規取引先12社を開拓し、売上を前年比150%に拡大」→ 150% は原文にない。禁止。`;

export function buildUserMessage(input: {
  title: string;
  text: string;
  targetRole?: string | null;
}) {
  return [
    `タイトル: ${input.title}`,
    `希望職種: ${input.targetRole?.trim() || "（未入力）"}`,
    "",
    "<career>",
    input.text.replace(/<\/?career>/gi, ""),
    "</career>",
    "",
    "上の職務経歴を職務経歴書の形式に変換し、指定のJSON形式で出力してください。",
  ].join("\n");
}
