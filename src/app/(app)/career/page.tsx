import { Languages, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { QuotaBadge } from "@/components/es/quota-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/db/server";
import { getQuotaStatus } from "@/lib/es/queries";

export const metadata: Metadata = { title: "경력 번역" };

const fmt = new Intl.DateTimeFormat("ko-KR", {
  month: "numeric",
  day: "numeric",
  timeZone: "Asia/Seoul",
});

export default async function CareerListPage() {
  const supabase = await createClient();
  const [{ data: rows }, quota] = await Promise.all([
    supabase
      .from("career_translations")
      .select("id, title, updated_at")
      .order("updated_at", { ascending: false }),
    getQuotaStatus(),
  ]);
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-2">
          <h1 className="text-2xl font-semibold">경력 번역</h1>
          <p className="text-muted-foreground">
            한국식 경력 기술을 일본 職務経歴書 형식(職務要約・職務内容・活かせる経験・技術)으로 바꿔
            드립니다.
          </p>
          <QuotaBadge quota={quota} />
        </div>
        <Link href="/career/new" className={buttonVariants()}>
          <Plus aria-hidden="true" />새 변환
        </Link>
      </div>
      {!rows?.length ? (
        <Card className="border-dashed">
          <CardHeader className="items-center py-10 text-center">
            <Languages aria-hidden="true" className="size-8 text-muted-foreground" />
            <CardTitle as="h2">아직 변환한 경력이 없습니다</CardTitle>
            <CardDescription>이력서에 쓰던 경력 내용을 그대로 붙여 넣어도 됩니다.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <ul className="grid gap-2">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                href={`/career/${r.id}`}
                className="block rounded-lg border bg-card px-4 py-3 hover:border-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <span className="font-medium">{r.title}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {fmt.format(new Date(r.updated_at))}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
