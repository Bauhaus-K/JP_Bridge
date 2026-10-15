import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/db/server";
import { OUTCOME_LABELS, REFERRAL_STATUS_LABELS } from "@/lib/referral/labels";

export const metadata: Metadata = { title: "리퍼럴" };

const fmt = new Intl.DateTimeFormat("ko-KR", {
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Seoul",
});

export default async function AdminReferralsPage() {
  const supabase = await createClient();
  const [{ data: refs }, { data: partners }, { data: profiles }] = await Promise.all([
    supabase.from("referrals").select("*").order("created_at", { ascending: false }).limit(200),
    supabase.from("partners").select("id, name"),
    supabase.from("profiles").select("user_id, display_name"),
  ]);
  const pName = new Map((partners ?? []).map((p) => [p.id, p.name]));
  const uName = new Map((profiles ?? []).map((p) => [p.user_id, p.display_name]));
  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">리퍼럴</h1>
      {!refs?.length ? (
        <p className="text-muted-foreground">리퍼럴이 없습니다.</p>
      ) : (
        <ul className="grid gap-2">
          {refs.map((r) => (
            <li key={r.id}>
              <Link
                href={`/admin/referrals/${r.id}`}
                className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-4 py-3 text-sm hover:border-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <span className="font-medium">{uName.get(r.user_id) ?? "사용자"}</span>→
                <span>{pName.get(r.partner_id) ?? "제휴사"}</span>
                <Badge variant={r.status === "consented" ? "warning" : "secondary"}>
                  {REFERRAL_STATUS_LABELS[r.status]}
                </Badge>
                {r.outcome !== "none" ? <Badge>{OUTCOME_LABELS[r.outcome]}</Badge> : null}
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
