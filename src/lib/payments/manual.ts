import "server-only";

import { createAdminClient } from "@/lib/db/admin";
import {
  extendPeriod,
  type ActivateParams,
  type PaymentProvider,
  type SubscriptionSummary,
} from "./provider";

/** 운영자 수동 활성화 (subscriptions 는 service_role 로만 쓴다) */
export class ManualPaymentProvider implements PaymentProvider {
  readonly name = "manual" as const;

  async activate(params: ActivateParams): Promise<SubscriptionSummary> {
    if (!Number.isInteger(params.months) || params.months < 1 || params.months > 12) {
      throw new Error("months must be 1-12");
    }
    const admin = createAdminClient();
    const { data: current } = await admin
      .from("subscriptions")
      .select("*")
      .eq("user_id", params.userId)
      .eq("status", "active")
      .maybeSingle();

    const periodEnd = extendPeriod(
      current?.plan_code === params.planCode ? current.period_end : null,
      params.months,
    );
    if (current) {
      // 다른 플랜이거나 연장: 기존 활성 구독을 종료하고 새로 기록해 이력을 남긴다
      await admin.from("subscriptions").update({ status: "cancelled" }).eq("id", current.id);
    }
    const { data, error } = await admin
      .from("subscriptions")
      .insert({
        user_id: params.userId,
        plan_code: params.planCode,
        provider: "manual",
        provider_ref: params.providerRef ?? null,
        status: "active",
        period_start: new Date().toISOString(),
        period_end: periodEnd,
        activated_by: params.actorId,
      })
      .select("*")
      .single();
    if (error || !data) throw new Error(`subscription insert failed: ${error?.message}`);
    return {
      planCode: data.plan_code,
      status: data.status,
      periodEnd: data.period_end,
      provider: "manual",
    };
  }

  async cancel(params: { userId: string; actorId: string | null }): Promise<void> {
    const admin = createAdminClient();
    const { error } = await admin
      .from("subscriptions")
      .update({ status: "cancelled", period_end: new Date().toISOString() })
      .eq("user_id", params.userId)
      .eq("status", "active");
    if (error) throw new Error(`subscription cancel failed: ${error.message}`);
  }
}
