"use client";

import { diffChars } from "diff";
import { Check, Copy, HelpCircle, Wand2 } from "lucide-react";
import { useState } from "react";

import { AiDisclaimer } from "@/components/ai/ai-disclaimer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CATEGORY_LABELS } from "@/lib/ai/schemas/es-review";
import type { EsReviewView } from "@/lib/es/types";
import { CharCounter } from "./char-counter";
import { CharDiff } from "./char-diff";
import { Rating } from "./rating";
import { ScoreBars } from "./score-bars";

type Props = {
  review: EsReviewView;
  charLimit: number | null;
  initialRating: number | null;
  onApply: (text: string, aiVersionId: string) => void;
  onRate: (rating: number) => Promise<{ ok: boolean; message?: string }>;
};

export function ReviewResult({ review, charLimit, initialRating, onApply, onRate }: Props) {
  const [copied, setCopied] = useState(false);

  return (
    <section aria-labelledby="review-heading" className="grid gap-6" data-testid="review-result">
      <div className="grid gap-2">
        <h2 id="review-heading" className="text-lg font-semibold">
          AI 첨삭 결과
        </h2>
        <AiDisclaimer />
      </div>

      <div className="grid gap-2">
        <h3 className="text-sm font-semibold">종합 코멘트</h3>
        <p className="whitespace-pre-wrap text-sm leading-6">{review.overallComment}</p>
      </div>

      <div className="grid gap-2">
        <h3 className="text-sm font-semibold">항목별 점수</h3>
        <ScoreBars scores={review.scores} />
      </div>

      <div className="grid gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">수정본</h3>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={async () => {
                await navigator.clipboard?.writeText(review.revisedText).catch(() => undefined);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
              {copied ? "복사됨" : "복사"}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => onApply(review.revisedText, review.aiVersionId)}
            >
              <Wand2 aria-hidden="true" />
              에디터에 적용
            </Button>
          </div>
        </div>
        <div
          lang="ja"
          className="whitespace-pre-wrap rounded-lg border bg-muted/40 p-4 text-sm leading-7"
          data-testid="revised-text"
        >
          {review.revisedText}
        </div>
        <CharCounter count={review.revisedCharCount} limit={charLimit} />
      </div>

      {review.changes.length > 0 ? (
        <div className="grid gap-2">
          <h3 className="text-sm font-semibold">문장별 수정 이유</h3>
          <ol className="grid gap-3">
            {review.changes.map((c, i) => {
              const parts = diffChars(c.before_ja, c.after_ja);
              return (
                <li key={i} className="grid gap-2 rounded-lg border p-3 text-sm">
                  <Badge variant="secondary" className="w-fit">
                    {CATEGORY_LABELS[c.category]}
                  </Badge>
                  {c.before_ja ? (
                    <p lang="ja">
                      <span className="mr-2 text-xs text-destructive">전</span>
                      <CharDiff parts={parts} side="before" />
                    </p>
                  ) : null}
                  {c.after_ja ? (
                    <p lang="ja">
                      <span className="mr-2 text-xs text-primary">후</span>
                      <CharDiff parts={parts} side="after" />
                    </p>
                  ) : null}
                  <p className="text-muted-foreground">{c.reason_ko}</p>
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}

      {review.questions.length > 0 ? (
        <div className="grid gap-2 rounded-lg border border-accent bg-accent/40 p-4">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            <HelpCircle aria-hidden="true" className="size-4" />더 구체적으로 쓰려면 알려주세요
          </h3>
          <p className="text-xs text-muted-foreground">
            AI는 쓰지 않은 경험이나 수치를 지어내지 않습니다. 아래 질문에 답하는 내용을 초안에
            추가해 보세요.
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {review.questions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <Rating label="이 첨삭이 도움이 되었나요?" initial={initialRating} onRate={onRate} />
    </section>
  );
}
