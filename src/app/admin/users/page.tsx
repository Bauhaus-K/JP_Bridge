import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { createAdminClient } from "@/lib/db/admin";
import { createClient } from "@/lib/db/server";
import { PERSONA_OPTIONS } from "@/lib/validation/onboarding";

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
  const supabase = await createClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, display_name, persona_type, role, onboarded_at, created_at")
    .order("created_at", { ascending: false })
    .limit(500);
  // 이메일은 auth 스키마에 있으므로 service_role 로 조회 (requireAdmin 은 레이아웃에서 확인됨)
  const admin = createAdminClient();
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const emails = new Map((list?.users ?? []).map((u) => [u.id, u.email ?? ""]));
  const rows = (profiles ?? []).filter(
    (p) =>
      !q ||
      (p.display_name ?? "").toLowerCase().includes(q) ||
      (emails.get(p.user_id) ?? "").includes(q),
  );

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">사용자</h1>
      <form method="get" className="flex gap-2" role="search">
        <label htmlFor="user-q" className="sr-only">
          이름 또는 이메일 검색
        </label>
        <input
          id="user-q"
          name="q"
          defaultValue={q}
          placeholder="이름 또는 이메일"
          className="h-10 w-72 rounded-md border bg-card px-3"
        />
      </form>
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
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.user_id} className="border-b last:border-0">
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
