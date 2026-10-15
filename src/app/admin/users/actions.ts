"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { trackEvent } from "@/lib/analytics";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { getUserEmail, sendEmail } from "@/lib/email/send";
import { planActivatedEmail } from "@/lib/email/templates-plan";
import { publicEnv } from "@/lib/env";
import { getPaymentProvider } from "@/lib/payments";

const activateSchema = z.object({
  userId: z.uuid(),
  months: z.coerce.number().int().min(1).max(12),
});

export async function activatePro(formData: FormData): Promise<void> {
  const { user: admin } = await requireAdmin();
  const parsed = activateSchema.safeParse({
    userId: formData.get("userId"),
    months: formData.get("months"),
  });
  if (!parsed.success) return;
  const summary = await getPaymentProvider().activate({
    userId: parsed.data.userId,
    planCode: "pro",
    months: parsed.data.months,
    actorId: admin.id,
  });

  const supabase = await createClient();
  await supabase
    .from("plan_requests")
    .update({ status: "approved", handled_by: admin.id, handled_at: new Date().toISOString() })
    .eq("user_id", parsed.data.userId)
    .eq("status", "pending");

  const [{ data: profile }, email] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", parsed.data.userId)
      .maybeSingle(),
    getUserEmail(parsed.data.userId),
  ]);
  if (email) {
    await sendEmail(
      "plan_activated",
      parsed.data.userId,
      planActivatedEmail({
        to: email,
        displayName: profile?.display_name ?? null,
        periodEnd: summary.periodEnd,
        link: new URL("/settings", publicEnv().NEXT_PUBLIC_SITE_URL).toString(),
      }),
    );
  }
  await trackEvent("plan.activated", { months: parsed.data.months, provider: summary.provider });
  revalidatePath("/admin/users");
}

export async function cancelPro(formData: FormData): Promise<void> {
  const { user: admin } = await requireAdmin();
  const userId = z.uuid().safeParse(formData.get("userId"));
  if (!userId.success) return;
  await getPaymentProvider().cancel({ userId: userId.data, actorId: admin.id });
  await trackEvent("plan.cancelled");
  revalidatePath("/admin/users");
}

export async function rejectPlanRequest(formData: FormData): Promise<void> {
  const { user: admin } = await requireAdmin();
  const userId = z.uuid().safeParse(formData.get("userId"));
  if (!userId.success) return;
  const supabase = await createClient();
  await supabase
    .from("plan_requests")
    .update({ status: "rejected", handled_by: admin.id, handled_at: new Date().toISOString() })
    .eq("user_id", userId.data)
    .eq("status", "pending");
  revalidatePath("/admin/users");
}
