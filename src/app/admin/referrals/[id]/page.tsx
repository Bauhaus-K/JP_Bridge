import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { createClient } from "@/lib/db/server";
import { OUTCOME_LABELS, REFERRAL_STATUS_LABELS } from "@/lib/referral/labels";
import { buildReferralPacket, packetToText } from "@/lib/referral/packet";
import { sendReferral, setReferralOutcome } from "../actions";

export const metadata: Metadata = { title: "리퍼럴 처리" };

const fmt = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Seoul",
});

export default async function AdminReferralDetailPage({
  params,
}: PageProps<"/admin/referrals/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: ref } = await supabase.from("referrals").select("*").eq("id", id).maybeSingle();
  if (!ref) notFound();
  const [{ data: partner }, { data: consents }] = await Promise.all([
    supabase.from("partners").select("*").eq("id", ref.partner_id).maybeSingle(),
    supabase.from("consents").select("*").eq("referral_id", ref.id).order("created_at"),
  ]);
  // 동의가 유효한 경우에만 전달 자료를 만든다
  const packet =
    ref.status === "consented" || ref.status === "sent"
      ? await buildReferralPacket(ref.user_id, ref.shared_items)
      : null;

  return (
    <div className="grid gap-6">
      <Link
        href="/admin/referrals"
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        리퍼럴
      </Link>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold">{partner?.name ?? "제휴사"} 전달</h1>
        <Badge>{REFERRAL_STATUS_LABELS[ref.status]}</Badge>
      </div>

      <section
        aria-labelledby="consent-log"
        className="grid gap-2 rounded-xl border bg-card p-4 text-sm"
      >
        <h2 id="consent-log" className="font-semibold">
          동의 기록 (변경 불가)
        </h2>
        <ul className="grid gap-1">
          {(consents ?? []).map((c) => (
            <li key={c.id} className="font-mono text-xs">
              {fmt.format(new Date(c.created_at))} · {c.kind === "grant" ? "동의" : "철회"} ·{" "}
              {c.text_version} · {c.text_hash.slice(0, 12)}… · 항목 {c.items.length}개
            </li>
          ))}
        </ul>
      </section>

      {packet ? (
        <section aria-labelledby="packet-heading" className="grid gap-2">
          <h2 id="packet-heading" className="font-semibold">
            전달 자료 (동의 항목만)
          </h2>
          <pre
            className="max-h-[28rem] overflow-auto whitespace-pre-wrap rounded-xl border bg-card p-4 font-sans text-sm leading-6"
            data-testid="packet"
          >
            {packetToText(packet)}
          </pre>
          {ref.status === "consented" ? (
            <form action={sendReferral}>
              <input type="hidden" name="id" value={ref.id} />
              <Button type="submit">{partner?.contact_email}로 전달 이메일 발송</Button>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">
              {ref.sent_at ? `${fmt.format(new Date(ref.sent_at))} 전달 완료` : null}
            </p>
          )}
        </section>
      ) : (
        <Alert variant="warning">동의가 철회되었거나 종료되어 전달 자료를 표시하지 않습니다.</Alert>
      )}

      <section
        aria-labelledby="outcome-heading"
        className="grid gap-2 rounded-xl border bg-card p-4 text-sm"
      >
        <h2 id="outcome-heading" className="font-semibold">
          결과
        </h2>
        <p className="text-muted-foreground">
          현재: {OUTCOME_LABELS[ref.outcome]}{" "}
          {ref.outcome_reported_by
            ? `(${ref.outcome_reported_by === "user" ? "사용자 보고" : "운영자 입력"})`
            : ""}
          {ref.outcome_note ? ` — ${ref.outcome_note}` : ""}
        </p>
        <form action={setReferralOutcome} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="id" value={ref.id} />
          <div className="grid gap-1">
            <label htmlFor="outcome" className="text-xs">
              결과
            </label>
            <Select id="outcome" name="outcome" defaultValue={ref.outcome} className="h-9 w-40">
              {Object.entries(OUTCOME_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-1">
            <label htmlFor="note" className="text-xs">
              메모
            </label>
            <input
              id="note"
              name="note"
              defaultValue={ref.outcome_note ?? ""}
              className="h-9 rounded-md border bg-card px-3"
            />
          </div>
          <Button type="submit" size="sm" variant="outline">
            저장
          </Button>
        </form>
      </section>
    </div>
  );
}
