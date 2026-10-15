import { ArrowLeft, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AiDisclaimer } from "@/components/ai/ai-disclaimer";
import { Button } from "@/components/ui/button";
import { careerTranslationSchema, type CareerOutput } from "@/lib/ai/schemas/career";
import { careerToPlainText } from "@/lib/career/format";
import { createClient } from "@/lib/db/server";
import { getQuotaStatus } from "@/lib/es/queries";
import { deleteCareer } from "../actions";
import { CareerDetailClient } from "./career-detail-client";

export const metadata: Metadata = { title: "職務経歴書" };

export default async function CareerDetailPage({ params }: PageProps<"/career/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("career_translations")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!row) notFound();
  const parsed = careerTranslationSchema.safeParse(row.output);
  const output = parsed.success
    ? ({ ...parsed.data, ...(row.output as object) } as CareerOutput)
    : null;
  const [{ data: requests }, quota] = await Promise.all([
    supabase
      .from("review_requests")
      .select("*")
      .eq("target_type", "career_translation")
      .eq("target_id", row.id)
      .order("created_at", { ascending: false }),
    getQuotaStatus(),
  ]);
  const openRequest =
    requests?.find((r) => r.status === "pending" || r.status === "in_review") ?? null;
  const doneRequest = requests?.find((r) => r.status === "done") ?? null;

  return (
    <div className="grid gap-6">
      <Link
        href="/career"
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        경력 번역
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold">{row.title}</h1>
        <form action={deleteCareer}>
          <input type="hidden" name="id" value={row.id} />
          <Button type="submit" variant="ghost" size="sm" className="text-destructive">
            <Trash2 aria-hidden="true" />
            삭제
          </Button>
        </form>
      </div>
      <AiDisclaimer />
      {!output ? (
        <p className="text-muted-foreground">변환 결과를 표시할 수 없습니다.</p>
      ) : (
        <CareerDetailClient
          id={row.id}
          output={output}
          plainText={careerToPlainText(output)}
          input={row.input}
          openRequest={Boolean(openRequest)}
          adminComment={doneRequest?.admin_comment ?? null}
          reviewRemaining={quota ? Math.max(quota.review_limit - quota.review_used, 0) : 0}
        />
      )}
    </div>
  );
}
