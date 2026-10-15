"use client";

import { Send } from "lucide-react";
import { useState, useTransition } from "react";

import { FeedbackView } from "@/components/interview/feedback-view";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { InterviewFeedback, InterviewSummary } from "@/lib/ai/schemas/interview";
import type { InterviewTurn } from "@/lib/db/database.types";
import { requestInterviewReview } from "../actions";

function List({ title, items, lang }: { title: string; items: string[]; lang?: string }) {
  if (!items.length) return null;
  return (
    <div className="grid gap-1">
      <h3 className="font-semibold">{title}</h3>
      <ul className="list-disc space-y-1 pl-5" lang={lang}>
        {items.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ul>
    </div>
  );
}

export function InterviewReport({
  sessionId,
  summary,
  turns,
  review,
}: {
  sessionId: string;
  summary: InterviewSummary;
  turns: InterviewTurn[];
  review: { open: boolean; adminComment: string | null; remaining: number };
}) {
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
      <section
        aria-labelledby="report-heading"
        className="grid content-start gap-5 rounded-xl border bg-card p-4 text-sm"
        data-testid="interview-report"
      >
        <h2 id="report-heading" className="text-lg font-semibold">
          면접 리포트
        </h2>
        <p className="leading-6">{summary.overall_ko}</p>
        <List title="강점" items={summary.strengths_ko} />
        <List title="개선할 점" items={summary.improvements_ko} />
        {summary.keigo_patterns.length ? (
          <div className="grid gap-1">
            <h3 className="font-semibold">반복된 표현 실수</h3>
            <ul className="grid gap-2">
              {summary.keigo_patterns.map((p, i) => (
                <li key={i} className="rounded-md border p-2">
                  <p lang="ja">
                    <del className="text-muted-foreground">{p.wrong_ja}</del> → {p.right_ja}
                  </p>
                  <p className="text-muted-foreground">{p.note_ko}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <List title="연습 방법" items={summary.practice_tips_ko} />
        <List title="다음에 연습할 질문" items={summary.next_questions_ja} lang="ja" />

        <details className="rounded-lg border p-3">
          <summary className="cursor-pointer font-medium">문항별 답변과 피드백</summary>
          <ol className="mt-3 grid gap-5">
            {turns
              .filter((t) => t.answered_at)
              .map((t) => (
                <li key={t.id} className="grid gap-2 border-t pt-3 first:border-0 first:pt-0">
                  <p lang="ja" className="font-medium">
                    {t.kind === "followup" ? "↳ " : `Q${t.idx}. `}
                    {t.question}
                  </p>
                  <p lang="ja" className="whitespace-pre-wrap text-muted-foreground">
                    {t.answer}
                  </p>
                  {t.feedback ? <FeedbackView feedback={t.feedback as InterviewFeedback} /> : null}
                </li>
              ))}
          </ol>
        </details>
      </section>
      <aside className="grid content-start gap-3">
        {review.adminComment ? (
          <Alert variant="info">
            <p className="font-medium">운영자 검수 코멘트</p>
            <p className="mt-1 whitespace-pre-wrap">{review.adminComment}</p>
          </Alert>
        ) : null}
        <div className="grid gap-2 rounded-xl border bg-card p-4 text-sm">
          <h2 className="font-semibold">운영자 검수</h2>
          {review.open ? (
            <p className="text-muted-foreground">검수 대기 중입니다.</p>
          ) : (
            <>
              <p className="text-muted-foreground">이번 달 남은 요청: {review.remaining}회</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-fit"
                disabled={pending || review.remaining <= 0}
                onClick={() =>
                  start(async () => setNotice((await requestInterviewReview(sessionId)).message))
                }
              >
                <Send aria-hidden="true" />
                검수 요청
              </Button>
            </>
          )}
          {notice ? <p aria-live="polite">{notice}</p> : null}
        </div>
      </aside>
    </div>
  );
}
