import "server-only";

import { runStructuredForUser } from "@/lib/ai/run";
import { modelFor } from "@/lib/ai/client";
import { buildUserMessage, PROMPT_VERSION, SYSTEM_PROMPT } from "@/lib/ai/prompts/es-review";
import { esReviewSchema } from "@/lib/ai/schemas/es-review";
import { trackEvent } from "@/lib/analytics";
import { createAdminClient } from "@/lib/db/admin";
import type { EsDocument, Json, Profile } from "@/lib/db/database.types";
import { createClient } from "@/lib/db/server";
import { detectPii } from "@/lib/pii/detect";
import { countChars } from "@/lib/text/char-count";
import { PERSONA_OPTIONS } from "@/lib/validation/onboarding";
import { toReviewView } from "./review-view";
import type { EsAiFeedback, EsReviewView } from "./types";

export const ES_MAX_INPUT_CHARS = 5000;

export class EsError extends Error {
  constructor(
    public readonly code: "not_found" | "empty" | "too_long" | "pii" | "save_failed",
    message: string,
  ) {
    super(message);
  }
}

/** 편집 중인 내용을 사용자 버전으로 저장한다. 기준 버전과 내용이 같으면 그 버전을 재사용한다. */
export async function saveUserVersion(params: {
  docId: string;
  content: string;
  parentVersionId: string | null;
  piiConfirmed: boolean;
}): Promise<{ versionId: string; created: boolean }> {
  const content = params.content.replace(/\r\n?/g, "\n").trimEnd();
  if (!content.trim()) throw new EsError("empty", "내용을 입력해 주세요.");
  if (countChars(content) > ES_MAX_INPUT_CHARS) {
    throw new EsError("too_long", `한 번에 ${ES_MAX_INPUT_CHARS}자까지 입력할 수 있습니다.`);
  }
  if (!params.piiConfirmed && detectPii(content).length > 0) {
    throw new EsError(
      "pii",
      "주민등록번호·여권번호·계좌번호·카드번호로 보이는 내용이 있습니다. 마스킹하거나 삭제한 뒤 다시 시도해 주세요.",
    );
  }

  const supabase = await createClient();
  if (params.parentVersionId) {
    const { data: parent } = await supabase
      .from("es_versions")
      .select("id, content")
      .eq("id", params.parentVersionId)
      .eq("doc_id", params.docId)
      .maybeSingle();
    if (parent && parent.content === content) return { versionId: parent.id, created: false };
  }

  const { data, error } = await supabase
    .from("es_versions")
    .insert({
      doc_id: params.docId,
      content,
      char_count: countChars(content),
      parent_version_id: params.parentVersionId,
      source: "user",
    })
    .select("id")
    .single();
  if (error || !data)
    throw new EsError("save_failed", "저장하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  await trackEvent("es.version_saved", { doc_id: params.docId });
  return { versionId: data.id, created: true };
}

export async function getEsDocument(docId: string): Promise<EsDocument | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("es_documents").select("*").eq("id", docId).maybeSingle();
  return data;
}

async function getLinkedEpisodes(docId: string) {
  const supabase = await createClient();
  const { data: links } = await supabase
    .from("es_document_episodes")
    .select("episode_id")
    .eq("doc_id", docId);
  const ids = (links ?? []).map((l) => l.episode_id);
  if (ids.length === 0) return [];
  const { data } = await supabase
    .from("episodes")
    .select("title, situation, task, action, result")
    .in("id", ids)
    .limit(5);
  return data ?? [];
}

/** ES 초안을 AI로 첨삭하고, 결과를 'ai' 출처 버전으로 기록한다. */
export async function reviewEsDraft(params: {
  userId: string;
  profile: Profile;
  doc: EsDocument;
  sourceVersionId: string;
  content: string;
  onProgress?: (info: { outputChars: number; attempt: number }) => void;
  signal?: AbortSignal;
}): Promise<EsReviewView> {
  const { doc, profile } = params;
  const charLimit = doc.char_limit;
  const episodes = await getLinkedEpisodes(doc.id);

  const result = await runStructuredForUser(params.userId, {
    feature: "es_review",
    promptVersion: PROMPT_VERSION,
    model: modelFor("main"),
    system: SYSTEM_PROMPT,
    userMessage: buildUserMessage({
      questionType: doc.question_type,
      questionText: doc.question_text,
      company: doc.company,
      charLimit,
      charCount: countChars(params.content),
      draft: params.content,
      profile: {
        personaLabel: PERSONA_OPTIONS.find((p) => p.value === profile.persona_type)?.label,
        desiredRoles: profile.desired_roles,
        jlptLevel: profile.jlpt_level,
      },
      episodes,
    }),
    schema: esReviewSchema,
    validate: (data) => {
      if (!data.revised_text_ja.trim()) return "revised_text_ja が空です。";
      const n = countChars(data.revised_text_ja);
      if (charLimit && n > charLimit) {
        return `revised_text_ja が${n}字で、文字数制限${charLimit}字を超えています。${charLimit}字以内に収めてください。`;
      }
      return null;
    },
    effort: "medium",
    storeRaw: profile.allow_training_use,
    onProgress: params.onProgress,
    signal: params.signal,
  });

  const review = result.data;
  const feedback: EsAiFeedback = {
    reviewed_version_id: params.sourceVersionId,
    overall_comment_ko: review.overall_comment_ko,
    changes: review.changes,
    questions_ko: review.questions_ko,
    model: result.model,
  };

  // ai 출처 버전은 서버만 기록한다 (사용자 위조 방지, DECISIONS D18)
  const admin = createAdminClient();
  const { data: version, error } = await admin
    .from("es_versions")
    .insert({
      doc_id: doc.id,
      parent_version_id: params.sourceVersionId,
      content: review.revised_text_ja,
      char_count: countChars(review.revised_text_ja),
      ai_feedback: feedback as unknown as Json,
      scores: review.scores as unknown as Json,
      source: "ai",
      prompt_version: PROMPT_VERSION,
    })
    .select("*")
    .single();
  if (error || !version) throw new EsError("save_failed", "첨삭 결과를 저장하지 못했습니다.");

  await trackEvent("es.review_completed", {
    doc_id: doc.id,
    attempts: result.attempts,
    question_type: doc.question_type,
  });

  const view = toReviewView(version);
  if (!view) throw new EsError("save_failed", "첨삭 결과 형식이 올바르지 않습니다.");
  return view;
}
