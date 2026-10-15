import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { createAdminClient } from "@/lib/db/admin";
import { createClient } from "@/lib/db/server";
import { PERSONA_OPTIONS } from "@/lib/validation/onboarding";
import { cn } from "@/lib/utils";
import { activatePro, cancelPro, rejectPlanRequest } from "./actions";

export const metadata: Metadata = { title: "사용자" };

const fmt = new Intl.DateTimeFormat("ko-KR", {
  year: "2-digit",
  month: "numeric",
  day: "numeric",
  timeZone: "Asia/Seoul",
});

export default async function AdminUsersPage({ searchParams }: PageProps<"/admin/users">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase() : "";
  const onlyRequests = sp.filter === "requests";
  const supabase = await createClient();
  const [{ data: profiles }, { data: subs }, { data: requests }] = await Promise.all([
    supabase
      .from("profiles")
      .select("user_id, display_name, persona_type, role, created_at")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase.from("subscriptions").select("user_id, plan_code, period_end").eq("status", "active"),
    supabase.from("plan_requests").select("user_id, message, created_at").eq("status", "pending"),
  ]);
  // 이메일은 auth 스키마에 있으므로 service_role 로 조회 (requireAdmin 은 레이아웃에서 확인됨)
  const admin = createAdminClient();
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const emails = new Map((list?.users ?? []).map((u) => [u.id, u.email ?? ""]));
  const subByUser = new Map((subs ?? []).map((s) => [s.user_id, s]));
  const reqByUser = new Map((requests ?? []).map((r) => [r.user_id, r]));
  const rows = (profiles ?? []).filter(
    (p) =>
      (!onlyRequests || reqByUser.has(p.user_id)) &&
      (!q ||
        (p.display_name ?? "").toLowerCase().includes(q) ||
        (emails.get(p.user_id) ?? "").includes(q)),
  );

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">사용자</h1>
      <div className="flex flex-wrap items-center gap-3">
        <form method="get" className="flex gap-2" role="search">
          <label htmlFor="user-q" className="sr-only">
            이름 또는 이메일 검색
          </label>
          <input
            id="user-q"
            name="q"
            defaultValue={q}
            placeholder="이름 또는 이메일"
            className="h-10 w-64 rounded-md border bg-card px-3"
          />
          {onlyRequests ? <input type="hidden" name="filter" value="requests" /> : null}
        </form>
        <nav aria-label="필터" className="flex gap-1 text-sm">
          <Link
            href="/admin/users"
            aria-current={!onlyRequests ? "page" : undefined}
            className={cn(
              "rounded-md border px-3 py-1.5",
              !onlyRequests && "border-primary bg-accent",
            )}
          >
            전체
          </Link>
          <Link
            href="/admin/users?filter=requests"
            aria-current={onlyRequests ? "page" : undefined}
            className={cn(
              "rounded-md border px-3 py-1.5",
              onlyRequests && "border-primary bg-accent",
            )}
          >
            프로 신청 ({requests?.length ?? 0})
          </Link>
        </nav>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <caption className="sr-only">사용자 목록</caption>
          <thead className="border-b text-left text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-2 font-medium">
                이름
              </th>
              <th scope="col" className="px-4 py-2 font-medium">
                이메일
              </th>
              <th scope="col" className="px-4 py-2 font-medium">
                유형
              </th>
              <th scope="col" className="px-4 py-2 font-medium">
                가입
              </th>
              <th scope="col" className="px-4 py-2 font-medium">
                플랜
              </th>
              <th scope="col" className="px-4 py-2 font-medium">
                플랜 관리
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const sub = subByUser.get(p.user_id);
              const req = reqByUser.get(p.user_id);
              const name = p.display_name ?? emails.get(p.user_id) ?? p.user_id;
              return (
                <tr
                  key={p.user_id}
                  className="border-b align-top last:border-0"
                  data-testid={`user-row-${emails.get(p.user_id)}`}
                >
                  <td className="px-4 py-2">
                    {p.display_name ?? <span className="text-muted-foreground">(온보딩 전)</span>}{" "}
                    {p.role === "admin" ? <Badge>admin</Badge> : null}
                  </td>
                  <td className="px-4 py-2">{emails.get(p.user_id)}</td>
                  <td className="px-4 py-2">
                    {PERSONA_OPTIONS.find((o) => o.value === p.persona_type)?.label.split(" ")[0] ??
                      "-"}
                  </td>
                  <td className="px-4 py-2 tabular-nums">{fmt.format(new Date(p.created_at))}</td>
                  <td className="px-4 py-2">
                    {sub ? (
                      <span className="grid gap-0.5">
                        <Badge className="w-fit">프로</Badge>
                        <span className="text-xs text-muted-foreground">
                          {sub.period_end
                            ? `${fmt.format(new Date(sub.period_end))}까지`
                            : "기한 없음"}
                        </span>
                      </span>
                    ) : (
                      <Badge variant="outline">무료</Badge>
                    )}
                    {req ? (
                      <span className="mt-1 grid gap-0.5">
                        <Badge variant="warning" className="w-fit">
                          프로 신청
                        </Badge>
                        {req.message ? (
                          <span className="text-xs text-muted-foreground">“{req.message}”</span>
                        ) : null}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap items-center gap-1">
                      <form action={activatePro} className="flex items-center gap-1">
                        <input type="hidden" name="userId" value={p.user_id} />
                        <label htmlFor={`months-${p.user_id}`} className="sr-only">
                          {name} 활성화 기간
                        </label>
                        <Select
                          id={`months-${p.user_id}`}
                          name="months"
                          defaultValue="1"
                          className="h-8 w-20 py-0 text-xs"
                        >
                          {[1, 3, 6, 12].map((m) => (
                            <option key={m} value={m}>
                              {m}개월
                            </option>
                          ))}
                        </Select>
                        <Button
                          type="submit"
                          size="sm"
                          variant="outline"
                          aria-label={`${name} 프로 ${sub ? "연장" : "활성화"}`}
                        >
                          {sub ? "연장" : "활성화"}
                        </Button>
                      </form>
                      {sub ? (
                        <form action={cancelPro}>
                          <input type="hidden" name="userId" value={p.user_id} />
                          <Button
                            type="submit"
                            size="sm"
                            variant="ghost"
                            aria-label={`${name} 프로 해지`}
                          >
                            해지
                          </Button>
                        </form>
                      ) : null}
                      {req ? (
                        <form action={rejectPlanRequest}>
                          <input type="hidden" name="userId" value={p.user_id} />
                          <Button
                            type="submit"
                            size="sm"
                            variant="ghost"
                            aria-label={`${name} 신청 반려`}
                          >
                            반려
                          </Button>
                        </form>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
