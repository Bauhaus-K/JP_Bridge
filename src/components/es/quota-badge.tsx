import { Gauge } from "lucide-react";

import type { QuotaStatus } from "@/lib/db/database.types";

export function QuotaBadge({
  quota,
  kind = "ai",
}: {
  quota: QuotaStatus | null;
  kind?: "ai" | "chat";
}) {
  if (!quota) return null;
  const limit = kind === "ai" ? quota.day_limit : quota.chat_limit;
  const used = kind === "ai" ? quota.day_used : quota.chat_used;
  const remaining = Math.max(limit - used, 0);
  return (
    <p className="inline-flex w-fit items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
      <Gauge aria-hidden="true" className="size-3.5" />
      {quota.plan_name} · 오늘 {kind === "ai" ? "AI" : "대화"} {remaining}/{limit}회 남음
    </p>
  );
}
