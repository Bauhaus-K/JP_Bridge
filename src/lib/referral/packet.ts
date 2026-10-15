import "server-only";

import { careerTranslationSchema, type CareerOutput } from "@/lib/ai/schemas/career";
import { careerToPlainText } from "@/lib/career/format";
import { createAdminClient } from "@/lib/db/admin";
import { formatYearMonthKo } from "@/lib/dates";
import { getUserEmail } from "@/lib/email/send";
import { JLPT_OPTIONS, PERSONA_OPTIONS } from "@/lib/validation/onboarding";
import { decodeItem } from "./items";

export type ReferralPacket = {
  profile: { name: string; email: string | null; lines: string[] } | null;
  es: { title: string; company: string | null; question: string | null; content: string }[];
  career: { title: string; text: string }[];
};

/**
 * 동의한 항목만으로 제휴사 전달 자료를 만든다.
 * 사용자가 동의한 범위의 데이터이므로 service_role 로 읽되, 항목 목록(shared_items)에 있는 것만 포함한다.
 */
export async function buildReferralPacket(
  userId: string,
  sharedItems: string[],
): Promise<ReferralPacket> {
  const admin = createAdminClient();
  const items = sharedItems.map(decodeItem).filter((i) => i !== null);
  const packet: ReferralPacket = { profile: null, es: [], career: [] };

  if (items.some((i) => i.kind === "profile")) {
    const { data: p } = await admin
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (p) {
      packet.profile = {
        name: p.display_name ?? "",
        email: await getUserEmail(userId),
        lines: [
          `준비 유형: ${PERSONA_OPTIONS.find((o) => o.value === p.persona_type)?.label ?? "-"}`,
          `일본어: JLPT ${JLPT_OPTIONS.find((o) => o.value === p.jlpt_level)?.label ?? "-"}`,
          p.graduation_date
            ? `졸업 (예정): ${formatYearMonthKo(p.graduation_date)}`
            : `경력: ${p.career_years ?? "-"}년`,
          `목표 입사: ${formatYearMonthKo(p.target_start)}`,
          `희망 직종: ${p.desired_roles.join(", ")}`,
        ],
      };
    }
  }
  for (const item of items) {
    if (item.kind === "es") {
      const { data: doc } = await admin
        .from("es_documents")
        .select("title, company, question_text")
        .eq("id", item.id)
        .eq("user_id", userId)
        .maybeSingle();
      const { data: version } = await admin
        .from("es_versions")
        .select("content")
        .eq("doc_id", item.id)
        .eq("user_id", userId)
        .in("source", ["user", "admin"])
        .order("version_no", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (doc && version) {
        packet.es.push({
          title: doc.title,
          company: doc.company,
          question: doc.question_text,
          content: version.content,
        });
      }
    } else if (item.kind === "career") {
      const { data } = await admin
        .from("career_translations")
        .select("title, output")
        .eq("id", item.id)
        .eq("user_id", userId)
        .maybeSingle();
      const parsed = careerTranslationSchema.safeParse(data?.output);
      if (data && parsed.success) {
        packet.career.push({
          title: data.title,
          text: careerToPlainText({ ...parsed.data, ...(data.output as object) } as CareerOutput),
        });
      }
    }
  }
  return packet;
}

export function packetToText(packet: ReferralPacket): string {
  const parts: string[] = [];
  if (packet.profile) {
    parts.push(
      [
        "■ 프로필",
        `이름: ${packet.profile.name}`,
        `이메일: ${packet.profile.email ?? "-"}`,
        ...packet.profile.lines,
      ].join("\n"),
    );
  }
  for (const es of packet.es) {
    parts.push(
      [
        `■ ES: ${es.title}${es.company ? ` (${es.company})` : ""}`,
        es.question ? `設問: ${es.question}` : "",
        es.content,
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }
  for (const c of packet.career) parts.push([`■ 職務経歴書: ${c.title}`, c.text].join("\n"));
  return parts.join("\n\n");
}
