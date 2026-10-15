import type { ActivateParams, PaymentProvider, SubscriptionSummary } from "./provider";

/**
 * 토스페이먼츠 빌링(자동결제) 연동 자리.
 * 구현 시: 빌링키 발급(카드 등록 위젯) → 빌링키로 첫 결제 승인 → subscriptions 에 provider='toss',
 * provider_ref=빌링키 식별자 기록 → 매월 갱신 결제(스케줄러) → 웹훅으로 실패·해지 반영.
 * 실제 연동은 사업자 계약·키 발급 후 진행한다 (DECISIONS D56).
 */
export class TossPaymentProvider implements PaymentProvider {
  readonly name = "toss" as const;

  async activate(_params: ActivateParams): Promise<SubscriptionSummary> {
    throw new Error("TossPaymentProvider is not implemented yet");
  }

  async cancel(_params: { userId: string; actorId: string | null }): Promise<void> {
    throw new Error("TossPaymentProvider is not implemented yet");
  }
}
