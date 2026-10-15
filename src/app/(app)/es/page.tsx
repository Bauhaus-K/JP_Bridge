import { FileText, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { QuotaBadge } from "@/components/es/quota-badge";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getQuotaStatus, listEsDocuments } from "@/lib/es/queries";
import { QUESTION_TYPE_OPTIONS } from "@/lib/validation/es";

export const metadata: Metadata = { title: "ES 첨삭" };

const fmt = new Intl.DateTimeFormat("ko-KR", {
  month: "numeric",
  day: "numeric",
  timeZone: "Asia/Seoul",
});

export default async function EsListPage() {
  const [docs, quota] = await Promise.all([listEsDocuments(), getQuotaStatus()]);
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-2">
          <h1 className="text-2xl font-semibold">ES 첨삭</h1>
          <p className="text-muted-foreground">
            自己PR・ガクチカ・志望動機를 작성하고 AI 첨삭을 받아 보세요.
          </p>
          <QuotaBadge quota={quota} />
        </div>
        <Link href="/es/new" className={buttonVariants()}>
          <Plus aria-hidden="true" />새 ES 만들기
        </Link>
      </div>

      {docs.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader className="items-center py-10 text-center">
            <FileText aria-hidden="true" className="size-8 text-muted-foreground" />
            <CardTitle as="h2">아직 작성한 ES가 없습니다</CardTitle>
            <CardDescription>
              기업과 문항을 정하고 첫 초안을 써 보세요. 한국어 메모로 시작해도 괜찮아요.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {docs.map((d) => (
            <li key={d.id}>
              <Link
                href={`/es/${d.id}`}
                className="block h-full rounded-xl focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <Card className="h-full transition-colors hover:border-primary">
                  <CardHeader>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">
                        {QUESTION_TYPE_OPTIONS.find((q) => q.value === d.question_type)?.label}
                      </Badge>
                      {d.char_limit ? <Badge variant="outline">{d.char_limit}자</Badge> : null}
                    </div>
                    <CardTitle as="h2" className="text-base">
                      {d.title}
                    </CardTitle>
                    <CardDescription>
                      {d.company ?? "기업 미지정"} · {fmt.format(new Date(d.updated_at))} 수정
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
