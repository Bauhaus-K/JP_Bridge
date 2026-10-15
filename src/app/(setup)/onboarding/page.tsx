import type { Metadata } from "next";

import { requireProfile } from "@/lib/auth/session";
import { dateToMonth } from "@/lib/validation/onboarding";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "프로필 설정" };

function monthString(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function OnboardingPage() {
  const { profile } = await requireProfile();
  const isFirst = !profile.onboarded_at;
  const now = new Date();
  const max = new Date(now.getFullYear(), now.getMonth() + 36, 1);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">
          {isFirst ? "환영합니다! 몇 가지만 알려주세요" : "프로필 수정"}
        </h1>
        <p className="mt-2 text-muted-foreground">
          준비 유형과 목표 시기에 맞춰 코칭 내용과 체크리스트를 맞춤화합니다. 1분이면 끝나요.
        </p>
      </div>
      <OnboardingForm
        isFirst={isFirst}
        minMonth={monthString(now)}
        maxMonth={monthString(max)}
        initial={{
          displayName: profile.display_name ?? "",
          personaType: profile.persona_type ?? undefined,
          jlptLevel: profile.jlpt_level ?? undefined,
          graduationMonth: dateToMonth(profile.graduation_date),
          careerYears: profile.career_years?.toString() ?? "",
          targetStartMonth: dateToMonth(profile.target_start),
          desiredRoles: profile.desired_roles,
          aiNoticeAck: Boolean(profile.ai_notice_ack_at),
          allowTrainingUse: profile.allow_training_use,
        }}
      />
    </div>
  );
}
