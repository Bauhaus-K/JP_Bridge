import type { ChecklistTemplate } from "./templates";

/** "YYYY-MM-DD" 의 월에 n개월을 더한 달의 1일 (타임존 영향 없음) */
export function addMonths(date: string, months: number): string {
  const [y, m] = date.split("-").map(Number);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}-01`;
}

export function todayKst(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(now);
}

function dayNumber(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

export function daysUntil(due: string, today: string): number {
  return dayNumber(due) - dayNumber(today);
}

export type DueStatus = "done" | "overdue" | "soon" | "later";

/** 마감 임박 = 14일 이내 */
export function dueStatus(
  item: { due_date: string | null; done_at: string | null },
  today: string,
): DueStatus {
  if (item.done_at) return "done";
  if (!item.due_date) return "later";
  const d = daysUntil(item.due_date, today);
  if (d < 0) return "overdue";
  if (d <= 14) return "soon";
  return "later";
}

export function dueLabel(due: string | null, today: string): string {
  if (!due) return "";
  const d = daysUntil(due, today);
  if (d === 0) return "D-day";
  return d > 0 ? `D-${d}` : `${-d}일 지남`;
}

export function buildChecklistItems(template: ChecklistTemplate, targetStart: string) {
  return template.items
    .map((item) => ({
      template_item_id: item.id,
      category: item.category,
      title: item.title,
      description: item.description,
      due_date: addMonths(targetStart, item.offset_months),
    }))
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .map((item, i) => ({ ...item, sort_order: i }));
}
