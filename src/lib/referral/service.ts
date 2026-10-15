import "server-only";

import { createHash } from "node:crypto";
import { headers } from "next/headers";

import {
  REFERRAL_CONSENT_VERSION,
  REFERRAL_PURPOSE,
  REFERRAL_RETENTION,
  REFERRAL_REVOKE_TEXT,
  REFERRAL_REVOKE_VERSION,
  renderConsentText,
} from "@/content/consent/referral";
import { trackEvent } from "@/lib/analytics";
import { createAdminClient } from "@/lib/db/admin";
import type { Partner } from "@/lib/db/database.types";
import { createClient } from "@/lib/db/server";
import { sendEmail } from "@/lib/email/send";
import { referralRevokedEmail } from "@/lib/email/templates-referral";
import { COUNTRY_LABELS, decodeItem, describeItems, encodeItem, type SharedItem } from "./items";

export function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** 요청자 IP 는 원문을 저장하지 않고 해시만 남긴다 */
async function requestMeta() {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "";
  return {
    ipHash: ip ? sha256(`jpb-ip:${ip}`).slice(0, 32) : null,
    userAgent: h.get("user-agent"),
  };
}

/** 사용자 본인이 소유한 ES·경력 번역 제목 (RLS 로 확인) */
export async function getShareableTitles() {
  const supabase = await createClient();
  const [{ data: docs }, { data: careers }] = await Promise.all([
    supabase.from("es_documents").select("id, title").order("updated_at", { ascending: false }),
    supabase
      .from("career_translations")
      .select("id, title")
      .order("updated_at", { ascending: false }),
  ]);
  return { docs: docs ?? [], careers: careers ?? [] };
}

export function consentVarsFor(
  partner: Partner,
  items: SharedItem[],
  titles: Record<string, string>,
) {
  return {
    partner_name: partner.name,
    partner_country: COUNTRY_LABELS[partner.country] ?? partner.country,
    partner_contact: partner.contact_email,
    partner_license: partner.license_no ?? "(제휴사 확인 중)",
    partner_privacy_contact: partner.privacy_contact ?? partner.contact_email,
    items: describeItems(items, titles),
  };
}

export class ReferralError extends Error {
  constructor(
    public readonly code: "not_found" | "invalid" | "duplicate" | "save_failed",
    message: string,
  ) {
    super(message);
  }
}

/** 동의 화면에서 보여 준 것과 같은 문구를 서버에서 다시 만들어 해시와 함께 기록한다 */
export async function createReferral(params: {
  userId: string;
  partnerId: string;
  rawItems: string[];
}): Promise<string> {
  const supabase = await createClient();
  const { data: partner } = await supabase
    .from("partners")
    .select("*")
    .eq("id", params.partnerId)
    .eq("active", true)
    .maybeSingle();
  if (!partner) throw new ReferralError("not_found", "제휴사를 찾을 수 없습니다.");

  const items = Array.from(new Set(params.rawItems))
    .map(decodeItem)
    .filter((i) => i !== null);
  if (items.length === 0)
    throw new ReferralError("invalid", "공유할 항목을 하나 이상 선택해 주세요.");

  const { docs, careers } = await getShareableTitles();
  const titles: Record<string, string> = {};
  docs.forEach((d) => (titles[`es:${d.id}`] = d.title));
  careers.forEach((c) => (titles[`career:${c.id}`] = c.title));
  if (items.some((i) => i.kind !== "profile" && !titles[encodeItem(i)])) {
    throw new ReferralError("invalid", "선택한 항목을 찾을 수 없습니다.");
  }

  const text = renderConsentText(consentVarsFor(partner, items, titles));
  const meta = await requestMeta();
  const admin = createAdminClient();
  const { data: referralId, error } = await admin.rpc("record_referral_consent", {
    p_user_id: params.userId,
    p_partner_id: partner.id,
    p_items: items.map(encodeItem),
    p_text_version: REFERRAL_CONSENT_VERSION,
    p_text_hash: sha256(text),
    p_purpose: REFERRAL_PURPOSE,
    p_retention: REFERRAL_RETENTION,
    p_ip_hash: meta.ipHash,
    p_user_agent: meta.userAgent,
  });
  if (error?.code === "23505")
    throw new ReferralError("duplicate", "이미 이 제휴사에 연결을 신청했습니다.");
  if (error || !referralId)
    throw new ReferralError("save_failed", "동의를 기록하지 못했습니다. 다시 시도해 주세요.");
  await trackEvent("referral.consented", { items: items.map((i) => i.kind) });
  return referralId;
}

/** 철회 기록 → 이미 전달된 경우 제휴사에 삭제 요청 메일 */
export async function revokeReferral(params: {
  userId: string;
  referralId: string;
  candidateLabel: string;
}) {
  const meta = await requestMeta();
  const admin = createAdminClient();
  const { data: previous, error } = await admin.rpc("record_referral_revocation", {
    p_user_id: params.userId,
    p_referral_id: params.referralId,
    p_text_version: REFERRAL_REVOKE_VERSION,
    p_text_hash: sha256(REFERRAL_REVOKE_TEXT),
    p_ip_hash: meta.ipHash,
    p_user_agent: meta.userAgent,
  });
  if (error) throw new ReferralError("not_found", "연결 내역을 찾을 수 없습니다.");
  if (previous === "sent") {
    const { data: ref } = await admin
      .from("referrals")
      .select("partner_id, sent_at")
      .eq("id", params.referralId)
      .maybeSingle();
    const { data: partner } = ref
      ? await admin
          .from("partners")
          .select("name, contact_email")
          .eq("id", ref.partner_id)
          .maybeSingle()
      : { data: null };
    if (partner) {
      await sendEmail(
        "referral_revoked_partner",
        params.userId,
        referralRevokedEmail({
          to: partner.contact_email,
          partnerName: partner.name,
          candidateLabel: params.candidateLabel,
          sentAt: ref?.sent_at
            ? new Intl.DateTimeFormat("ko-KR", {
                dateStyle: "long",
                timeZone: "Asia/Seoul",
              }).format(new Date(ref.sent_at))
            : null,
        }),
      );
    }
  }
  await trackEvent("referral.revoked", { was: previous ?? null });
  return previous;
}

/** 계정 삭제 전에 진행 중인 리퍼럴을 모두 철회한다 */
export async function revokeAllReferrals(userId: string, candidateLabel: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("referrals")
    .select("id")
    .eq("user_id", userId)
    .in("status", ["consented", "sent"]);
  for (const r of data ?? []) await revokeReferral({ userId, referralId: r.id, candidateLabel });
}
