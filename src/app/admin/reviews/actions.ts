"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { loadReviewTarget, targetLink } from "@/lib/admin/reviews";
import { trackEvent } from "@/lib/analytics";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { getUserEmail, sendEmail } from "@/lib/email/send";
import { reviewDoneEmail } from "@/lib/email/templates";
import { publicEnv } from "@/lib/env";
import { countChars } from "@/lib/text/char-count";

export async function startReview(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  const supabase = await createClient();
  await supabase
    .from("review_requests")
    .update({ status: "in_review" })
    .eq("id", id.data)
    .eq("status", "pending");
  revalidatePath(`/admin/reviews/${id.data}`);
}

export type CompleteReviewState = { message?: string };

const completeSchema = z.object({
  id: z.uuid(),
  comment: z.string().trim().min(1, "검수 코멘트를 입력해 주세요.").max(5000),
  revisedText: z.string().max(10000).optional(),
});

export async function completeReview(
  _prev: CompleteReviewState,
  formData: FormData,
): Promise<CompleteReviewState> {
  const { user } = await requireAdmin();
  const parsed = completeSchema.safeParse({
    id: formData.get("id"),
    comment: formData.get("comment"),
    revisedText: formData.get("revisedText") ?? undefined,
  });
  if (!parsed.success)
    return { message: parsed.error.issues[0]?.message ?? "입력 내용을 확인해 주세요." };

  const supabase = await createClient();
  const { data: request } = await supabase
    .from("review_requests")
    .select("*")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (!request) return { message: "검수 요청을 찾을 수 없습니다." };
  if (request.status === "done" || request.status === "cancelled")
    return { message: "이미 처리된 요청입니다." };

  const target = await loadReviewTarget(request);
  let adminVersionId: string | null = null;
  const revised = parsed.data.revisedText?.replace(/\r\n?/g, "\n").trim();
  if (target.type === "es_version" && revised && revised !== target.version.content.trim()) {
    const { data: version, error } = await supabase
      .from("es_versions")
      .insert({
        doc_id: target.doc.id,
        parent_version_id: target.version.id,
        content: revised,
        char_count: countChars(revised),
        source: "admin",
      })
      .select("id")
      .single();
    if (error || !version) return { message: "운영자 수정본을 저장하지 못했습니다." };
    adminVersionId = version.id;
  }

  const { error } = await supabase
    .from("review_requests")
    .update({
      status: "done",
      admin_comment: parsed.data.comment,
      admin_version_id: adminVersionId,
      reviewed_by: user.id,
    })
    .eq("id", request.id);
  if (error) return { message: "검수 결과를 저장하지 못했습니다." };

  // 사용자에게 알림 (실패해도 검수 완료는 유지, email_log 에 기록)
  const [{ data: profile }, email] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("user_id", request.user_id).maybeSingle(),
    getUserEmail(request.user_id),
  ]);
  if (email) {
    const link = new URL(
      targetLink(request, target.type === "es_version" ? target.doc.id : undefined),
      publicEnv().NEXT_PUBLIC_SITE_URL,
    ).toString();
    const sent = await sendEmail(
      "review_done",
      request.user_id,
      reviewDoneEmail({
        to: email,
        displayName: profile?.display_name ?? null,
        targetType: request.target_type,
        link,
      }),
    );
    if (sent)
      await supabase
        .from("review_requests")
        .update({ notified_at: new Date().toISOString() })
        .eq("id", request.id);
  }
  await trackEvent("review.completed", {
    target_type: request.target_type,
    with_revision: Boolean(adminVersionId),
  });
  revalidatePath("/admin/reviews");
  redirect("/admin/reviews?done=1");
}
