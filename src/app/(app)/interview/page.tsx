import type { Metadata } from "next";
import Link from "next/link";

import { QuotaBadge } from "@/components/es/quota-badge";
import { Badge } from "@/components/ui/badge";
import { requireOnboarded } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { getQuotaStatus } from "@/lib/es/queries";
import { NewInterviewForm } from "./new-interview-form";

export const metadata: Metadata = { title: "모의면접" };

const fmt = new Intl.DateTimeFormat("ko-KR", {
  month: "numeric",
  day: "numeric",
  timeZone: "Asia/Seoul",
});
const STAGE = { first: "1차 면접", final: "최종 면접" } as const;
const STATUS = { active: "진행 중", completed: "완료", abandoned: "중단" } as const;

export default async function InterviewListPage() {
  const { profile } = await requireOnboarded();
  const supabase = await createClient();
  const [{ data: sessions }, quota] = await Promise.all([
    supabase
      .from("interview_sessions")
      .select("id, company, job_role, stage, status, question_count, created_at")
      .order("created_at", { ascending: false }),
    getQuotaStatus(),
  ]);

  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold">모의면접</h1>
        <p className="text-muted-foreground">
          일본식 면접 질문에 일본어로 답하고, 내용·경어·논리 피드백과 꼬리질문으로 연습하세요.
          점수나 합격 판정은 하지 않습니다.
        </p>
        <QuotaBadge quota={quota} kind="chat" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
        <section
          aria-labelledby="new-heading"
          className="grid content-start gap-3 rounded-xl border bg-card p-4"
        >
          <h2 id="new-heading" className="font-semibold">
            새 면접 시작
          </h2>
          <NewInterviewForm defaultRole={profile.desired_roles[0] ?? ""} />
        </section>
        <section aria-labelledby="history-heading" className="grid content-start gap-3">
          <h2 id="history-heading" className="font-semibold">
            면접 기록
          </h2>
          {!sessions?.length ? (
            <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
              아직 면접 기록이 없습니다.
            </p>
          ) : (
            <ul className="grid gap-2">
              {sessions.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/interview/${s.id}`}
                    className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-4 py-3 hover:border-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <span className="font-medium">{s.company ?? "기업 미지정"}</span>
                    <span className="text-sm text-muted-foreground">{s.job_role}</span>
                    <Badge variant="outline">{STAGE[s.stage]}</Badge>
                    <Badge variant={s.status === "completed" ? "default" : "secondary"}>
                      {STATUS[s.status]}
                    </Badge>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {fmt.format(new Date(s.created_at))}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
