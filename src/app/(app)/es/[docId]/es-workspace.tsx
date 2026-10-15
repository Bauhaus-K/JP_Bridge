"use client";

import { AlertTriangle, Loader2, Save, Send, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";

import { CharCounter } from "@/components/es/char-counter";
import { ReviewResult } from "@/components/es/review-result";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { controlClass } from "@/components/ui/input";
import type { EsReviewEvent, EsReviewView } from "@/lib/es/types";
import { readNdjson } from "@/lib/ndjson";
import { detectPii, maskPii, piiSummary } from "@/lib/pii/detect";
import { countChars } from "@/lib/text/char-count";
import { cn } from "@/lib/utils";
import { rateEsReview, requestEsReview, saveEsVersion } from "../actions";

type Props = {
  docId: string;
  charLimit: number | null;
  questionLabel: string;
  baseVersionId: string | null;
  baseContent: string;
  review: EsReviewView | null;
  reviewRating: number | null;
  openReviewRequest: boolean;
  reviewRemaining: number;
  adminComment: string | null;
};

type Phase =
  | { kind: "idle" }
  | { kind: "reviewing"; outputChars: number; attempt: number }
  | { kind: "error"; message: string };

export function EsWorkspace(props: Props) {
  const router = useRouter();
  const [content, setContent] = useState(props.baseContent);
  const [parentId, setParentId] = useState<string | null>(props.baseVersionId);
  const [review, setReview] = useState<EsReviewView | null>(props.review);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [piiConfirmed, setPiiConfirmed] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [beforeRating, setBeforeRating] = useState<number | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [saving, startSaving] = useTransition();
  const [requesting, startRequesting] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const count = useMemo(() => countChars(content), [content]);
  const pii = useMemo(() => detectPii(content), [content]);
  const dirty =
    content.trimEnd() !== props.baseContent.trimEnd() || parentId !== props.baseVersionId;
  const busy = phase.kind === "reviewing" || saving;
  const piiBlocking = pii.length > 0 && !piiConfirmed;

  function goToVersion(versionId: string) {
    router.replace(`/es/${props.docId}?v=${versionId}`, { scroll: false });
  }

  function save() {
    setNotice(null);
    startSaving(async () => {
      const res = await saveEsVersion({
        docId: props.docId,
        content,
        parentVersionId: parentId,
        piiConfirmed,
      });
      if (!res.ok) {
        setPhase({ kind: "error", message: res.message });
        return;
      }
      setPhase({ kind: "idle" });
      setNotice(
        res.created
          ? "새 버전으로 저장했습니다."
          : "이미 저장된 버전과 내용이 같아 그 버전을 선택했습니다.",
      );
      goToVersion(res.versionId);
    });
  }

  async function runReview() {
    setNotice(null);
    setPhase({ kind: "reviewing", outputChars: 0, attempt: 1 });
    try {
      const res = await fetch("/api/ai/es-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          docId: props.docId,
          content,
          parentVersionId: parentId,
          beforeRating,
          piiConfirmed,
        }),
      });
      if (!res.body || !res.headers.get("content-type")?.includes("ndjson")) {
        const err = (await res.json().catch(() => null)) as EsReviewEvent | null;
        setPhase({
          kind: "error",
          message:
            err?.type === "error" ? err.message : "요청을 처리하지 못했습니다. 다시 시도해 주세요.",
        });
        return;
      }
      for await (const event of readNdjson<EsReviewEvent>(res.body)) {
        if (event.type === "progress") {
          setPhase({ kind: "reviewing", outputChars: event.outputChars, attempt: event.attempt });
        } else if (event.type === "result") {
          setReview(event.review);
          setPhase({ kind: "idle" });
          setBeforeRating(null);
          goToVersion(event.sourceVersionId);
        } else if (event.type === "error") {
          setPhase({ kind: "error", message: event.message });
        }
      }
    } catch {
      setPhase({
        kind: "error",
        message: "네트워크 오류로 첨삭 결과를 받지 못했습니다. 연결을 확인하고 다시 시도해 주세요.",
      });
    }
  }

  function applyRevised(text: string, aiVersionId: string) {
    setContent(text);
    setParentId(aiVersionId);
    setNotice("수정본을 에디터에 적용했습니다. 필요하면 다듬은 뒤 저장하세요.");
    textareaRef.current?.focus();
  }

  function requestReview() {
    if (!props.baseVersionId) return;
    startRequesting(async () => {
      const res = await requestEsReview({
        docId: props.docId,
        versionId: props.baseVersionId!,
        note: reviewNote || undefined,
      });
      if (res.ok) {
        setShowReviewForm(false);
        setNotice("운영자 검수를 요청했습니다. 검수가 끝나면 이메일로 알려드립니다.");
        router.refresh();
      } else {
        setNotice(res.message);
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section aria-labelledby="editor-heading" className="grid content-start gap-3">
        {props.adminComment ? (
          <Alert variant="info" data-testid="admin-comment">
            <p className="font-medium">운영자 검수 코멘트</p>
            <p className="mt-1 whitespace-pre-wrap">{props.adminComment}</p>
          </Alert>
        ) : null}
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="editor-heading" className="text-lg font-semibold">
            초안
          </h2>
          {dirty ? (
            <span className="text-xs text-warning-foreground">저장되지 않은 변경 사항</span>
          ) : null}
        </div>
        <Label htmlFor="es-content" className="sr-only">
          {props.questionLabel} 본문
        </Label>
        <textarea
          id="es-content"
          ref={textareaRef}
          lang="ja"
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            setPiiConfirmed(false);
          }}
          aria-describedby="es-count"
          rows={14}
          placeholder="私の強みは…（일본어로 작성하거나, 한국어 초안을 붙여 넣어도 됩니다）"
          className={cn(controlClass, "min-h-72 py-3 leading-7")}
          disabled={phase.kind === "reviewing"}
        />
        <CharCounter id="es-count" count={count} limit={props.charLimit} />

        {pii.length > 0 ? (
          <Alert variant="warning" className="grid gap-2">
            <p className="flex items-center gap-1.5 font-medium">
              <AlertTriangle aria-hidden="true" className="size-4" />
              {piiSummary(pii)}로 보이는 내용이 있습니다.
            </p>
            <p>민감한 개인정보는 입력하지 마세요. 마스킹하면 해당 부분이 ＊로 바뀝니다.</p>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setContent(maskPii(content, pii))}
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
                민감정보가 아닙니다 (계속 진행)
              </label>
            </div>
          </Alert>
        ) : null}

        <fieldset className="grid gap-1.5">
          <legend className="text-sm text-muted-foreground">
            (선택) 첨삭 전, 지금 초안에 대한 만족도
          </legend>
          <div className="flex flex-wrap gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <label
                key={n}
                className="cursor-pointer rounded-full border px-3 py-1 text-xs has-[:checked]:border-primary has-[:checked]:bg-accent has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50"
              >
                <input
                  type="radio"
                  name="beforeRating"
                  className="sr-only"
                  checked={beforeRating === n}
                  onChange={() => setBeforeRating(n)}
                />
                {n}점
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={runReview}
            disabled={busy || !content.trim() || piiBlocking}
          >
            {phase.kind === "reviewing" ? (
              <Loader2 aria-hidden="true" className="animate-spin" />
            ) : (
              <Sparkles aria-hidden="true" />
            )}
            AI 첨삭 받기
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={save}
            disabled={busy || !content.trim() || piiBlocking || !dirty}
          >
            <Save aria-hidden="true" />
            저장
          </Button>
          {props.baseVersionId && !dirty ? (
            props.openReviewRequest ? (
              <span className="self-center text-sm text-muted-foreground">
                이 버전은 운영자 검수 대기 중입니다.
              </span>
            ) : (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowReviewForm((v) => !v)}
                aria-expanded={showReviewForm}
              >
                <Send aria-hidden="true" />
                운영자 검수 요청
              </Button>
            )
          ) : null}
        </div>

        {showReviewForm ? (
          <div className="grid gap-2 rounded-lg border p-3">
            <Label htmlFor="review-note">운영자에게 전할 메모 (선택)</Label>
            <textarea
              id="review-note"
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              maxLength={1000}
              rows={3}
              className={cn(controlClass, "py-2")}
              placeholder="예: 지원 동기의 논리 흐름이 자연스러운지 봐주세요."
            />
            <p className="text-xs text-muted-foreground">
              이번 달 남은 검수 요청: {props.reviewRemaining}회. 현재 선택된 버전(저장된 내용)으로
              요청됩니다.
            </p>
            <div>
              <Button
                type="button"
                size="sm"
                onClick={requestReview}
                disabled={requesting || props.reviewRemaining <= 0}
              >
                {requesting ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
                요청하기
              </Button>
            </div>
          </div>
        ) : null}

        <div aria-live="polite" className="grid gap-2">
          {notice ? <p className="text-sm text-muted-foreground">{notice}</p> : null}
          {phase.kind === "error" ? <Alert variant="destructive">{phase.message}</Alert> : null}
        </div>
      </section>

      <div className="grid content-start gap-4 lg:border-l lg:pl-6">
        {phase.kind === "reviewing" ? (
          <div role="status" className="grid gap-2 rounded-lg border border-dashed p-6 text-sm">
            <p className="flex items-center gap-2 font-medium">
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              AI가 첨삭하고 있습니다…
            </p>
            <p className="text-muted-foreground">
              {phase.outputChars > 0 ? `결과 작성 중 (${phase.outputChars}자)` : "초안을 읽는 중"}
              {phase.attempt > 1 ? " · 형식을 다시 맞추는 중" : ""}
            </p>
            <p className="text-xs text-muted-foreground">보통 20~60초 정도 걸립니다.</p>
          </div>
        ) : review ? (
          <ReviewResult
            key={review.aiVersionId}
            review={review}
            charLimit={props.charLimit}
            initialRating={
              props.review?.aiVersionId === review.aiVersionId ? props.reviewRating : null
            }
            onApply={applyRevised}
            onRate={(rating) => rateEsReview({ aiVersionId: review.aiVersionId, rating })}
          />
        ) : (
          <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            초안을 작성하고 <strong className="text-foreground">AI 첨삭 받기</strong>를 누르면 종합
            코멘트, 항목별 점수, 수정본과 문장별 수정 이유가 여기에 표시됩니다.
          </div>
        )}
      </div>
    </div>
  );
}
