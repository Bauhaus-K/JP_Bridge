import Link from "next/link";

import { AdminNav } from "@/components/layout/admin-nav";
import { Brand } from "@/components/layout/brand";
import { requireAdmin } from "@/lib/auth/session";

const NAV = [
  { href: "/admin", label: "개요" },
  { href: "/admin/reviews", label: "검수 큐" },
  { href: "/admin/users", label: "사용자·플랜" },
  { href: "/admin/metrics", label: "지표" },
];

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin();
  return (
    <div className="min-h-dvh">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <Brand href="/admin" />
          <span className="rounded bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
            운영자
          </span>
          <Link href="/dashboard" className="ml-auto text-sm text-muted-foreground hover:underline">
            사용자 화면으로
          </Link>
        </div>
        <div className="mx-auto max-w-6xl px-4 pb-2">
          <AdminNav items={NAV} />
        </div>
      </header>
      <main id="main" className="mx-auto max-w-6xl px-4 py-8">
        {children}
      </main>
    </div>
  );
}
