import { Info } from "lucide-react";

import { cn } from "@/lib/utils";

export const AI_DISCLAIMER_TEXT = "AI가 생성한 코칭 결과이며, 최종 판단은 본인이 합니다.";

/** 모든 AI 결과 화면에 표시하는 고지 (PRD 4. 컴플라이언스) */
export function AiDisclaimer({ className }: { className?: string }) {
  return (
    <p
      className={cn("flex items-start gap-1.5 text-xs text-muted-foreground", className)}
      data-testid="ai-disclaimer"
    >
      <Info aria-hidden="true" className="mt-px size-3.5 shrink-0" />
      <span>{AI_DISCLAIMER_TEXT}</span>
    </p>
  );
}
