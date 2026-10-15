import { Building2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { requireOnboarded } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { flags } from "@/lib/flags";
import { COUNTRY_LABELS } from "@/lib/referral/items";
import { OUTCOME_LABELS, REFERRAL_STATUS_LABELS } from "@/lib/referral/labels";
import { reportOutcomeAction, revokeReferralAction } from "./actions";

export const metadata: Metadata = { title: "제휴사 연결" };

const fmt = new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeZone: "Asia/Seoul" });

export default async function ReferralsPage({ searchParams }: PageProps<"/referrals">) {
  if (!flags.referral()) notFound();
  await requireOnboarded();
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: partners }, { data: referrals }] = await Promise.all([
    supabase.from("partners").select("*").eq("active", true).order("name"),
    supabase.from("referrals").select("*").order("created_at", { ascending: false }),
  ]);
  const partnerName = new Map((partners ?? []).map((p) => [p.id, p.name]));
  const activePartnerIds = new Set(
    (referrals ?? [])
      .filter((r) => r.status === "consented" || r.status === "sent")
      .map((r) => r.partner_id),
  );

  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold">제휴사 연결</h1>
        <p className="text-muted-foreground">
          원하실 때만, 동의한 항목만 일본의 허가받은 인재소개회사(제휴사)에 전달합니다. 언제든
          철회할 수 있습니다. JP Bridge는 직업소개를 하지 않으며 채용 결과를 보장하지 않습니다.
        </p>
      </div>
      {sp.done ? (
        <Alert variant="info">
          동의를 기록했습니다. 운영자 확인 후 제휴사에 전달하고 이메일로 알려드립니다.
        </Alert>
      ) : null}

      <section aria-labelledby="mine-heading" className="grid gap-3">
        <h2 id="mine-heading" className="font-semibold">
          내 연결 내역
        </h2>
        {!referrals?.length ? (
          <p className="text-sm text-muted-foreground">아직 연결 내역이 없습니다.</p>
        ) : (
          <ul className="grid gap-3">
            {referrals.map((r) => {
              const active = r.status === "consented" || r.status === "sent";
              return (
                <li
                  key={r.id}
                  className="grid gap-3 rounded-xl border bg-card p-4 text-sm"
                  data-testid="referral-item"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{partnerName.get(r.partner_id) ?? "제휴사"}</span>
                    <Badge
                      variant={
                        r.status === "revoked"
                          ? "outline"
                          : r.status === "sent"
                            ? "default"
                            : "secondary"
                      }
                    >
                      {REFERRAL_STATUS_LABELS[r.status]}
                    </Badge>
                    <span className="ml-auto text-xs text-muted-foreground">
                      동의 {fmt.format(new Date(r.created_at))}
                    </span>
                  </div>
                  <p className="text-muted-foreground">
                    결과: {OUTCOME_LABELS[r.outcome]}
                    {r.outcome_note ? ` — ${r.outcome_note}` : ""}
                  </p>
                  {active ? (
                    <div className="flex flex-wrap items-end gap-3">
                      <form action={reportOutcomeAction} className="flex flex-wrap items-end gap-2">
                        <input type="hidden" name="referralId" value={r.id} />
                        <div className="grid gap-1">
                          <label
                            htmlFor={`outcome-${r.id}`}
                            className="text-xs text-muted-foreground"
                          >
                            진행 결과 알려주기
                          </label>
                          <Select
                            id={`outcome-${r.id}`}
                            name="outcome"
                            defaultValue={r.outcome}
                            className="h-9 w-40"
                          >
                            {Object.entries(OUTCOME_LABELS).map(([k, v]) => (
                              <option key={k} value={k}>
                                {v}
                              </option>
                            ))}
                          </Select>
                        </div>
                        <Button type="submit" size="sm" variant="outline">
                          결과 저장
                        </Button>
                      </form>
                      <form action={revokeReferralAction} className="ml-auto">
                        <input type="hidden" name="referralId" value={r.id} />
                        <Button
                          type="submit"
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                        >
                          동의 철회
                        </Button>
                      </form>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="partners-heading" className="grid gap-3">
        <h2 id="partners-heading" className="font-semibold">
          제휴사
        </h2>
        {!partners?.length ? (
          <p className="text-sm text-muted-foreground">현재 연결 가능한 제휴사가 없습니다.</p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {partners.map((p) => (
              <li key={p.id} className="grid gap-2 rounded-xl border bg-card p-4">
                <p className="flex items-center gap-2 font-medium">
                  <Building2 aria-hidden="true" className="size-4" />
                  {p.name}
                  <Badge variant="outline">{COUNTRY_LABELS[p.country] ?? p.country}</Badge>
                </p>
                {p.description ? (
                  <p className="text-sm text-muted-foreground">{p.description}</p>
                ) : null}
                {p.license_no ? (
                  <p className="text-xs text-muted-foreground">
                    유료직업소개 허가번호 {p.license_no}
                  </p>
                ) : null}
                {activePartnerIds.has(p.id) ? (
                  <p className="text-sm text-muted-foreground">이미 연결을 신청했습니다.</p>
                ) : (
                  <Link
                    href={`/referrals/new?partner=${p.id}`}
                    className={buttonVariants({ size: "sm", className: "w-fit" })}
                  >
                    연결 신청
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
