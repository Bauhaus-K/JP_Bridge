"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { trackEvent } from "@/lib/analytics";
import { requireOnboarded } from "@/lib/auth/session";
import type { Json } from "@/lib/db/database.types";
import { createClient } from "@/lib/db/server";

type Result = { ok: true } | { ok: false; message: string };

const editSchema = z.object({ id: z.uuid(), text: z.string().max(20000) });

export async function saveCareerEdit(input: z.infer<typeof editSchema>): Promise<Result> {
  await requireOnboarded();
  const parsed = editSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "입력 내용을 확인해 주세요." };
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("career_translations")
    .select("output")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (!row?.output) return { ok: false, message: "변환 결과를 찾을 수 없습니다." };
  const output = {
    ...(row.output as Record<string, Json>),
    edited_text_ja: parsed.data.text.trim() || null,
  };
  const { error } = await supabase
    .from("career_translations")
    .update({ output })
    .eq("id", parsed.data.id);
  if (error) return { ok: false, message: "저장하지 못했습니다." };
  revalidatePath(`/career/${parsed.data.id}`);
  return { ok: true };
}

const REVIEW_ERRORS: Record<string, string> = {
  limit: "이번 달 운영자 검수 요청 가능 횟수를 모두 사용했습니다.",
  duplicate: "이미 검수 요청 중입니다.",
  not_found: "대상을 찾을 수 없습니다.",
};

export async function requestCareerReview(input: { id: string; note?: string }): Promise<Result> {
  await requireOnboarded();
  const id = z.uuid().safeParse(input.id);
  if (!id.success) return { ok: false, message: "대상을 찾을 수 없습니다." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("request_review", {
    p_target_type: "career_translation",
    p_target_id: id.data,
    p_note: input.note?.slice(0, 1000) ?? null,
  });
  if (error || !data) return { ok: false, message: "요청하지 못했습니다." };
  if (!data.ok)
    return { ok: false, message: REVIEW_ERRORS[data.reason ?? ""] ?? "요청하지 못했습니다." };
  await trackEvent("career.review_requested");
  revalidatePath(`/career/${id.data}`);
  return { ok: true };
}

export async function deleteCareer(formData: FormData): Promise<void> {
  await requireOnboarded();
  const id = z.uuid().safeParse(formData.get("id"));
  if (id.success) {
    const supabase = await createClient();
    await supabase.from("career_translations").delete().eq("id", id.data);
  }
  redirect("/career");
}
