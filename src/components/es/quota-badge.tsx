import { Gauge } from "lucide-react";

import type { QuotaStatus } from "@/lib/db/database.types";

export function QuotaBadge({ quota }: { quota: QuotaStatus | null }) {
  if (!quota) return null;
  const remaining = Math.max(quota.day_limit - quota.day_used, 0);
  return (
    <p className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
      <Gauge aria-hidden="true" className="size-3.5" />
      {quota.plan_name} · 오늘 AI {remaining}/{quota.day_limit}회 남음
    </p>
  );
}
