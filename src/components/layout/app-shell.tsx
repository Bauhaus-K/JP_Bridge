import { LogOut, Shield } from "lucide-react";
import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import { Brand } from "./brand";
import { BottomTabs, SidebarNav } from "./nav-links";

type AppShellProps = {
  displayName: string | null;
  isAdmin: boolean;
  children: React.ReactNode;
};

export function AppShell({ displayName, isAdmin, children }: AppShellProps) {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:shadow"
      >
        본문으로 건너뛰기
      </a>
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Brand href="/dashboard" />
          <div className="ml-auto flex items-center gap-1">
            {isAdmin ? (
              <Link
                href="/admin"
                aria-label="운영자 콘솔"
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                <Shield aria-hidden="true" />
                <span className="hidden sm:inline">운영자</span>
              </Link>
            ) : null}
            <span className="hidden max-w-40 truncate px-2 text-sm text-muted-foreground sm:inline">
              {displayName ? `${displayName}님` : null}
            </span>
            <form action="/auth/signout" method="post">
              <Button type="submit" variant="ghost" size="sm" aria-label="로그아웃">
                <LogOut aria-hidden="true" />
                <span className="hidden sm:inline">로그아웃</span>
              </Button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-6 px-4">
        <aside className="hidden w-56 shrink-0 py-6 md:block">
          <SidebarNav />
        </aside>
        <main id="main" tabIndex={-1} className="min-w-0 flex-1 py-6 pb-24 md:pb-10">
          {children}
        </main>
      </div>
      <BottomTabs />
      <footer className="hidden border-t py-4 text-center text-xs text-muted-foreground md:block">
        <Link href="/legal/ai-notice" className="underline-offset-4 hover:underline">
          AI 활용 안내
        </Link>
        {" · "}
        <Link href="/legal/privacy" className="underline-offset-4 hover:underline">
          개인정보처리방침
        </Link>
        {" · "}
        <Link href="/legal/terms" className="underline-offset-4 hover:underline">
          이용약관
        </Link>
      </footer>
    </div>
  );
}
