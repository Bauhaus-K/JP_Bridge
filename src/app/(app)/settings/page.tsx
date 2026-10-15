import { Check } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireOnboarded } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { getQuotaStatus } from "@/lib/es/queries";
import { flags } from "@/lib/flags";
import { cancelPlanRequest } from "./actions";
import { DeleteAccountForm, PrivacyForm, ProRequestForm } from "./settings-forms";

export const metadata: Metadata = { title: "설정" };

function UsageMeter({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(used / limit, 1) : 1;
  const tone = pct >= 1 ? "bg-destructive" : pct >= 0.8 ? "bg-warning-foreground" : "bg-primary";
  return (
    <div className="grid gap-1">
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {used} / {limit}
        </span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={used}
        className="h-2 overflow-hidden rounded-full bg-primary/15"
      >
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct * 100}%` }} />
      </div>
    </div>
  );
}

export default async function SettingsPage() {
  const { user, profile } = await requireOnboarded();
  const supabase = await createClient();
  const [quota, { data: plans }, { data: subscription }, { data: pendingRequest }] =
    await Promise.all([
      getQuotaStatus(),
      supabase.from("plans").select("*").order("sort_order"),
      supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle(),
      supabase
        .from("plan_requests")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "pending")
        .maybeSingle(),
    ]);
  const until = subscription?.period_end
    ? new Intl.DateTimeFormat("ko-KR", { dateStyle: "long", timeZone: "Asia/Seoul" }).format(
        new Date(subscription.period_end),
      )
    : null;

  return (
    <div className="grid max-w-3xl gap-8">
      <h1 className="text-2xl font-semibold">설정</h1>

      <section
        aria-labelledby="account-heading"
        className="grid gap-3 rounded-xl border bg-card p-4"
      >
        <h2 id="account-heading" className="font-semibold">
          계정
        </h2>
        <p className="text-sm">
          {profile.display_name} · {user.email}
        </p>
        <Link
          href="/onboarding"
          className="w-fit text-sm text-primary underline-offset-4 hover:underline"
        >
          프로필(준비 유형·목표 시기·희망 직종) 수정
        </Link>
        <PrivacyForm allowTrainingUse={profile.allow_training_use} />
      </section>

      <section
        aria-labelledby="plan-heading"
        className="grid gap-4 rounded-xl border bg-card p-4"
        data-testid="plan-section"
      >
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="plan-heading" className="font-semibold">
            플랜·사용량
          </h2>
          <Badge>{quota?.plan_name ?? "무료"}</Badge>
          {until ? <span className="text-sm text-muted-foreground">{until}까지</span> : null}
        </div>
        {quota ? (
          <div className="grid gap-3">
            <UsageMeter
              label="오늘 AI 코칭 (첨삭·번역·리포트)"
              used={quota.day_used}
              limit={quota.day_limit}
            />
            <UsageMeter
              label="오늘 대화형 코칭 (자기분석·면접)"
              used={quota.chat_used}
              limit={quota.chat_limit}
            />
            <UsageMeter
              label="이번 달 운영자 검수"
              used={quota.review_used}
              limit={quota.review_limit}
            />
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">플랜 비교</caption>
            <thead className="text-left text-muted-foreground">
              <tr>
                <th scope="col" className="py-2 pr-4 font-medium">
                  항목
                </th>
                {(plans ?? []).map((p) => (
                  <th key={p.code} scope="col" className="py-2 pr-4 font-medium">
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ["AI 코칭 / 일", (p: NonNullable<typeof plans>[number]) => `${p.daily_ai_limit}회`],
                [
                  "대화형 코칭 / 일",
                  (p: NonNullable<typeof plans>[number]) => `${p.daily_chat_limit}회`,
                ],
                [
                  "운영자 검수 / 월",
                  (p: NonNullable<typeof plans>[number]) => `${p.monthly_review_limit}회`,
                ],
                [
                  "요금",
                  (p: NonNullable<typeof plans>[number]) =>
                    p.price_krw ? `월 ${p.price_krw.toLocaleString("ko-KR")}원` : "무료",
                ],
              ].map(([label, fn]) => (
                <tr key={label as string} className="border-t">
                  <th scope="row" className="py-2 pr-4 text-left font-normal">
                    {label as string}
                  </th>
                  {(plans ?? []).map((p) => (
                    <td key={p.code} className="py-2 pr-4 tabular-nums">
                      {(fn as (p: NonNullable<typeof plans>[number]) => string)(p)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {quota?.plan === "pro" ? (
          <p className="flex items-center gap-1.5 text-sm">
            <Check aria-hidden="true" className="size-4 text-primary" />
            프로 플랜을 이용 중입니다.
          </p>
        ) : pendingRequest ? (
          <div className="grid gap-2 text-sm">
            <p>프로 플랜 신청이 접수되었습니다. 운영자가 결제 안내 후 활성화해 드립니다.</p>
            <form action={cancelPlanRequest}>
              <Button type="submit" size="sm" variant="ghost">
                신청 취소
              </Button>
            </form>
          </div>
        ) : (
          <ProRequestForm />
        )}
      </section>
      <section aria-labelledby="data-heading" className="grid gap-4 rounded-xl border bg-card p-4">
        <h2 id="data-heading" className="font-semibold">
          내 데이터
        </h2>
        <div className="grid gap-2">
          <p className="text-sm text-muted-foreground">
            서비스에 저장된 내 데이터 전체를 JSON 파일로 내려받을 수 있습니다.
          </p>
          <a
            href="/api/account/export"
            download
            className="w-fit text-sm text-primary underline-offset-4 hover:underline"
          >
            내 데이터 내보내기 (JSON)
          </a>
        </div>
        {flags.referral() ? (
          <Link
            href="/referrals"
            className="w-fit text-sm text-primary underline-offset-4 hover:underline"
          >
            제휴사 정보 제공 동의 관리
          </Link>
        ) : null}
        <div className="grid gap-2 border-t pt-4">
          <h3 className="font-medium text-destructive">계정 삭제</h3>
          <DeleteAccountForm />
        </div>
      </section>
    </div>
  );
}
