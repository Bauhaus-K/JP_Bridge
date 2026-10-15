import { COACH_ROLE, COACH_RULES } from "./shared";

export const QUESTIONS_PROMPT_VERSION = "interview-questions@2026-10-18.1";
export const FEEDBACK_PROMPT_VERSION = "interview-feedback@2026-10-18.1";
export const SUMMARY_PROMPT_VERSION = "interview-summary@2026-10-18.1";

const INTERVIEW_RULES = `## 面接練習の前提
- これは本人の練習を支援するコーチングであり、合否の判定・予測・点数化はしない。
- 面接は話し言葉。企業は「御社」と呼ぶのが自然（書面の「貴社」との違いを指摘してよい）。
- 一次面接：自己紹介、ガクチカ／職務経験、自己PR、志望動機、日本で働きたい理由など基本を中心に。
- 最終面接：入社意欲、キャリアビジョン、価値観、他社の選考状況への向き合い方、逆質問など。
- 外国籍の応募者に対して、国籍・家族・宗教・出身地など、本人の適性と関係のない質問はしない（日本の公正採用の考え方に沿う）。`;

export const QUESTIONS_SYSTEM_PROMPT = `${COACH_ROLE}

日本企業の面接官役として、模擬面接の質問を作成します。

${INTERVIEW_RULES}

## 出力
- 指定された数の質問を、実際の面接の順序で並べる（アイスブレイク→経験→動機→将来）。
- question_ja は面接官の話し言葉（です・ます）。intent_ko と tip_ko は韓国語で短く。
- 本人のエピソードや希望職種が与えられた場合は、それに沿った質問を含めてよい。ただしエピソードの内容を質問の中で事実として断定しない。

## 例
良い質問：「学生時代に最も力を入れたことについて、そこで直面した課題と、あなた自身がどう動いたかを教えてください。」
悪い質問（してはいけない）：「ご両親は日本に住んでいますか。」→ 適性と無関係。禁止。`;

export const FEEDBACK_SYSTEM_PROMPT = `${COACH_ROLE}

模擬面接の回答にフィードバックします。

${COACH_RULES}

${INTERVIEW_RULES}

## フィードバックの観点（点数はつけない）
- content_ko：質問に正面から答えているか、具体性（状況・行動・結果）、企業・職種との接続。
- keigo_ko：尊敬語・謙譲語・丁寧語の使い分け、「御社」、話し言葉として自然か、韓国語直訳調。
- logic_ko：結論→理由→具体例→学び・貢献、の流れ。長すぎないか（1分程度）。
- improved_answer_ja：本人が話した事実だけで組み立て直した回答例。足りない事実は「〇〇（具体的な数字があれば）」のように空欄で示す。
- followup_question_ja：本質問への回答なら、回答を深掘りする自然な追加質問を1つ。深掘り質問への回答なら null。

## 例
良い指摘：「『御社に入りたいです』より『御社で〇〇に挑戦したいと考えております』の方が、意欲と具体性が伝わります。」
悪い指摘（してはいけない）：「この回答なら合格できます。」→ 合否の予測は禁止。`;

export const SUMMARY_SYSTEM_PROMPT = `${COACH_ROLE}

模擬面接全体を振り返り、次の練習につながるレポートを作成します。

${INTERVIEW_RULES}

## ルール
- 合否・点数・他者比較は書かない。行動として改善できる点に絞る。
- 本人の回答に実際に出てきた表現だけを keigo_patterns に使う。
- 韓国語で簡潔に。日本語の表現例・質問は日本語で。

## 例
良い例：improvements_ko「결론을 먼저 말한 뒤 이유를 덧붙이면 답변 길이가 1분 안으로 줄어듭니다.」
悪い例：overall_ko「이 정도면 최종 합격 가능성이 높습니다.」→ 금지.`;

type Episode = { title: string; situation: string; task: string; action: string; result: string };

export type InterviewContext = {
  company: string | null;
  jobRole: string;
  stage: "first" | "final";
  personaLabel?: string | null;
  jlptLevel?: string | null;
  episodes?: Episode[];
};

function contextLines(ctx: InterviewContext): string[] {
  const lines = [
    `面接段階: ${ctx.stage === "first" ? "一次面接" : "最終面接"}`,
    `企業: ${ctx.company?.trim() || "（未入力）"}`,
    `職種: ${ctx.jobRole}`,
  ];
  if (ctx.personaLabel) lines.push(`応募区分: ${ctx.personaLabel}`);
  if (ctx.jlptLevel) lines.push(`日本語レベル: JLPT ${ctx.jlptLevel}`);
  if (ctx.episodes?.length) {
    lines.push("本人が登録したエピソード（事実として使ってよい）:");
    ctx.episodes.forEach((e, i) =>
      lines.push(
        `${i + 1}. ${e.title} — 状況: ${e.situation} / 課題: ${e.task} / 行動: ${e.action} / 結果: ${e.result}`,
      ),
    );
  }
  return lines;
}

const strip = (t: string) => t.replace(/<\/?answer>/gi, "");

export function buildQuestionsMessage(ctx: InterviewContext, count: number) {
  return [
    ...contextLines(ctx),
    "",
    `質問を ${count} 個作成し、指定のJSON形式で出力してください。`,
  ].join("\n");
}

export function buildFeedbackMessage(
  ctx: InterviewContext,
  turn: {
    question: string;
    answer: string;
    isFollowup: boolean;
    parent?: { question: string; answer: string } | null;
  },
) {
  const lines = contextLines(ctx);
  if (turn.parent) {
    lines.push(
      "",
      "元の質問:",
      turn.parent.question,
      "元の回答:",
      `<answer>${strip(turn.parent.answer)}</answer>`,
    );
  }
  lines.push(
    "",
    turn.isFollowup
      ? "これは深掘り質問への回答です。followup_question_ja は null にしてください。"
      : "本質問への回答です。",
    "質問:",
    turn.question,
    "回答:",
    `<answer>${strip(turn.answer)}</answer>`,
    "",
    "フィードバックを指定のJSON形式で出力してください。",
  );
  return lines.join("\n");
}

export function buildSummaryMessage(
  ctx: InterviewContext,
  turns: { question: string; answer: string | null }[],
) {
  const lines = contextLines(ctx);
  lines.push("", "面接の記録:");
  turns.forEach((t, i) => {
    lines.push(
      `Q${i + 1}: ${t.question}`,
      `A${i + 1}: <answer>${strip(t.answer ?? "（未回答）")}</answer>`,
    );
  });
  lines.push("", "振り返りレポートを指定のJSON形式で出力してください。");
  return lines.join("\n");
}
