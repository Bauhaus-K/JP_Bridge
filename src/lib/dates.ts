/** "YYYY-MM-DD" 를 로컬 타임존 영향 없이 연·월로 해석한다. */
function parseYearMonth(date: string): { y: number; m: number } {
  const [y, m] = date.split("-").map(Number);
  return { y, m };
}

/** 기준일(now)부터 목표 월까지 남은 개월 수. 같은 달이면 0, 지났으면 음수. */
export function monthsUntil(target: string, now: Date = new Date()): number {
  const { y, m } = parseYearMonth(target);
  return y * 12 + (m - 1) - (now.getFullYear() * 12 + now.getMonth());
}

/** "2027-04-01" → "2027년 4월" */
export function formatYearMonthKo(date: string | null | undefined): string {
  if (!date) return "-";
  const { y, m } = parseYearMonth(date);
  return `${y}년 ${m}월`;
}
