import "server-only";

import { ManualPaymentProvider } from "./manual";
import type { PaymentProvider } from "./provider";

/** 현재 사용하는 결제 제공자. 토스 연동 후 환경변수로 전환한다. */
export function getPaymentProvider(): PaymentProvider {
  return new ManualPaymentProvider();
}
