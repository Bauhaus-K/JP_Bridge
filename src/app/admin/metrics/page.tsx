import type { Metadata } from "next";

import { ColumnChart } from "@/components/charts/column-chart";
import { StatTile } from "@/components/charts/stat-tile";
import { createAdminClient } from "@/lib/db/admin";
import { compact, delta, percent, pivotFeatureUsage, satisfaction } from "@/lib/metrics";

export const metadata: Metadata = { title: "지표" };

/** MVP Go/No-go: 유료 전환 30명 */
const PAID_GOAL = 30;

const weekFmt = new Intl.DateTimeFormat("ko-KR", {
  month: "numeric",
  day: "numeric",
  timeZone: "Asia/Seoul",
});

export default async function AdminMetricsPage() {
  // 레이아웃의 requireAdmin 통과 후, 집계 함수는 service_role 로만 실행된다
  const admin = createAdminClient();
  const { data: m, error } = await admin.rpc("admin_metrics");
  if (error || !m) return <p className="text-destructive">지표를 불러오지 못했습니다.</p>;

  const weeks = m.weekly_signups.map((w) => ({
    label: weekFmt.format(new Date(w.week_start)),
    value: w.count,
  }));
  const last4 = m.weekly_signups.slice(-4).map((w) => w.week_start);
  const features = pivotFeatureUsage(m.feature_usage, last4);
  const maxFeature = Math.max(1, ...features.map((f) => f.total));
  const esBefore = satisfaction(m, "es_review", "before");
  const esAfter = satisfaction(m, "es_review", "after");
  const paidPct = Math.min(m.paid_active / PAID_GOAL, 1);

  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold">지표</h1>
        <p className="text-xs text-muted-foreground">
          {new Intl.DateTimeFormat("ko-KR", {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "Asia/Seoul",
          }).format(new Date(m.generated_at))}{" "}
          기준
        </p>
      </div>

      <section
        aria-labelledby="goal-heading"
        className="grid gap-3 rounded-xl border bg-card p-5"
        data-testid="paid-goal"
      >
        <h2 id="goal-heading" className="text-sm text-muted-foreground">
          유료 사용자 (MVP 목표 {PAID_GOAL}명)
        </h2>
        <p className="text-5xl font-semibold">{m.paid_active}</p>
        <div
          role="meter"
          aria-label="유료 전환 목표 달성률"
          aria-valuemin={0}
          aria-valuemax={PAID_GOAL}
          aria-valuenow={m.paid_active}
          className="h-2.5 overflow-hidden rounded-full bg-chart-track"
        >
          <div className="h-full rounded-full bg-chart-1" style={{ width: `${paidPct * 100}%` }} />
        </div>
        <p className="text-sm text-muted-foreground">
          목표의 {percent(m.paid_active, PAID_GOAL)} · 프로 신청 대기 {m.plan_requests_pending}건 ·
          온보딩 완료 대비 전환율 {percent(m.paid_active, m.onboarded_total)}
        </p>
      </section>

      <section aria-labelledby="kpi-heading" className="grid gap-3">
        <h2 id="kpi-heading" className="font-semibold">
          가입·활성
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="누적 가입"
            value={compact(m.signups_total)}
            delta={delta(m.signups_7d, m.signups_prev_7d)}
            deltaLabel="최근 7일 vs 직전 7일 신규"
          />
          <StatTile label="최근 7일 신규 가입" value={compact(m.signups_7d)} />
          <StatTile
            label="주간 활성 사용자"
            value={compact(m.wau)}
            hint="최근 7일 이벤트·AI 사용 기준"
          />
          <StatTile
            label="온보딩 완료"
            value={compact(m.onboarded_total)}
            hint={`가입 대비 ${percent(m.onboarded_total, m.signups_total)}`}
          />
        </div>
      </section>

      <ColumnChart title="주별 신규 가입 (최근 8주)" data={weeks} valueLabel="명" />

      <section aria-labelledby="usage-heading" className="grid gap-3">
        <h2 id="usage-heading" className="font-semibold">
          기능별 사용량 (성공한 AI 실행, 최근 4주)
        </h2>
        {features.length === 0 ? (
          <p className="text-sm text-muted-foreground">아직 사용 기록이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-sm" data-testid="feature-usage">
              <caption className="sr-only">기능별 주간 사용량</caption>
              <thead className="text-left text-muted-foreground">
                <tr className="border-b">
                  <th scope="col" className="px-4 py-2 font-medium">
                    기능
                  </th>
                  {last4.map((w) => (
                    <th key={w} scope="col" className="px-2 py-2 text-right font-medium">
                      {weekFmt.format(new Date(w))}~
                    </th>
                  ))}
                  <th scope="col" className="px-4 py-2 font-medium">
                    합계
                  </th>
                </tr>
              </thead>
              <tbody>
                {features.map((f) => (
                  <tr key={f.feature} className="border-b last:border-0">
                    <th scope="row" className="px-4 py-2 text-left font-normal">
                      {f.label}
                    </th>
                    {f.weeks.map((c, i) => (
                      <td key={i} className="px-2 py-2 text-right tabular-nums">
                        {c}
                      </td>
                    ))}
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2 w-28 overflow-hidden rounded-full bg-chart-track"
                          aria-hidden="true"
                        >
                          <div
                            className="h-full rounded-r-[4px] bg-chart-1"
                            style={{ width: `${(f.total / maxFeature) * 100}%` }}
                          />
                        </div>
                        <span className="tabular-nums">{f.total}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="sat-heading" className="grid gap-3">
        <h2 id="sat-heading" className="font-semibold">
          만족도·검수·리퍼럴
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="ES 초안 만족도 (첨삭 전)"
            value={esBefore ? `${esBefore.avg.toFixed(2)} / 5` : "-"}
            hint={esBefore ? `응답 ${esBefore.n}건` : "응답 없음"}
          />
          <StatTile
            label="ES 첨삭 만족도 (첨삭 후)"
            value={esAfter ? `${esAfter.avg.toFixed(2)} / 5` : "-"}
            hint={esAfter ? `응답 ${esAfter.n}건` : "응답 없음"}
          />
          <StatTile
            label="운영자 검수"
            value={`${m.reviews.pending + m.reviews.in_review}건 대기`}
            hint={`최근 30일 완료 ${m.reviews.done_30d}건`}
          />
          <StatTile
            label="리퍼럴 동의 / 전달"
            value={`${m.referrals.consented} / ${m.referrals.sent}`}
            hint={`철회 ${m.referrals.revoked} · 내정 보고 ${m.referrals.offers} (입사 ${m.referrals.hired})`}
          />
        </div>
      </section>
    </div>
  );
}
