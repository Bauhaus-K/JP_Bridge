import { ArrowLeft, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AiDisclaimer } from "@/components/ai/ai-disclaimer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { interviewSummarySchema } from "@/lib/ai/schemas/interview";
import { createClient } from "@/lib/db/server";
import { getQuotaStatus } from "@/lib/es/queries";
import { orderTurns } from "@/lib/interview/turns";
import { deleteInterview } from "../actions";
import { InterviewReport } from "./interview-report";
import { InterviewRunner } from "./interview-runner";

export const metadata: Metadata = { title: "모의면접 진행" };

export default async function InterviewSessionPage({ params }: PageProps<"/interview/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: session }, { data: turns }] = await Promise.all([
    supabase.from("interview_sessions").select("*").eq("id", id).maybeSingle(),
    supabase.from("interview_turns").select("*").eq("session_id", id),
  ]);
  if (!session) notFound();
  const ordered = orderTurns(turns ?? []);
  const summary = interviewSummarySchema.safeParse(session.summary);

  let reviewInfo: { open: boolean; adminComment: string | null; remaining: number } | null = null;
  if (session.status === "completed") {
    const [{ data: requests }, quota] = await Promise.all([
      supabase
        .from("review_requests")
        .select("status, admin_comment")
        .eq("target_type", "interview_session")
        .eq("target_id", id),
      getQuotaStatus(),
    ]);
    reviewInfo = {
      open: Boolean(requests?.some((r) => r.status === "pending" || r.status === "in_review")),
      adminComment: requests?.find((r) => r.status === "done")?.admin_comment ?? null,
      remaining: quota ? Math.max(quota.review_limit - quota.review_used, 0) : 0,
    };
  }

  return (
    <div className="grid gap-6">
      <Link
        href="/interview"
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        모의면접
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1.5">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{session.stage === "first" ? "1차 면접" : "최종 면접"}</Badge>
            <Badge variant="secondary">{session.job_role}</Badge>
          </div>
          <h1 className="text-2xl font-semibold">{session.company ?? "모의면접"}</h1>
        </div>
        <form action={deleteInterview}>
          <input type="hidden" name="id" value={session.id} />
          <Button type="submit" variant="ghost" size="sm" className="text-destructive">
            <Trash2 aria-hidden="true" />
            삭제
          </Button>
        </form>
      </div>
      <AiDisclaimer />
      {session.status === "completed" && summary.success && reviewInfo ? (
        <InterviewReport
          sessionId={session.id}
          summary={summary.data}
          turns={ordered}
          review={reviewInfo}
        />
      ) : (
        <InterviewRunner
          sessionId={session.id}
          initialTurns={ordered}
          inputMode={session.input_mode}
        />
      )}
    </div>
  );
}
