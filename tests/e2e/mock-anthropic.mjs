// E2E 전용 Anthropic Messages API 목 서버 (SSE 스트리밍).
// 앱은 ANTHROPIC_BASE_URL=http://127.0.0.1:4010 으로 이 서버를 호출한다. 앱 코드에는 목 분기가 없다.
//
// 초안에 다음 문자열이 있으면 동작을 바꾼다:
//   E2E_OVERLOADED   → 529 overloaded_error
//   E2E_INVALID_ONCE_<고유값> → 해당 값의 첫 응답만 스키마 위반, 재시도에는 정상 응답
import http from "node:http";

const PORT = Number(process.env.MOCK_ANTHROPIC_PORT ?? 4010);
const requests = [];
const invalidOnceSeen = new Set();

function esReview(userText) {
  const draft = /<draft>\n([\s\S]*?)\n<\/draft>/.exec(userText)?.[1] ?? "";
  const limit = Number(/文字数制限: (\d+)字以内/.exec(userText)?.[1] ?? 0);
  let revised = draft.replace(/頑張りました/g, "粘り強く取り組みました").replace(/E2E_\w+/g, "");
  if (!revised.includes("粘り強く")) revised = `私の強みは粘り強さです。${revised}`;
  if (limit) revised = Array.from(revised).slice(0, limit).join("");
  const firstSentence = draft.split("。")[0] + (draft.includes("。") ? "。" : "");
  return {
    overall_comment_ko:
      "결론을 먼저 제시하면 전달력이 좋아집니다. 행동의 구체성을 조금 더 보강해 보세요.",
    scores: {
      structure: { score: 3, comment_ko: "결론이 뒤에 나옵니다." },
      specificity: { score: 2, comment_ko: "행동 묘사가 추상적입니다." },
      naturalness: { score: 4, comment_ko: "문체가 대체로 통일되어 있습니다." },
      company_fit: { score: 3, comment_ko: "희망 직종의 일반적 기대에 비추어 평가했습니다." },
    },
    revised_text_ja: revised,
    changes: [
      {
        before_ja: firstSentence,
        after_ja: revised.split("。")[0] + "。",
        reason_ko: "결론(강점)을 첫 문장에 배치했습니다.",
        category: "structure",
      },
    ],
    questions_ko: ["그 경험에서 본인이 직접 한 행동은 무엇이었나요?"],
  };
}

function episodeExtraction(userText) {
  const said = [...userText.matchAll(/USER: ([^\n]+)/g)].map((m) => m[1]).join(" ");
  return {
    episodes: [
      {
        title: "동아리 신입 정착 프로그램",
        situation: said.slice(0, 120) || "동아리 활동",
        task: "신입 부원의 이탈을 줄이는 것",
        action: "선배와 신입을 1:1로 연결하는 제도를 제안하고 운영",
        result: "그 해 이탈자가 거의 없었음 (구체적 인원은 미확인)",
        keywords: ["新入部員の定着", "メンター制度"],
        strengths: ["主体性(주체성)", "課題解決力(과제 해결력)"],
      },
    ],
    missing_info_ko: ["이탈자가 이전에는 몇 명 정도였나요?"],
  };
}

