import "server-only";

import type { EsVersion, QuotaStatus, ReviewRequest } from "@/lib/db/database.types";
import { createClient } from "@/lib/db/server";

export async function listEsDocuments() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("es_documents")
    .select("id, title, company, question_type, char_limit, updated_at")
    .order("updated_at", { ascending: false });
  return data ?? [];
}

export async function listVersions(docId: string): Promise<EsVersion[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("es_versions")
    .select("*")
    .eq("doc_id", docId)
    .order("version_no", { ascending: false });
  return data ?? [];
}

export async function listReviewRequests(versionIds: string[]): Promise<ReviewRequest[]> {
  if (versionIds.length === 0) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("review_requests")
    .select("*")
    .eq("target_type", "es_version")
    .in("target_id", versionIds)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function getAfterRatings(aiVersionIds: string[]): Promise<Record<string, number>> {
  if (aiVersionIds.length === 0) return {};
  const supabase = await createClient();
  const { data } = await supabase
    .from("feedback_ratings")
    .select("target_id, rating")
    .eq("feature", "es_review")
    .eq("phase", "after")
    .in("target_id", aiVersionIds);
  return Object.fromEntries((data ?? []).map((r) => [r.target_id, r.rating]));
}

export async function getQuotaStatus(): Promise<QuotaStatus | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_quota_status");
  return data ?? null;
}
