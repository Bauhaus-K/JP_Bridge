"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { AiError } from "@/lib/ai/errors";
import { trackEvent } from "@/lib/analytics";
import { requireOnboarded } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { createInterview, finishInterview, InterviewError } from "@/lib/interview/service";

const createSchema = z.object({
  company: z
    .string()
    .trim()
    .max(60)
    .transform((v) => v || null),
  jobRole: z.string().trim().min(1, "직종을 입력해 주세요.").max(60),
  stage: z.enum(["first", "final"]),
  questionCount: z.coerce.number().int().min(3).max(8),
});

export type CreateInterviewState = { message?: string };

function errorMessage(error: unknown) {
  if (error instanceof AiError) return error.userMessage;
  if (error instanceof InterviewError) return error.message;
  throw error;
}

export async function createInterviewAction(
  _prev: CreateInterviewState,
  formData: FormData,
): Promise<CreateInterviewState> {
  const { user, profile } = await requireOnboarded();
  const parsed = createSchema.safeParse({
    company: formData.get("company") ?? "",
    jobRole: formData.get("jobRole") ?? "",
    stage: formData.get("stage"),
    questionCount: formData.get("questionCount"),
  });
  if (!parsed.success)
    return { message: parsed.error.issues[0]?.message ?? "입력 내용을 확인해 주세요." };
  let id: string;
  try {
    id = await createInterview({ userId: user.id, profile, ...parsed.data });
  } catch (error) {
    return { message: errorMessage(error) };
  }
  redirect(`/interview/${id}`);
}

export async function finishInterviewAction(
  sessionId: string,
): Promise<{ ok: boolean; message?: string }> {
  const { user, profile } = await requireOnboarded();
  const id = z.uuid().safeParse(sessionId);
  if (!id.success) return { ok: false, message: "면접을 찾을 수 없습니다." };
  try {
    await finishInterview({ userId: user.id, profile, sessionId: id.data });
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
  revalidatePath(`/interview/${id.data}`);
  return { ok: true };
}

const REVIEW_ERRORS: Record<string, string> = {
  limit: "이번 달 운영자 검수 요청 가능 횟수를 모두 사용했습니다.",
  duplicate: "이미 검수 요청 중입니다.",
  not_found: "대상을 찾을 수 없습니다.",
};

export async function requestInterviewReview(
  sessionId: string,
): Promise<{ ok: boolean; message: string }> {
  await requireOnboarded();
  const id = z.uuid().safeParse(sessionId);
  if (!id.success) return { ok: false, message: "대상을 찾을 수 없습니다." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("request_review", {
    p_target_type: "interview_session",
    p_target_id: id.data,
  });
  if (error || !data) return { ok: false, message: "요청하지 못했습니다." };
  if (!data.ok)
    return { ok: false, message: REVIEW_ERRORS[data.reason ?? ""] ?? "요청하지 못했습니다." };
  await trackEvent("interview.review_requested");
  revalidatePath(`/interview/${id.data}`);
  return { ok: true, message: "운영자 검수를 요청했습니다." };
}

export async function deleteInterview(formData: FormData): Promise<void> {
  await requireOnboarded();
  const id = z.uuid().safeParse(formData.get("id"));
  if (id.success) {
    const supabase = await createClient();
    await supabase.from("interview_sessions").delete().eq("id", id.data);
  }
  redirect("/interview");
}
