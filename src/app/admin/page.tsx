import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/db/server";

export const metadata: Metadata = { title: "운영자 콘솔" };

export default async function AdminHomePage() {
  const supabase = await createClient();
  const [{ count: pending }, { count: inReview }, { count: users }] = await Promise.all([
    supabase
      .from("review_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("review_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "in_review"),
    supabase.from("profiles").select("user_id", { count: "exact", head: true }),
  ]);
  const cards = [
    {
      href: "/admin/reviews",
      title: "검수 대기",
      value: pending ?? 0,
      desc: `검수 중 ${inReview ?? 0}건`,
    },
    { href: "/admin/users", title: "가입자", value: users ?? 0, desc: "사용자 목록" },
  ];
  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">운영자 콘솔</h1>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <li key={c.href}>
            <Link
              href={c.href}
              className="block rounded-xl focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <Card className="hover:border-primary">
                <CardHeader>
                  <CardDescription>{c.title}</CardDescription>
                  <CardTitle as="h2" className="text-3xl tabular-nums">
                    {c.value}
                  </CardTitle>
                  <CardDescription>{c.desc}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
