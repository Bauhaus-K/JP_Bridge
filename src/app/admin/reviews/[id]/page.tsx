import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { FeedbackView } from "@/components/interview/feedback-view";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { loadReviewTarget } from "@/lib/admin/reviews";
import { createClient } from "@/lib/db/server";
import { REVIEW_TARGET_LABEL } from "@/lib/email/templates";
import { JLPT_OPTIONS, PERSONA_OPTIONS } from "@/lib/validation/onboarding";
import { startReview } from "../actions";
import { CompleteReviewForm } from "./complete-review-form";

export const metadata: Metadata = { title: "검수" };

const STATUS = { pending: "대기", in_review: "검수 중", done: "완료", cancelled: "취소" } as const;

export default async function AdminReviewDetailPage({ params }: PageProps<"/admin/reviews/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: request } = await supabase
    .from("review_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!request) notFound();
  const [{ data: profile }, target] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", request.user_id).maybeSingle(),
    loadReviewTarget(request),
  ]);
  const open = request.status === "pending" || request.status === "in_review";

  return (
    <div className="grid gap-6">
      <Link
        href="/admin/reviews"
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        검수 큐
      </Link>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold">{REVIEW_TARGET_LABEL[request.target_type]} 검수</h1>
        <Badge variant={open ? "warning" : "secondary"}>{STATUS[request.status]}</Badge>
      </div>

      <section aria-label="요청 정보" className="grid gap-1 rounded-xl border bg-card p-4 text-sm">
        <p>
          <strong>{profile?.display_name ?? "이름 없음"}</strong> ·{" "}
          {PERSONA_OPTIONS.find((p) => p.value === profile?.persona_type)?.label ?? "-"} · JLPT{" "}
          {JLPT_OPTIONS.find((j) => j.value === profile?.jlpt_level)?.label ?? "-"}
        </p>
        <p className="text-muted-foreground">
          희망 직종: {profile?.desired_roles.join(", ") || "-"}
        </p>
        {request.user_note ? <p className="mt-2">요청 메모: “{request.user_note}”</p> : null}
        {request.status === "pending" ? (
          <form action={startReview} className="mt-2">
            <input type="hidden" name="id" value={request.id} />
            <Button type="submit" size="sm" variant="outline">
              검수 시작 (검수 중으로 표시)
            </Button>
          </form>
        ) : null}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="target-heading" className="grid content-start gap-3">
          <h2 id="target-heading" className="text-lg font-semibold">
            대상 내용
          </h2>
          {target.type === "missing" ? (
            <Alert variant="destructive">
              대상 콘텐츠를 찾을 수 없습니다 (사용자가 삭제했을 수 있습니다).
            </Alert>
          ) : target.type === "es_version" ? (
            <div className="grid gap-3 text-sm">
              <p>
                <strong>{target.doc.title}</strong> · {target.doc.company ?? "기업 미지정"} ·{" "}
                {target.doc.char_limit ? `${target.doc.char_limit}자 제한` : "제한 없음"}
              </p>
              {target.doc.question_text ? <p lang="ja">{target.doc.question_text}</p> : null}
              <p className="text-muted-foreground">
                v{target.version.version_no} · {target.version.char_count}자
              </p>
              <pre
                lang="ja"
                className="whitespace-pre-wrap rounded-lg border bg-card p-3 font-sans leading-7"
                data-testid="review-target"
              >
                {target.version.content}
              </pre>
              {target.aiReview ? (
                <details className="rounded-lg border p-3">
                  <summary className="cursor-pointer font-medium">AI 첨삭 결과 참고</summary>
                  <p className="mt-2">{target.aiReview.overallComment}</p>
                  <pre
                    lang="ja"
                    className="mt-2 whitespace-pre-wrap font-sans text-muted-foreground"
                  >
                    {target.aiReview.revisedText}
                  </pre>
                </details>
              ) : null}
            </div>
          ) : target.type === "career_translation" ? (
            <div className="grid gap-3 text-sm">
              <p className="font-medium">{target.title}</p>
              <pre
                lang="ja"
                className="whitespace-pre-wrap rounded-lg border bg-card p-3 font-sans leading-7"
                data-testid="review-target"
              >
                {target.text}
              </pre>
              <details className="rounded-lg border p-3">
                <summary className="cursor-pointer font-medium">원문 (한국어)</summary>
                <p className="mt-2 whitespace-pre-wrap">{target.input}</p>
              </details>
            </div>
          ) : (
            <div className="grid gap-3 text-sm" data-testid="review-target">
              <p>
                {target.session.company ?? "기업 미지정"} · {target.session.job_role} ·{" "}
                {target.session.stage === "first" ? "1차" : "최종"}
              </p>
              {target.summary ? (
                <p className="rounded-lg bg-muted/50 p-3">{target.summary.overall_ko}</p>
              ) : null}
              <ol className="grid gap-4">
                {target.turns
                  .filter((t) => t.answer)
                  .map((t) => (
                    <li key={t.id} className="grid gap-2 rounded-lg border p-3">
                      <p lang="ja" className="font-medium">
                        {t.kind === "followup" ? "↳ " : `Q${t.idx}. `}
                        {t.question}
                      </p>
                      <p lang="ja" className="whitespace-pre-wrap">
                        {t.answer}
                      </p>
                      {t.feedbackParsed ? (
                        <details>
                          <summary className="cursor-pointer text-muted-foreground">
                            AI 피드백
                          </summary>
                          <div className="mt-2">
                            <FeedbackView feedback={t.feedbackParsed} />
                          </div>
                        </details>
                      ) : null}
                    </li>
                  ))}
              </ol>
            </div>
          )}
        </section>

        <section aria-labelledby="result-heading" className="grid content-start gap-3">
          <h2 id="result-heading" className="text-lg font-semibold">
            검수 결과
          </h2>
          {open ? (
            <CompleteReviewForm
              id={request.id}
              allowRevision={target.type === "es_version"}
              initialText={target.type === "es_version" ? target.version.content : ""}
            />
          ) : (
            <div className="grid gap-2 rounded-xl border bg-card p-4 text-sm">
              <p className="whitespace-pre-wrap">{request.admin_comment ?? "-"}</p>
              <p className="text-muted-foreground">
                {request.notified_at ? "사용자에게 이메일로 알렸습니다." : "알림 이메일 미발송"}
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
