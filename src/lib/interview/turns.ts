import type { InterviewTurn } from "@/lib/db/database.types";

/** 질문 순서: idx 오름차순, 같은 idx 에서는 본질문 → 꼬리질문 */
export function orderTurns<T extends Pick<InterviewTurn, "idx" | "kind" | "created_at">>(
  turns: T[],
): T[] {
  return [...turns].sort(
    (a, b) =>
      a.idx - b.idx ||
      (a.kind === b.kind ? 0 : a.kind === "question" ? -1 : 1) ||
      a.created_at.localeCompare(b.created_at),
  );
}

/** 아직 답하지 않은 첫 질문 */
export function nextOpenTurn<
  T extends Pick<InterviewTurn, "idx" | "kind" | "created_at" | "answered_at">,
>(turns: T[]): T | null {
  return orderTurns(turns).find((t) => !t.answered_at) ?? null;
}

export function interviewProgress(turns: Pick<InterviewTurn, "kind" | "answered_at">[]) {
  const main = turns.filter((t) => t.kind === "question");
  return { answered: main.filter((t) => t.answered_at).length, total: main.length };
}
