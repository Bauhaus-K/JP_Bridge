import "server-only";

import { createAdminClient } from "@/lib/db/admin";
import { serverEnv } from "@/lib/env";
import { expectedRoleForEmail } from "./roles";

/**
 * 로그인 직후 ADMIN_EMAILS 기준으로 profiles.role 을 동기화한다.
 * role 컬럼은 DB 트리거로 service_role 만 변경할 수 있다.
 */
export async function syncAdminRole(userId: string, email: string | null): Promise<void> {
  const env = serverEnv();
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    if (env.ADMIN_EMAILS.length > 0) {
      console.warn("[auth] SUPABASE_SERVICE_ROLE_KEY 미설정 — 관리자 역할 동기화를 건너뜁니다.");
    }
    return;
  }
  const role = expectedRoleForEmail(email, env.ADMIN_EMAILS);
  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ role })
    .eq("user_id", userId)
    .neq("role", role);
  if (error) console.error("[auth] 역할 동기화 실패", error.message);
}
