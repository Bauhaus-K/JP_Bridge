/**
 * 결제 제공자 인터페이스 (M8).
 * MVP 는 운영자가 수동으로 활성화하는 ManualPaymentProvider 를 쓴다.
 * 토스페이먼츠 빌링 연동 시 TossPaymentProvider 를 구현해 교체한다 (호출부 변경 없음).
 */
export type PaidPlanCode = "pro";

export type ActivateParams = {
  userId: string;
  planCode: PaidPlanCode;
  months: number;
  /** 수동 활성화한 운영자 */
  actorId: string | null;
  /** 결제사 거래·빌링키 참조 (수동은 null) */
  providerRef?: string | null;
};

export type SubscriptionSummary = {
  planCode: string;
  status: "active" | "cancelled" | "expired";
  periodEnd: string | null;
  provider: "manual" | "toss";
};

export interface PaymentProvider {
  readonly name: "manual" | "toss";
  /** 유료 플랜 시작 또는 연장. 활성 구독이 있으면 남은 기간에 이어 붙인다. */
  activate(params: ActivateParams): Promise<SubscriptionSummary>;
  /** 즉시 해지 (환불은 범위 밖) */
  cancel(params: { userId: string; actorId: string | null }): Promise<void>;
}

/** 연장 시작 시점: 아직 남은 기간이 있으면 그 끝에서, 아니면 지금부터 */
export function extendPeriod(
  currentEnd: string | null,
  months: number,
  now: Date = new Date(),
): string {
  const base = currentEnd && new Date(currentEnd) > now ? new Date(currentEnd) : now;
  const end = new Date(base);
  end.setUTCMonth(end.getUTCMonth() + months);
  return end.toISOString();
}
