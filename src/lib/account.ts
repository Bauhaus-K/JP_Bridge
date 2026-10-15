import "server-only";

import { createAdminClient } from "@/lib/db/admin";
import { createClient } from "@/lib/db/server";

/** 사용자 본인 데이터 전체(JSON 내보내기). 사용자 테이블은 RLS 로, 운영 로그는 service_role 로 본인 것만 읽는다. */
export async function exportUserData(userId: string, email: string | null) {
  const supabase = await createClient();
  const tables = [
    "profiles",
    "episodes",
    "analysis_conversations",
    "analysis_messages",
    "es_documents",
    "es_versions",
    "es_document_episodes",
    "career_translations",
    "interview_sessions",
    "interview_turns",
    "checklists",
    "checklist_items",
    "review_requests",
    "feedback_ratings",
    "subscriptions",
    "plan_requests",
    "referrals",
    "consents",
    "usage_counters",
  ] as const;
  const result: Record<string, unknown> = {
    exported_at: new Date().toISOString(),
    account: { id: userId, email },
  };
  for (const table of tables) {
    const { data } = await supabase.from(table).select("*");
    result[table] = data ?? [];
  }
  const admin = createAdminClient();
  const [{ data: events }, { data: aiRuns }] = await Promise.all([
    admin
      .from("events")
      .select("name, props, created_at")
      .eq("user_id", userId)
      .order("created_at"),
    admin
      .from("ai_runs")
      .select(
        "feature, model, prompt_version, input_tokens, output_tokens, latency_ms, status, created_at",
      )
      .eq("user_id", userId)
      .order("created_at"),
  ]);
  result.events = events ?? [];
  result.ai_runs = aiRuns ?? [];
  return result;
}

/** 계정과 모든 데이터를 삭제한다. 동의 기록은 가명화되어 보관 기한까지 남는다 (DECISIONS Q3). */
export async function deleteAccountData(userId: string) {
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw new Error(`delete user failed: ${error.message}`);
}
