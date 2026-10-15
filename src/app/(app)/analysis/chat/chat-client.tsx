"use client";

import { AlertTriangle, Layers, Loader2, SendHorizonal } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { AiDisclaimer } from "@/components/ai/ai-disclaimer";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { controlClass } from "@/components/ui/input";
import type { EpisodeExtraction } from "@/lib/ai/schemas/episode";
import type { ChatEvent, ExtractEvent } from "@/lib/analysis/types";
import { postNdjson } from "@/lib/ndjson";
import { detectPii, maskPii, piiSummary } from "@/lib/pii/detect";
import { cn } from "@/lib/utils";
import { ExtractedCards } from "./extracted-cards";

type Message = { role: "user" | "assistant"; content: string };

export function ChatClient({
  initialConversationId,
  initialMessages,
}: {
  initialConversationId: string | null;
  initialMessages: Message[];
}) {
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [piiConfirmed, setPiiConfirmed] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extraction, setExtraction] = useState<EpisodeExtraction | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const pii = useMemo(() => detectPii(input), [input]);
  const userTurns = messages.filter((m) => m.role === "user").length;
  const busy = streaming !== null || extracting;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, streaming]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setError(null);
    setMessages((m) => [...m, { role: "user", content: text }]);
    setInput("");
    setStreaming("");
    let reply = "";
    let failed = false;
    const wasNew = conversationId === null;
    await postNdjson<ChatEvent>(
      "/api/ai/analysis/chat",
      { conversationId, message: text, piiConfirmed },
      (e) => {
        if (e.type === "conversation") {
          setConversationId(e.conversationId);
          window.history.replaceState(null, "", `/analysis/chat?c=${e.conversationId}`);
        } else if (e.type === "delta") {
          reply += e.text;
          setStreaming(reply);
        } else if (e.type === "error") {
          failed = true;
          setError(e.message);
        }
      },
    );
    setStreaming(null);
    if (failed) {
      // 실패한 턴은 서버에서도 지워지므로 입력을 되돌린다 (새 대화였다면 대화도 지워진다)
      setMessages((m) => m.slice(0, -1));
      setInput(text);
      if (wasNew) {
        setConversationId(null);
        window.history.replaceState(null, "", "/analysis/chat");
      }
    } else {
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
      setPiiConfirmed(false);
    }
  }

  async function extract() {
    if (!conversationId) return;
    setError(null);
    setExtracting(true);
    await postNdjson<ExtractEvent>("/api/ai/analysis/extract", { conversationId }, (e) => {
      if (e.type === "result") setExtraction(e.extraction);
      else if (e.type === "error") setError(e.message);
    });
    setExtracting(false);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
      <section
        aria-label="대화"
        className="grid min-h-[60dvh] grid-rows-[1fr_auto] gap-3 rounded-xl border bg-card p-3 sm:p-4"
      >
        <ol className="grid content-start gap-3 overflow-y-auto" aria-live="polite">
          {messages.map((m, i) => (
            <li key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <p
                className={cn(
                  "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-6",
                  m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted",
                )}
              >
                <span className="sr-only">{m.role === "user" ? "나: " : "코치: "}</span>
                {m.content}
              </p>
            </li>
          ))}
          {streaming !== null ? (
            <li className="flex justify-start">
              <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-muted px-4 py-2.5 text-sm leading-6">
                <span className="sr-only">코치: </span>
                {streaming || (
                  <Loader2 aria-label="코치가 답변을 작성 중" className="size-4 animate-spin" />
                )}
              </p>
            </li>
          ) : null}
          <div ref={bottomRef} />
        </ol>

        <form
          className="grid gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          {pii.length > 0 ? (
            <Alert variant="warning" className="grid gap-2 py-2">
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <AlertTriangle aria-hidden="true" className="size-4" />
                {piiSummary(pii)}로 보이는 내용이 있습니다.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setInput(maskPii(input, pii))}
                >
                  마스킹하기
                </Button>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={piiConfirmed}
                    onChange={(e) => setPiiConfirmed(e.target.checked)}
                    className="size-4 accent-primary"
                  />
                  민감정보가 아닙니다
                </label>
              </div>
            </Alert>
          ) : null}
          {error ? <Alert variant="destructive">{error}</Alert> : null}
          <div className="flex items-end gap-2">
            <label htmlFor="chat-input" className="sr-only">
              메시지
            </label>
            <textarea
              id="chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={2}
              maxLength={2000}
              placeholder="경험을 자유롭게 이야기해 주세요 (Enter 전송, Shift+Enter 줄바꿈)"
              className={cn(controlClass, "min-h-12 flex-1 resize-none py-2")}
              disabled={busy}
            />
            <Button
              type="submit"
              size="icon"
              aria-label="보내기"
              disabled={busy || !input.trim() || (pii.length > 0 && !piiConfirmed)}
            >
              {streaming !== null ? (
                <Loader2 aria-hidden="true" className="animate-spin" />
              ) : (
                <SendHorizonal aria-hidden="true" />
              )}
            </Button>
          </div>
          <AiDisclaimer />
        </form>
      </section>

      <aside className="grid content-start gap-3">
        <div className="grid gap-2 rounded-xl border bg-card p-4">
          <h2 className="font-semibold">에피소드 카드로 정리</h2>
          <p className="text-sm text-muted-foreground">
            이야기가 어느 정도 쌓이면 대화 내용을 상황·과제·행동·결과 카드로 정리할 수 있어요.
            말하지 않은 내용은 추가하지 않습니다.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={extract}
            disabled={busy || !conversationId || userTurns < 2}
          >
            {extracting ? (
              <Loader2 aria-hidden="true" className="animate-spin" />
            ) : (
              <Layers aria-hidden="true" />
            )}
            {extracting ? "정리 중…" : "카드로 정리"}
          </Button>
          {userTurns < 2 ? (
            <p className="text-xs text-muted-foreground">
              대화를 2번 이상 주고받으면 사용할 수 있어요.
            </p>
          ) : null}
        </div>
        {extraction && conversationId ? (
          <ExtractedCards
            conversationId={conversationId}
            extraction={extraction}
            onDismiss={() => setExtraction(null)}
          />
        ) : null}
      </aside>
    </div>
  );
}
