"use server";

import { redirect } from "next/navigation";

import { trackEvent } from "@/lib/analytics";
import { requireProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import {
  buildOnboardingSchema,
  onboardingFormToObject,
  onboardingToProfileUpdate,
} from "@/lib/validation/onboarding";

export type OnboardingValues = ReturnType<typeof onboardingFormToObject>;

export type OnboardingState = {
  message?: string;
  fieldErrors?: Partial<Record<string, string>>;
  /** 오류 시 입력값 유지용 (React 19 는 액션 후 폼을 초기화한다) */
  values?: OnboardingValues;
};

export async function saveOnboarding(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const { user, profile } = await requireProfile();
  const values = onboardingFormToObject(formData);
  const parsed = buildOnboardingSchema().safeParse(values);

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fieldErrors[key] ??= issue.message;
    }
    return { message: "입력 내용을 확인해 주세요.", fieldErrors, values };
  }

  const now = new Date();
  const update = onboardingToProfileUpdate(parsed.data, now);
  const isFirst = !profile.onboarded_at;

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ ...update, ...(isFirst ? { onboarded_at: now.toISOString() } : {}) })
    .eq("user_id", user.id);

  if (error) {
    return { message: "저장하지 못했습니다. 잠시 후 다시 시도해 주세요.", values };
  }

  await trackEvent(isFirst ? "onboarding.completed" : "profile.updated", {
    persona_type: parsed.data.personaType,
    jlpt_level: parsed.data.jlptLevel,
  });

  redirect("/dashboard");
}
