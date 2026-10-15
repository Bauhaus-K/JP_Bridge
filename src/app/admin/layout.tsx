import Link from "next/link";

import { Brand } from "@/components/layout/brand";
import { requireAdmin } from "@/lib/auth/session";

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
      </header>
      <main id="main" className="mx-auto max-w-6xl px-4 py-8">
        {children}
      </main>
    </div>
  );
}
