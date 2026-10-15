"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { trackEvent } from "@/lib/analytics";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { getUserEmail, sendEmail } from "@/lib/email/send";
import { referralPacketEmail, referralSentUserEmail } from "@/lib/email/templates-referral";
import { buildReferralPacket, packetToText } from "@/lib/referral/packet";

export async function sendReferral(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  const supabase = await createClient();
  const { data: ref } = await supabase
    .from("referrals")
    .select("*")
    .eq("id", id.data)
    .maybeSingle();
  if (!ref || ref.status !== "consented") return;
  const [{ data: partner }, { data: grant }] = await Promise.all([
    supabase.from("partners").select("*").eq("id", ref.partner_id).maybeSingle(),
    supabase
      .from("consents")
      .select("created_at")
      .eq("referral_id", ref.id)
      .eq("kind", "grant")
      .maybeSingle(),
  ]);
  if (!partner) return;
  const packet = await buildReferralPacket(ref.user_id, ref.shared_items);
  const consentedAt = new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(new Date(grant?.created_at ?? ref.created_at));
  const sent = await sendEmail(
    "referral_packet",
    ref.user_id,
    referralPacketEmail({
      to: partner.contact_email,
      partnerName: partner.name,
      packetText: packetToText(packet),
      consentedAt,
    }),
  );
  if (!sent) return;
  await supabase
    .from("referrals")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", ref.id)
    .eq("status", "consented");

  const email = await getUserEmail(ref.user_id);
  if (email) {
    await sendEmail(
      "referral_sent_user",
      ref.user_id,
      referralSentUserEmail({
        to: email,
        displayName: packet.profile?.name ?? null,
        partnerName: partner.name,
      }),
    );
  }
  await trackEvent("referral.sent");
  revalidatePath("/admin/referrals");
  revalidatePath(`/admin/referrals/${ref.id}`);
}

const OUTCOMES = ["none", "interviewing", "offer", "hired", "declined"] as const;

export async function setReferralOutcome(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = z.uuid().safeParse(formData.get("id"));
  const outcome = z.enum(OUTCOMES).safeParse(formData.get("outcome"));
  if (!id.success || !outcome.success) return;
  const supabase = await createClient();
  await supabase
    .from("referrals")
    .update({
      outcome: outcome.data,
      outcome_note: String(formData.get("note") ?? "").slice(0, 500) || null,
      outcome_reported_by: "admin",
    })
    .eq("id", id.data);
  if (outcome.data === "offer" || outcome.data === "hired")
    await trackEvent("referral.offer_reported", { by: "admin" });
  revalidatePath(`/admin/referrals/${id.data}`);
}