function careerTranslation(userText) {
  const company = /<career>\n([^\s(]+)/.exec(userText)?.[1] ?? "○○社";
  return {
    shokumu_youyaku_ja:
      "韓国のIT企業にて約3年間、社内業務システムの開発・保守に従事してまいりました。",
    shokumu_naiyou: [
      {
        period: "2021年3月〜2024年2月",
        company_ja: `${company}（電子機器メーカー）`,
        position_ja: "経営支援本部 ITチーム 代理（主任〜係長相当）",
        duties_ja: [
          "社内ERPの保守および新規モジュール開発（Java, Spring）",
          "協力会社ポータル刷新プロジェクトのPL（5名）",
        ],
        achievements_ja: ["障害対応プロセスを見直し、月間障害件数を半減"],
      },
    ],
    ikaseru_keiken_ja: ["業務システムの要件整理から開発・運用までの一貫した経験"],
    chishiki_gijutsu_ja: ["Java / Spring", "Oracle"],
    term_notes: [
      {
        source_ko: "대리",
        ja: "代理",
        note_ko: "일본의 주임~계장급에 해당하는 직급으로 보충 설명을 붙였습니다.",
      },
    ],
    questions_ko: ["협력사 포털 리뉴얼의 기간을 알려 주세요."],
  };
}

function interviewQuestions(userText) {
  const n = Number(/質問を (\d+) 個/.exec(userText)?.[1] ?? 3);
  const pool = [
    "まず、簡単に自己紹介をお願いします。",
    "学生時代に最も力を入れたことを教えてください。",
    "なぜ日本で働きたいと考えたのですか。",
    "当社を志望する理由を教えてください。",
    "入社後に挑戦したいことは何ですか。",
    "あなたの強みを一つ挙げてください。",
    "チームで意見が対立したとき、どう対応しましたか。",
    "最後に何か質問はありますか。",
  ];
  return {
    questions: pool.slice(0, n).map((q) => ({
      question_ja: q,
      intent_ko: "지원자의 경험과 사고방식을 확인하려는 질문입니다.",
      tip_ko: "결론을 먼저 말하고 구체적인 행동을 덧붙이세요.",
    })),
  };
}

function interviewFeedback(userText) {
  const isFollowup = userText.includes("深掘り質問への回答です");
  return {
    content_ko: "질문에 정면으로 답했고 경험이 구체적입니다.",
    keigo_ko: "「御社」를 사용해 자연스럽습니다. 「思います」가 반복됩니다.",
    logic_ko: "결론→이유→예시 순서가 잘 지켜졌습니다.",
    good_points_ko: ["결론을 먼저 말했습니다."],
    keigo_fixes: [
      {
        before_ja: "頑張りたいと思います",
        after_ja: "貢献したいと考えております",
        note_ko: "의지를 더 분명하게 전달합니다.",
      },
    ],
    improved_answer_ja: "私の強みは粘り強さです。テニスサークルで新入部員の定着に取り組みました。",
    followup_question_ja: isFollowup ? null : "その経験で一番苦労したことは何ですか。",
  };
}

function interviewSummary() {
  return {
    overall_ko:
      "전반적으로 결론을 먼저 말하는 구조가 좋았습니다. 표현을 조금 더 다양하게 해 보세요.",
    strengths_ko: ["경험을 구체적으로 설명함"],
    improvements_ko: ["「思います」의 반복 줄이기"],
    keigo_patterns: [
      {
        wrong_ja: "頑張りたいと思います",
        right_ja: "貢献したいと考えております",
        note_ko: "의지 표현",
      },
    ],
    practice_tips_ko: ["답변을 녹음해 1분 안에 말하는 연습"],
    next_questions_ja: ["あなたの弱みは何ですか。"],
  };
}

const CHAT_REPLY =
  "좋은 경험이네요. 그때 직접 어떤 방법을 시도하셨는지 조금 더 자세히 들려주실 수 있을까요?";

function sse(res, model, text, stopReason = "end_turn") {
  res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  send("message_start", {
    type: "message_start",
    message: {
      id: `msg_mock_${Date.now()}`,
      type: "message",
      role: "assistant",
      model,
      content: [],
      stop_reason: null,
      stop_sequence: null,
      usage: { input_tokens: 321, output_tokens: 1 },
    },
  });
  send("content_block_start", {
    type: "content_block_start",
    index: 0,
    content_block: { type: "text", text: "" },
  });
  for (let i = 0; i < text.length; i += 40) {
    send("content_block_delta", {
      type: "content_block_delta",
      index: 0,
      delta: { type: "text_delta", text: text.slice(i, i + 40) },
    });
  }
  send("content_block_stop", { type: "content_block_stop", index: 0 });
  send("message_delta", {
    type: "message_delta",
    delta: { stop_reason: stopReason, stop_sequence: null },
    usage: { output_tokens: Math.ceil(text.length / 2) },
  });
  send("message_stop", { type: "message_stop" });
  res.end();
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/__requests") {
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(JSON.stringify(requests));
  }
  if (req.method !== "POST" || !req.url?.startsWith("/v1/messages")) {
    res.writeHead(404);
    return res.end();
  }
  let raw = "";
  for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw);
  requests.push({
    url: req.url,
    headers: { "anthropic-beta": req.headers["anthropic-beta"] ?? null },
    body,
  });

  const firstUser = body.messages.find((m) => m.role === "user");
  const userText =
    typeof firstUser.content === "string" ? firstUser.content : JSON.stringify(firstUser.content);

  if (userText.includes("E2E_OVERLOADED")) {
    res.writeHead(529, { "content-type": "application/json", "x-should-retry": "false" });
    return res.end(
      JSON.stringify({ type: "error", error: { type: "overloaded_error", message: "Overloaded" } }),
    );
  }
  const invalidToken = /E2E_INVALID_ONCE\w*/.exec(userText)?.[0];
  if (invalidToken && body.messages.length === 1 && !invalidOnceSeen.has(invalidToken)) {
    invalidOnceSeen.add(invalidToken);
    return sse(res, body.model, JSON.stringify({ overall_comment_ko: "missing fields" }));
  }
  const props = body.output_config?.format?.schema?.properties ?? null;
  if (!props) return sse(res, body.model, CHAT_REPLY);
  if (props.episodes) return sse(res, body.model, JSON.stringify(episodeExtraction(userText)));
  if (props.questions) return sse(res, body.model, JSON.stringify(interviewQuestions(userText)));
  if (props.improved_answer_ja)
    return sse(res, body.model, JSON.stringify(interviewFeedback(userText)));
  if (props.next_questions_ja) return sse(res, body.model, JSON.stringify(interviewSummary()));
  if (props.shokumu_youyaku_ja)
    return sse(res, body.model, JSON.stringify(careerTranslation(userText)));
  return sse(res, body.model, JSON.stringify(esReview(userText)));
});

server.listen(PORT, "127.0.0.1", () => console.log(`mock anthropic on ${PORT}`));
