import { Layers, MessageCirclePlus, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { QuotaBadge } from "@/components/es/quota-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/db/server";
import { getQuotaStatus } from "@/lib/es/queries";
import { deleteConversation } from "./actions";

export const metadata: Metadata = { title: "자기분석" };

const fmt = new Intl.DateTimeFormat("ko-KR", {
  month: "numeric",
  day: "numeric",
  timeZone: "Asia/Seoul",
});

export default async function AnalysisPage() {
  const supabase = await createClient();
  const [{ data: conversations }, { count }, quota] = await Promise.all([
    supabase
      .from("analysis_conversations")
      .select("id, title, updated_at")
      .order("updated_at", { ascending: false }),
    supabase.from("episodes").select("id", { count: "exact", head: true }),
    getQuotaStatus(),
  ]);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-2">
          <h1 className="text-2xl font-semibold">자기분석</h1>
          <p className="text-muted-foreground">
            코치와 대화하며 경험을 꺼내고, 상황·과제·행동·결과 카드로 정리해 ES와 면접에 활용하세요.
          </p>
          <QuotaBadge quota={quota} kind="chat" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/analysis/episodes" className={buttonVariants({ variant: "outline" })}>
            <Layers aria-hidden="true" />내 에피소드 카드 ({count ?? 0})
          </Link>
          <Link href="/analysis/chat" className={buttonVariants()}>
            <MessageCirclePlus aria-hidden="true" />새 대화 시작
          </Link>
        </div>
      </div>

      <section aria-labelledby="conv-heading" className="grid gap-3">
        <h2 id="conv-heading" className="text-lg font-semibold">
          대화 기록
        </h2>
        {!conversations?.length ? (
          <Card className="border-dashed">
            <CardHeader className="py-8 text-center">
              <CardTitle as="h3">아직 대화가 없습니다</CardTitle>
              <CardDescription>
                “새 대화 시작”을 눌러 가장 기억에 남는 경험부터 이야기해 보세요.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <ul className="grid gap-2">
            {conversations.map((c) => (
              <li key={c.id} className="flex items-center gap-2 rounded-lg border bg-card">
                <Link
                  href={`/analysis/chat?c=${c.id}`}
                  className="min-w-0 flex-1 rounded-lg px-4 py-3 hover:bg-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <span className="block truncate font-medium">{c.title ?? "제목 없음"}</span>
                  <span className="text-xs text-muted-foreground">
                    {fmt.format(new Date(c.updated_at))}
                  </span>
                </Link>
                <form action={deleteConversation}>
                  <input type="hidden" name="id" value={c.id} />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="icon"
                    aria-label={`대화 삭제: ${c.title ?? ""}`}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
