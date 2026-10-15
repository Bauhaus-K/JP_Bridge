import { ArrowDown, ArrowUp, Minus } from "lucide-react";

import { cn } from "@/lib/utils";

/** 라벨 · 값 · (선택) 직전 기간 대비 증감 */
export function StatTile({
  label,
  value,
  delta,
  deltaLabel,
  hint,
}: {
  label: string;
  value: string;
  delta?: { text: string; direction: "up" | "down" | "flat" };
  deltaLabel?: string;
  hint?: string;
}) {
  const Icon =
    delta?.direction === "up" ? ArrowUp : delta?.direction === "down" ? ArrowDown : Minus;
  return (
    <div className="grid gap-1 rounded-xl border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
      {delta ? (
        <p className={cn("flex items-center gap-1 text-xs text-muted-foreground")}>
          <Icon aria-hidden="true" className="size-3" />
          <span>
            {delta.text} {deltaLabel}
          </span>
        </p>
      ) : null}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
