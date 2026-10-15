"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { trackEvent } from "@/lib/analytics";
import { requireOnboarded } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { EsError, saveUserVersion } from "@/lib/es/service";
import { esDocumentFormToObject, esDocumentSchema } from "@/lib/validation/es";

export type CreateEsState = {
  message?: string;
  fieldErrors?: Partial<Record<string, string>>;
  values?: ReturnType<typeof esDocumentFormToObject>;
};

export async function createEsDocument(
  _prev: CreateEsState,
  formData: FormData,
): Promise<CreateEsState> {
  await requireOnboarded();
  const values = esDocumentFormToObject(formData);
  const parsed = esDocumentSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { message: "입력 내용을 확인해 주세요.", fieldErrors, values };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("es_documents")
    .insert({
      title: parsed.data.title,
      question_type: parsed.data.questionType,
      company: parsed.data.company,
      question_text: parsed.data.questionText,
      char_limit: parsed.data.charLimit,
    })
    .select("id")
    .single();
  if (error || !data) return { message: "만들지 못했습니다. 잠시 후 다시 시도해 주세요.", values };

  await trackEvent("es.document_created", { question_type: parsed.data.questionType });
  redirect(`/es/${data.id}`);
}

export type ActionResult<T = object> =
  ({ ok: true } & T) | { ok: false; code: string; message: string };

const saveSchema = z.object({
  docId: z.uuid(),
  content: z.string().max(20000),
  parentVersionId: z.uuid().nullable(),
  piiConfirmed: z.boolean(),
});

export async function saveEsVersion(
  input: z.infer<typeof saveSchema>,
): Promise<ActionResult<{ versionId: string; created: boolean }>> {
  await requireOnboarded();
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, code: "invalid_input", message: "요청 형식이 올바르지 않습니다." };
  try {
    const saved = await saveUserVersion(parsed.data);
    revalidatePath(`/es/${parsed.data.docId}`);
    return { ok: true, ...saved };
  } catch (error) {
    if (error instanceof EsError) return { ok: false, code: error.code, message: error.message };
    throw error;
  }
}

const rateSchema = z.object({ aiVersionId: z.uuid(), rating: z.number().int().min(1).max(5) });

export async function rateEsReview(input: z.infer<typeof rateSchema>): Promise<ActionResult> {
  await requireOnboarded();
  const parsed = rateSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, code: "invalid_input", message: "평가 값이 올바르지 않습니다." };
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("feedback_ratings")
    .select("id")
    .eq("feature", "es_review")
    .eq("target_id", parsed.data.aiVersionId)
    .eq("phase", "after")
    .maybeSingle();
  const { error } = existing
    ? await supabase
        .from("feedback_ratings")
        .update({ rating: parsed.data.rating })
        .eq("id", existing.id)
    : await supabase.from("feedback_ratings").insert({
        feature: "es_review",
        target_id: parsed.data.aiVersionId,
        phase: "after",
        rating: parsed.data.rating,
      });
  if (error) return { ok: false, code: "save_failed", message: "평가를 저장하지 못했습니다." };
  if (!existing) await trackEvent("es.review_rated", { rating: parsed.data.rating });
  return { ok: true };
}

const reviewRequestSchema = z.object({
  docId: z.uuid(),
  versionId: z.uuid(),
  note: z.string().max(1000).optional(),
});

const REVIEW_REQUEST_ERRORS: Record<string, string> = {
  limit: "이번 달 운영자 검수 요청 가능 횟수를 모두 사용했습니다.",
  duplicate: "이 버전은 이미 검수 요청 중입니다.",
  not_found: "검수를 요청할 버전을 찾을 수 없습니다.",
};

export async function requestEsReview(
  input: z.infer<typeof reviewRequestSchema>,
): Promise<ActionResult> {
  await requireOnboarded();
  const parsed = reviewRequestSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, code: "invalid_input", message: "요청 형식이 올바르지 않습니다." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("request_review", {
    p_target_type: "es_version",
    p_target_id: parsed.data.versionId,
    p_note: parsed.data.note ?? null,
  });
  if (error || !data)
    return {
      ok: false,
      code: "unknown",
      message: "요청하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    };
  if (!data.ok) {
    return {
      ok: false,
      code: data.reason ?? "unknown",
      message: REVIEW_REQUEST_ERRORS[data.reason ?? ""] ?? "요청하지 못했습니다.",
    };
  }
  await trackEvent("es.review_requested", { doc_id: parsed.data.docId });
  revalidatePath(`/es/${parsed.data.docId}`);
  return { ok: true };
}

export async function deleteEsDocument(formData: FormData): Promise<void> {
  await requireOnboarded();
  const docId = z.uuid().safeParse(formData.get("docId"));
  if (docId.success) {
    const supabase = await createClient();
    await supabase.from("es_documents").delete().eq("id", docId.data);
    await trackEvent("es.document_deleted");
  }
  redirect("/es");
}
