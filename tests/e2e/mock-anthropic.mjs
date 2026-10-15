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
  return sse(res, body.model, JSON.stringify(esReview(userText)));
});

server.listen(PORT, "127.0.0.1", () => console.log(`mock anthropic on ${PORT}`));
