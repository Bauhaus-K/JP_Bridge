import type { ReferralOutcome } from "@/lib/db/database.types";

export const REFERRAL_STATUS_LABELS = {
  consented: "동의 완료 · 전달 대기",
  sent: "제휴사에 전달됨",
  revoked: "철회됨",
  closed: "종료",
} as const;

export const OUTCOME_LABELS: Record<ReferralOutcome, string> = {
  none: "아직 없음",
  interviewing: "면접 진행 중",
  offer: "내정(오퍼) 받음",
  hired: "입사 확정",
  declined: "불합격·사퇴",
};
