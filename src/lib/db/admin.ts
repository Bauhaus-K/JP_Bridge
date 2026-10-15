import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { publicEnv, serverEnv } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * service_role 클라이언트 — RLS 를 우회한다.
 * 역할 동기화, 계정 삭제, AI 실행 로그 기록 등 서버 내부 작업에만 사용한다.
 * 사용자 입력으로 대상 user_id 를 정하지 말고, 반드시 검증된 세션 값만 넘긴다.
 */
export function createAdminClient() {
  const key = serverEnv().SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY 가 설정되지 않았습니다.");
  }
  return createSupabaseClient<Database>(publicEnv().NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
