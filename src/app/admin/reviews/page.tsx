import type { Metadata } from "next";
import Link from "next/link";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import type { ReviewStatus } from "@/lib/db/database.types";
import { createClient } from "@/lib/db/server";
import { REVIEW_TARGET_LABEL } from "@/lib/email/templates";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "검수 큐" };

const TABS: { status: ReviewStatus; label: string }[] = [
  { status: "pending", label: "대기" },
  { status: "in_review", label: "검수 중" },
  { status: "done", label: "완료" },
];

const fmt = new Intl.DateTimeFormat("ko-KR", {
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Seoul",
});

export default async function AdminReviewsPage({ searchParams }: PageProps<"/admin/reviews">) {
  const sp = await searchParams;
  const status = (TABS.find((t) => t.status === sp.status)?.status ?? "pending") as ReviewStatus;
  const supabase = await createClient();
  const { data: requests } = await supabase
    .from("review_requests")
    .select("*")
    .eq("status", status)
    .order("created_at", { ascending: status !== "done" })
    .limit(100);
  const userIds = Array.from(new Set((requests ?? []).map((r) => r.user_id)));
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("user_id, display_name").in("user_id", userIds)
    : { data: [] };
  const names = new Map((profiles ?? []).map((p) => [p.user_id, p.display_name]));

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">검수 큐</h1>
      {sp.done ? <Alert variant="info">검수를 완료하고 사용자에게 알렸습니다.</Alert> : null}
      <nav aria-label="상태" className="flex gap-1">
        {TABS.map((t) => (
          <Link
            key={t.status}
            href={`/admin/reviews?status=${t.status}`}
            aria-current={t.status === status ? "page" : undefined}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm",
              t.status === status ? "border-primary bg-accent font-medium" : "hover:bg-accent",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {!requests?.length ? (
        <p className="text-muted-foreground">해당 상태의 요청이 없습니다.</p>
      ) : (
        <ul className="grid gap-2">
          {requests.map((r) => (
            <li key={r.id}>
              <Link
                href={`/admin/reviews/${r.id}`}
                className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-4 py-3 hover:border-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <Badge variant="secondary">{REVIEW_TARGET_LABEL[r.target_type]}</Badge>
                <span className="font-medium">{names.get(r.user_id) ?? "이름 없음"}</span>
                {r.user_note ? (
                  <span className="truncate text-sm text-muted-foreground">“{r.user_note}”</span>
                ) : null}
                <span className="ml-auto text-xs text-muted-foreground">
                  {fmt.format(new Date(r.created_at))}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
