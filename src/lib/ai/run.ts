import "server-only";

import type { z } from "zod";

import { createAdminClient } from "@/lib/db/admin";
import { createClient } from "@/lib/db/server";
import { getAnthropic } from "./client";
import { AiError } from "./errors";
import { createAiRunner, type StructuredRequest, type StructuredResult } from "./runner";

/**
 * 요청 사용자 기준으로 AI 구조화 호출을 실행한다.
 * - 한도 소비: 사용자 세션으로 consume_ai_quota RPC
 * - 실패 시 환불·실행 로그: service_role (사용자는 ai_runs 에 쓸 수 없다)
 */
export async function runStructuredForUser<S extends z.ZodType>(
  userId: string,
  req: StructuredRequest<S>,
): Promise<StructuredResult<z.infer<S>>> {
  const supabase = await createClient();
  const admin = createAdminClient();

  const runner = createAiRunner({
    client: getAnthropic(),
    consumeQuota: async () => {
      const { data, error } = await supabase.rpc("consume_ai_quota");
      if (error || !data) throw new AiError("unknown", error?.message);
      return data;
    },
    refundQuota: async () => {
      const { error } = await admin.rpc("refund_ai_quota", { p_user: userId });
      if (error) console.error("[ai] 사용량 환불 실패", error.message);
    },
    logRun: async (log) => {
      const { error } = await admin.from("ai_runs").insert({ ...log, user_id: userId });
      if (error) console.error("[ai] 실행 로그 기록 실패", error.message);
    },
  });

  return runner(req);
}
