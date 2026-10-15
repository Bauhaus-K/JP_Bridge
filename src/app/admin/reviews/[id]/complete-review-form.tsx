"use client";

import { useActionState, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { controlClass } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { countChars } from "@/lib/text/char-count";
import { cn } from "@/lib/utils";
import { completeReview, type CompleteReviewState } from "../actions";

export function CompleteReviewForm({
  id,
  allowRevision,
  initialText,
}: {
  id: string;
  allowRevision: boolean;
  initialText: string;
}) {
  const [state, action] = useActionState<CompleteReviewState, FormData>(completeReview, {});
  const [text, setText] = useState(initialText);
  return (
    <form action={action} className="grid gap-4 rounded-xl border bg-card p-4">
      <input type="hidden" name="id" value={id} />
      <div className="grid gap-1.5">
        <label htmlFor="admin-comment" className="text-sm font-medium">
          검수 코멘트 (사용자에게 표시)
          <span aria-hidden="true" className="text-destructive">
            *
          </span>
        </label>
        <textarea
          id="admin-comment"
          name="comment"
          rows={8}
          required
          maxLength={5000}
          className={cn(controlClass, "py-2")}
        />
      </div>
      {allowRevision ? (
        <div className="grid gap-1.5">
          <label htmlFor="admin-revision" className="text-sm font-medium">
            운영자 수정본 (선택 · 바꾸면 새 버전으로 저장)
          </label>
          <textarea
            id="admin-revision"
            name="revisedText"
            lang="ja"
            rows={10}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className={cn(controlClass, "py-2 leading-7")}
          />
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {countChars(text)}자
          </p>
        </div>
      ) : null}
      {state.message ? <Alert variant="destructive">{state.message}</Alert> : null}
      <SubmitButton className="w-fit" pendingText="저장 중…">
        검수 완료 및 알림 발송
      </SubmitButton>
    </form>
  );
}
