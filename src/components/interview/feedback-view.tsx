import { CheckCircle2 } from "lucide-react";

import type { InterviewFeedback } from "@/lib/ai/schemas/interview";

export function FeedbackView({ feedback }: { feedback: InterviewFeedback }) {
  return (
    <div className="grid gap-4 text-sm" data-testid="interview-feedback">
      {feedback.good_points_ko.length ? (
        <div className="grid gap-1">
          <h4 className="font-semibold">잘한 점</h4>
          <ul className="grid gap-1">
            {feedback.good_points_ko.map((g, i) => (
              <li key={i} className="flex gap-1.5">
                <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
                {g}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <dl className="grid gap-3">
        <div>
          <dt className="font-semibold">내용</dt>
          <dd className="text-muted-foreground">{feedback.content_ko}</dd>
        </div>
        <div>
          <dt className="font-semibold">경어·표현</dt>
          <dd className="text-muted-foreground">{feedback.keigo_ko}</dd>
        </div>
        <div>
          <dt className="font-semibold">논리</dt>
          <dd className="text-muted-foreground">{feedback.logic_ko}</dd>
        </div>
      </dl>
      {feedback.keigo_fixes.length ? (
        <div className="grid gap-2">
          <h4 className="font-semibold">표현 다듬기</h4>
          <ul className="grid gap-2">
            {feedback.keigo_fixes.map((f, i) => (
              <li key={i} className="rounded-md border p-2">
                <p lang="ja">
                  <del className="text-muted-foreground">{f.before_ja}</del> →{" "}
                  <ins className="no-underline">{f.after_ja}</ins>
                </p>
                <p className="text-muted-foreground">{f.note_ko}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="grid gap-1">
        <h4 className="font-semibold">개선 예시 답변</h4>
        <p lang="ja" className="whitespace-pre-wrap rounded-md bg-muted/50 p-3 leading-7">
          {feedback.improved_answer_ja}
        </p>
      </div>
    </div>
  );
}
