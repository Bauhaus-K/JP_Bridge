import { CalendarClock, ChevronRight, Pencil } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AiDisclaimer } from "@/components/ai/ai-disclaimer";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOnboarded } from "@/lib/auth/session";
import { getUpcomingItems } from "@/lib/checklist/queries";
import { dueLabel, dueStatus, todayKst } from "@/lib/checklist/schedule";
import { formatYearMonthKo, monthsUntil } from "@/lib/dates";
import { visibleFeatures } from "@/lib/features";
import { flags } from "@/lib/flags";
import { cn } from "@/lib/utils";
import { JLPT_OPTIONS, PERSONA_OPTIONS } from "@/lib/validation/onboarding";

export const metadata: Metadata = { title: "대시보드" };

function targetLabel(target: string | null) {
  if (!target) return null;
  const months = monthsUntil(target);
  if (months > 0) return `${months}개월 남음`;
  if (months === 0) return "이번 달";
  return "목표 시기 지남 — 프로필에서 수정하세요";
}

export default async function DashboardPage() {
  const { profile } = await requireOnboarded();
  const persona = PERSONA_OPTIONS.find((p) => p.value === profile.persona_type)?.label ?? "-";
  const jlpt = JLPT_OPTIONS.find((j) => j.value === profile.jlpt_level)?.label ?? "-";
  const features = visibleFeatures({ referral: flags.referral() }).filter(
    (f) => f.key !== "dashboard",
  );
  const upcoming = await getUpcomingItems();
  const today = todayKst();

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{profile.display_name}님, 안녕하세요</h1>
        <p className="mt-1 text-muted-foreground">오늘도 한 걸음씩 준비해 봐요.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-start justify-between">
            <div className="grid gap-1.5">
              <CardTitle as="h2">내 준비 현황</CardTitle>
              <CardDescription>{persona}</CardDescription>
            </div>
            <Link
              href="/onboarding"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
              aria-label="프로필 수정"
            >
              <Pencil aria-hidden="true" />
              수정
            </Link>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">일본어</dt>
              <dd>{jlpt}</dd>
              <dt className="text-muted-foreground">목표 입사</dt>
              <dd>
                {formatYearMonthKo(profile.target_start)}
                {profile.target_start ? (
                  <span className="ml-2 text-muted-foreground">
                    ({targetLabel(profile.target_start)})
                  </span>
                ) : null}
              </dd>
              <dt className="text-muted-foreground">희망 직종</dt>
              <dd className="flex flex-wrap gap-1">
                {profile.desired_roles.map((r) => (
                  <Badge key={r} variant="secondary">
                    {r}
                  </Badge>
                ))}
              </dd>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle as="h2" className="flex items-center gap-2">
              <CalendarClock aria-hidden="true" className="size-4" />
              마감 임박
            </CardTitle>
            <CardDescription>2주 안에 마감되는 일정·서류·비자 준비 항목</CardDescription>
          </CardHeader>
          <CardContent>
            {upcoming.length ? (
              <ul className="grid gap-2" data-testid="upcoming-items">
                {upcoming.map((item) => (
                  <li key={item.id} className="flex items-start justify-between gap-2 text-sm">
                    <span>{item.title}</span>
                    <Badge
                      variant={dueStatus(item, today) === "overdue" ? "default" : "warning"}
                      className="shrink-0"
                    >
                      {dueLabel(item.due_date, today)}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                2주 안에 마감되는 항목이 없습니다.
              </p>
            )}
            <Link
              href="/checklist"
              className="mt-3 inline-block text-sm text-primary underline-offset-4 hover:underline"
            >
              체크리스트 전체 보기
            </Link>
          </CardContent>
        </Card>
      </div>

      <section aria-labelledby="tools-heading" className="grid gap-3">
        <h2 id="tools-heading" className="text-lg font-semibold">
          코칭 도구
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => {
            const Icon = f.icon;
            const body = (
              <Card
                className={cn(
                  "h-full transition-colors",
                  f.available ? "hover:border-primary" : "opacity-70",
                )}
              >
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Icon aria-hidden="true" className="size-5 text-primary" />
                    <CardTitle className="text-base">{f.label}</CardTitle>
                    {f.available ? (
                      <ChevronRight
                        aria-hidden="true"
                        className="ml-auto size-4 text-muted-foreground"
                      />
                    ) : (
                      <Badge variant="outline" className="ml-auto">
                        준비 중
                      </Badge>
                    )}
                  </div>
                  <CardDescription>{f.description}</CardDescription>
                </CardHeader>
              </Card>
            );
            return (
              <li key={f.key}>
                {f.available ? (
                  <Link
                    href={f.href}
                    className="block h-full rounded-xl focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    {body}
                  </Link>
                ) : (
                  <div aria-disabled="true">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <AiDisclaimer />
    </div>
  );
}
