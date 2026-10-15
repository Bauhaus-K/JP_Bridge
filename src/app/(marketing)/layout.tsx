import Link from "next/link";

import { Brand } from "@/components/layout/brand";
import { buttonVariants } from "@/components/ui/button";

export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b bg-card/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center px-4">
          <Brand />
          <Link href="/login" className={buttonVariants({ size: "sm", className: "ml-auto" })}>
            로그인 / 시작하기
          </Link>
        </div>
      </header>
      <main id="main" className="flex-1">
        {children}
      </main>
      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        <nav aria-label="법적 고지" className="flex justify-center gap-4">
          <Link href="/legal/ai-notice" className="hover:underline">
            AI 활용 안내
          </Link>
          <Link href="/legal/privacy" className="hover:underline">
            개인정보처리방침
          </Link>
          <Link href="/legal/terms" className="hover:underline">
            이용약관
          </Link>
        </nav>
        <p className="mt-2">© JP Bridge</p>
      </footer>
    </div>
  );
}
