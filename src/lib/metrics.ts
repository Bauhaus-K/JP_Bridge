import type { AdminMetrics } from "@/lib/db/database.types";

export const FEATURE_LABELS: Record<string, string> = {
  es_review: "ES 첨삭",
  analysis_chat: "자기분석 대화",
  analysis_extract: "카드 정리",
  career_translate: "경력 번역",
  interview_questions: "면접 질문",
  interview_feedback: "면접 피드백",
  interview_summary: "면접 리포트",
};

/** 1,284 / 12.9K 형식 */
export function compact(n: number): string {
  return new Intl.NumberFormat("ko-KR", {
    notation: n >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(n);
}

export function percent(numerator: number, denominator: number): string {
  if (!denominator) return "-";
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

/** 직전 기간 대비 증감 (부호 포함) */
export function delta(
  current: number,
  previous: number,
): { text: string; direction: "up" | "down" | "flat" } {
  const d = current - previous;
  return { text: `${d > 0 ? "+" : ""}${d}`, direction: d > 0 ? "up" : d < 0 ? "down" : "flat" };
}

export type FeatureRow = { feature: string; label: string; weeks: number[]; total: number };

/** feature × 주 집계를 최근 N주 열로 펼친다 (오래된 주 → 최신 주) */
export function pivotFeatureUsage(
  usage: AdminMetrics["feature_usage"],
  weekStarts: string[],
): FeatureRow[] {
  const keys = weekStarts.map((w) => new Date(w).getTime());
  const map = new Map<string, number[]>();
  for (const u of usage) {
    const idx = keys.indexOf(new Date(u.week_start).getTime());
    if (idx < 0) continue;
    const row = map.get(u.feature) ?? keys.map(() => 0);
    row[idx] += u.count;
    map.set(u.feature, row);
  }
  return Array.from(map.entries())
    .map(([feature, weeks]) => ({
      feature,
      label: FEATURE_LABELS[feature] ?? feature,
      weeks,
      total: weeks.reduce((a, b) => a + b, 0),
    }))
    .sort((a, b) => b.total - a.total);
}

export function satisfaction(metrics: AdminMetrics, feature: string, phase: "before" | "after") {
  return metrics.satisfaction.find((s) => s.feature === feature && s.phase === phase) ?? null;
}
