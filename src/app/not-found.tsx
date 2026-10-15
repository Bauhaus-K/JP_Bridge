import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-sm font-medium text-primary">404</p>
      <h1 className="text-2xl font-semibold">페이지를 찾을 수 없습니다</h1>
      <p className="text-muted-foreground">주소가 바뀌었거나 접근 권한이 없는 페이지입니다.</p>
      <Link href="/" className={buttonVariants({ variant: "outline" })}>
        처음으로
      </Link>
    </main>
  );
}
