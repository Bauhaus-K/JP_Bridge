"use client";

import { Button } from "@/components/ui/button";

export default function GlobalSegmentError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-xl font-semibold">문제가 발생했습니다</h1>
      <p className="text-muted-foreground">
        일시적인 오류일 수 있습니다. 잠시 후 다시 시도해 주세요. 문제가 계속되면 운영자에게
        알려주세요.
      </p>
      <Button onClick={reset}>다시 시도</Button>
    </main>
  );
}
