import "server-only";

import { careerTranslationSchema, type CareerOutput } from "@/lib/ai/schemas/career";
import {
  interviewSummarySchema,
  type InterviewFeedback,
  type InterviewSummary,
} from "@/lib/ai/schemas/interview";
import { careerToPlainText } from "@/lib/career/format";
import type {
  EsDocument,
  EsVersion,
  InterviewSession,
  InterviewTurn,
  ReviewRequest,
} from "@/lib/db/database.types";
import { createClient } from "@/lib/db/server";
import { toReviewView } from "@/lib/es/review-view";
import type { EsReviewView } from "@/lib/es/types";
import { orderTurns } from "@/lib/interview/turns";

export type ReviewTarget =
  | {
      type: "es_version";
      doc: EsDocument;
      version: EsVersion;
      versions: EsVersion[];
      aiReview: EsReviewView | null;
    }
  | { type: "career_translation"; title: string; input: string; text: string; output: CareerOutput }
  | {
      type: "interview_session";
      session: InterviewSession;
      turns: (InterviewTurn & { feedbackParsed: InterviewFeedback | null })[];
      summary: InterviewSummary | null;
    }
  | { type: "missing" };

/** admin RLS 로 검수 대상 콘텐츠를 읽는다 (검수 요청이 걸린 대상만 읽을 수 있다). */
export async function loadReviewTarget(request: ReviewRequest): Promise<ReviewTarget> {
  const supabase = await createClient();
  if (request.target_type === "es_version") {
    const { data: version } = await supabase
      .from("es_versions")
      .select("*")
      .eq("id", request.target_id)
      .maybeSingle();
    if (!version) return { type: "missing" };
    const [{ data: doc }, { data: versions }] = await Promise.all([
      supabase.from("es_documents").select("*").eq("id", version.doc_id).maybeSingle(),
      supabase
        .from("es_versions")
        .select("*")
        .eq("doc_id", version.doc_id)
        .order("version_no", { ascending: false }),
    ]);
    if (!doc) return { type: "missing" };
    const all = versions ?? [];
    const aiVersion =
      version.source === "ai"
        ? version
        : all.find((v) => v.source === "ai" && v.parent_version_id === version.id);
    return {
      type: "es_version",
      doc,
      version,
      versions: all,
      aiReview: aiVersion ? toReviewView(aiVersion) : null,
    };
  }
  if (request.target_type === "career_translation") {
    const { data } = await supabase
      .from("career_translations")
      .select("*")
      .eq("id", request.target_id)
      .maybeSingle();
    const parsed = careerTranslationSchema.safeParse(data?.output);
    if (!data || !parsed.success) return { type: "missing" };
    const output = { ...parsed.data, ...(data.output as object) } as CareerOutput;
    return {
      type: "career_translation",
      title: data.title,
      input: data.input,
      text: careerToPlainText(output),
      output,
    };
  }
  const [{ data: session }, { data: turns }] = await Promise.all([
    supabase.from("interview_sessions").select("*").eq("id", request.target_id).maybeSingle(),
    supabase.from("interview_turns").select("*").eq("session_id", request.target_id),
  ]);
  if (!session) return { type: "missing" };
  const summary = interviewSummarySchema.safeParse(session.summary);
  return {
    type: "interview_session",
    session,
    turns: orderTurns(turns ?? []).map((t) => ({
      ...t,
      feedbackParsed: (t.feedback as InterviewFeedback | null) ?? null,
    })),
    summary: summary.success ? summary.data : null,
  };
}

/** 사용자 화면 링크 */
export function targetLink(
  request: Pick<ReviewRequest, "target_type" | "target_id">,
  docId?: string,
): string {
  if (request.target_type === "es_version")
    return docId ? `/es/${docId}?v=${request.target_id}` : "/es";
  if (request.target_type === "career_translation") return `/career/${request.target_id}`;
  return `/interview/${request.target_id}`;
}
