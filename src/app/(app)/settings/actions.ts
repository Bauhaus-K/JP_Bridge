"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { deleteAccountData } from "@/lib/account";

import { trackEvent } from "@/lib/analytics";
import { requireOnboarded } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { sendEmail } from "@/lib/email/send";
import { planRequestedAdminEmail } from "@/lib/email/templates-plan";
import { publicEnv, serverEnv } from "@/lib/env";
import { revokeAllReferrals } from "@/lib/referral/service";

export type SettingsState = { message?: string; ok?: boolean };

export async function updatePrivacy(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const { user } = await requireOnboarded();
  const allow = formData.get("allowTrainingUse") === "on";
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ allow_training_use: allow })
    .eq("user_id", user.id);
  if (error) return { message: "저장하지 못했습니다." };
  await trackEvent("settings.training_opt_in", { allow });
  revalidatePath("/settings");
  return {
    ok: true,
    message: allow
      ? "원문 활용에 동의했습니다."
      : "원문 활용 동의를 철회했습니다. 이후 AI 실행 원문은 저장되지 않습니다.",
  };
}

export async function requestPro(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const { profile } = await requireOnboarded();
  const message =
    String(formData.get("message") ?? "")
      .trim()
      .slice(0, 1000) || null;
  const supabase = await createClient();
  const { error } = await supabase.from("plan_requests").insert({ plan_code: "pro", message });
  if (error) {
    return {
      message:
        error.code === "23505"
          ? "이미 신청한 내역이 있습니다. 운영자 확인을 기다려 주세요."
          : "신청하지 못했습니다.",
    };
  }
  await trackEvent("plan.upgrade_requested");
  const link = new URL("/admin/users?filter=requests", publicEnv().NEXT_PUBLIC_SITE_URL).toString();
  await Promise.all(
    serverEnv().ADMIN_EMAILS.map((to) =>
      sendEmail(
        "plan_requested_admin",
        null,
        planRequestedAdminEmail({ to, userLabel: profile.display_name ?? "회원", link }),
      ),
    ),
  );
  revalidatePath("/settings");
  return { ok: true, message: "프로 플랜을 신청했습니다. 운영자가 확인 후 안내드립니다." };
}

export async function cancelPlanRequest(): Promise<void> {
  const { user } = await requireOnboarded();
  const supabase = await createClient();
  await supabase
    .from("plan_requests")
    .update({ status: "cancelled" })
    .eq("user_id", user.id)
    .eq("status", "pending");
  revalidatePath("/settings");
}

export async function deleteAccount(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const { user, profile } = await requireOnboarded();
  if (String(formData.get("confirm") ?? "").trim() !== "탈퇴") {
    return { message: "확인을 위해 '탈퇴'를 입력해 주세요." };
  }
  // 진행 중인 제휴사 연결은 먼저 철회한다 (전달된 경우 제휴사에 삭제 요청)
  await revokeAllReferrals(user.id, `${profile.display_name ?? "후보자"} (${user.email ?? ""})`);
  await deleteAccountData(user.id);
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/?deleted=1");
}
