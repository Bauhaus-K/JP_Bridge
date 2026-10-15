import "server-only";

import type { ChecklistItem } from "@/lib/db/database.types";
import { createClient } from "@/lib/db/server";
import { dueStatus, todayKst } from "./schedule";

export async function getActiveChecklist() {
  const supabase = await createClient();
  const { data: checklist } = await supabase
    .from("checklists")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!checklist) return null;
  const { data: items } = await supabase
    .from("checklist_items")
    .select("*")
    .eq("checklist_id", checklist.id)
    .order("sort_order", { ascending: true });
  return { checklist, items: items ?? [] };
}

/** 대시보드용: 지났거나 14일 이내 마감인 미완료 항목 */
export async function getUpcomingItems(limit = 5): Promise<ChecklistItem[]> {
  const data = await getActiveChecklist();
  if (!data) return [];
  const today = todayKst();
  return data.items
    .filter((i) => {
      const s = dueStatus(i, today);
      return s === "overdue" || s === "soon";
    })
    .slice(0, limit);
}
