"use client";

import { ChevronRight, Flag, Lightbulb, Loader2, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { AnswerInput } from "@/components/interview/answer-input";
import { FeedbackView } from "@/components/interview/feedback-view";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { InterviewFeedback, QuestionMeta } from "@/lib/ai/schemas/interview";
import type { InterviewTurn } from "@/lib/db/database.types";
import { interviewProgress, nextOpenTurn, orderTurns } from "@/lib/interview/turns";
import type { AnswerEvent } from "@/lib/interview/types";
import { postNdjson } from "@/lib/ndjson";
import { detectPii, piiSummary } from "@/lib/pii/detect";
import { finishInterviewAction } from "../actions";

export function InterviewRunner({
  sessionId,
  initialTurns,
  inputMode,
}: {
  sessionId: string;
  initialTurns: InterviewTurn[];
  inputMode: "text" | "voice";
}) {
  const router = useRouter();
  const [turns, setTurns] = useState(initialTurns);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justAnswered, setJustAnswered] = useState<InterviewTurn | null>(null);
  const [showTip, setShowTip] = useState(false);
  const [piiConfirmed, setPiiConfirmed] = useState(false);
  const [finishing, startFinishing] = useTransition();

  const current = useMemo(() => nextOpenTurn(turns), [turns]);
  const progress = interviewProgress(turns);
  const answeredCount = turns.filter((t) => t.answered_at).length;
  const pii = useMemo(() => detectPii(answer), [answer]);

  async function submit() {
    if (!current || !answer.trim()) return;
    setBusy(true);
    setError(null);
    await postNdjson<AnswerEvent>(
      "/api/ai/interview/answer",
      { turnId: current.id, answer, piiConfirmed },
      (e) => {
        if (e.type === "result") {
          setTurns((prev) =>
            orderTurns([
              ...prev.map((t) => (t.id === e.turn.id ? e.turn : t)),
              ...(e.followup ? [e.followup] : []),
            ]),
          );
          setJustAnswered(e.turn);
          setAnswer("");
          setShowTip(false);
          setPiiConfirmed(false);
        } else if (e.type === "error") {
          setError(e.message);
        }
      },
    );
    setBusy(false);
  }

  function finish() {
    setError(null);
    startFinishing(async () => {
      const res = await finishInterviewAction(sessionId);
      if (res.ok) router.refresh();
      else setError(res.message ?? "리포트를 만들지 못했습니다.");
    });
  }

  const meta = (current?.meta ?? null) as QuestionMeta | null;
  const feedback = (justAnswered?.feedback ?? null) as InterviewFeedback | null;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          본질문 {progress.answered} / {progress.total} 답변 완료
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={finish}
          disabled={finishing || busy || answeredCount === 0}
        >
          {finishing ? (
            <Loader2 aria-hidden="true" className="animate-spin" />
          ) : (
            <Flag aria-hidden="true" />
          )}
          {finishing ? "리포트 작성 중…" : "면접 종료하고 리포트 받기"}
        </Button>
      </div>

      {justAnswered && feedback ? (
        <section aria-labelledby="fb-heading" className="grid gap-3 rounded-xl border bg-card p-4">
          <h2 id="fb-heading" className="font-semibold">
            방금 답변에 대한 피드백
          </h2>
          <p lang="ja" className="text-sm text-muted-foreground">
            Q. {justAnswered.question}
          </p>
          <FeedbackView feedback={feedback} />
          {current ? (
            <Button type="button" className="w-fit" onClick={() => setJustAnswered(null)}>
              {current.kind === "followup" ? "꼬리질문 받기" : "다음 질문"}
              <ChevronRight aria-hidden="true" />
            </Button>
          ) : (
            <p className="text-sm font-medium">모든 질문에 답했습니다. 리포트를 받아 보세요.</p>
          )}
        </section>
      ) : current ? (
        <section aria-labelledby="q-heading" className="grid gap-4 rounded-xl border bg-card p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={current.kind === "followup" ? "warning" : "secondary"}>
              {current.kind === "followup" ? "꼬리질문" : `질문 ${current.idx}`}
            </Badge>
          </div>
          <h2
            id="q-heading"
            lang="ja"
            className="text-lg font-medium leading-8"
            data-testid="current-question"
          >
            {current.question}
          </h2>
          {meta ? (
            <div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowTip((v) => !v)}
                aria-expanded={showTip}
              >
                <Lightbulb aria-hidden="true" />
                질문 의도·답변 팁
              </Button>
              {showTip ? (
                <dl className="mt-2 grid gap-1 rounded-lg bg-muted/50 p-3 text-sm">
                  <dt className="font-medium">의도</dt>
                  <dd className="text-muted-foreground">{meta.intent_ko}</dd>
                  <dt className="font-medium">팁</dt>
                  <dd className="text-muted-foreground">{meta.tip_ko}</dd>
                </dl>
              ) : null}
            </div>
          ) : null}
          <label htmlFor="iv-answer" className="text-sm font-medium">
            내 답변
          </label>
          <AnswerInput
            id="iv-answer"
            mode={inputMode}
            value={answer}
            onChange={setAnswer}
            disabled={busy}
          />
          <p className="text-xs text-muted-foreground">
            {answer.length}자 · 1분 답변은 보통 300자 안팎입니다.
          </p>
          {pii.length > 0 ? (
            <Alert variant="warning" className="flex flex-wrap items-center gap-3">
              {piiSummary(pii)}로 보이는 내용이 있습니다.
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={piiConfirmed}
                  onChange={(e) => setPiiConfirmed(e.target.checked)}
                  className="size-4 accent-primary"
                />
                민감정보가 아닙니다
              </label>
            </Alert>
          ) : null}
          <Button
            type="button"
            className="w-fit"
            onClick={submit}
            disabled={busy || !answer.trim() || (pii.length > 0 && !piiConfirmed)}
          >
            {busy ? (
              <Loader2 aria-hidden="true" className="animate-spin" />
            ) : (
              <Send aria-hidden="true" />
            )}
            {busy ? "피드백 작성 중…" : "답변 제출"}
          </Button>
        </section>
      ) : (
        <p className="rounded-xl border border-dashed p-6 text-sm">
          모든 질문에 답했습니다. “면접 종료하고 리포트 받기”를 눌러 주세요.
        </p>
      )}
      {error ? <Alert variant="destructive">{error}</Alert> : null}

      {answeredCount > 0 ? (
        <details className="rounded-xl border p-4">
          <summary className="cursor-pointer font-medium">지난 답변 보기 ({answeredCount})</summary>
          <ol className="mt-3 grid gap-4">
            {turns
              .filter((t) => t.answered_at)
              .map((t) => (
                <li
                  key={t.id}
                  className="grid gap-2 border-t pt-3 text-sm first:border-0 first:pt-0"
                >
                  <p lang="ja" className="font-medium">
                    {t.kind === "followup" ? "↳ " : `Q${t.idx}. `}
                    {t.question}
                  </p>
                  <p lang="ja" className="whitespace-pre-wrap text-muted-foreground">
                    {t.answer}
                  </p>
                </li>
              ))}
          </ol>
        </details>
      ) : null}
    </div>
  );
}
