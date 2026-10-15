"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { requireOnboarded } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { flags } from "@/lib/flags";
import { createReferral, ReferralError, revokeReferral } from "@/lib/referral/service";

export type ReferralFormState = { message?: string };

export async function submitReferral(
  _prev: ReferralFormState,
  formData: FormData,
): Promise<ReferralFormState> {
  if (!flags.referral()) notFound();
  const { user } = await requireOnboarded();
  const partnerId = z.uuid().safeParse(formData.get("partnerId"));
  if (!partnerId.success) return { message: "제휴사를 찾을 수 없습니다." };
  if (
    formData.get("agreeProvide") !== "on" ||
    formData.get("agreeTransfer") !== "on" ||
    formData.get("agreeRead") !== "on"
  ) {
    return { message: "필수 동의 항목을 모두 확인해 주세요." };
  }
  try {
    await createReferral({
      userId: user.id,
      partnerId: partnerId.data,
      rawItems: formData.getAll("items").map(String),
    });
  } catch (error) {
    if (error instanceof ReferralError) return { message: error.message };
    throw error;
  }
  redirect("/referrals?done=1");
}

export async function revokeReferralAction(formData: FormData): Promise<void> {
  if (!flags.referral()) notFound();
  const { user, profile } = await requireOnboarded();
  const id = z.uuid().safeParse(formData.get("referralId"));
  if (!id.success) return;
  await revokeReferral({
    userId: user.id,
    referralId: id.data,
    candidateLabel: `${profile.display_name ?? "후보자"} (${user.email ?? ""})`,
  });
  revalidatePath("/referrals");
}

const OUTCOMES = ["none", "interviewing", "offer", "hired", "declined"] as const;

export async function reportOutcomeAction(formData: FormData): Promise<void> {
  if (!flags.referral()) notFound();
  await requireOnboarded();
  const id = z.uuid().safeParse(formData.get("referralId"));
  const outcome = z.enum(OUTCOMES).safeParse(formData.get("outcome"));
  if (!id.success || !outcome.success) return;
  const supabase = await createClient();
  await supabase.rpc("report_referral_outcome", {
    p_referral_id: id.data,
    p_outcome: outcome.data,
    p_note: String(formData.get("note") ?? "") || null,
  });
  revalidatePath("/referrals");
}
