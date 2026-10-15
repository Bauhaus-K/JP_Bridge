/** 공유 항목 인코딩: 'profile' | 'es:<문서 id>' | 'career:<경력 번역 id>' */
export type SharedItem =
  { kind: "profile" } | { kind: "es"; id: string } | { kind: "career"; id: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function encodeItem(item: SharedItem): string {
  return item.kind === "profile" ? "profile" : `${item.kind}:${item.id}`;
}

export function decodeItem(value: string): SharedItem | null {
  if (value === "profile") return { kind: "profile" };
  const [kind, id] = value.split(":");
  if ((kind === "es" || kind === "career") && id && UUID.test(id)) return { kind, id };
  return null;
}

export const COUNTRY_LABELS: Record<string, string> = { JP: "일본", KR: "대한민국" };

export const PROFILE_ITEM_LABEL =
  "기본 프로필 (이름, 이메일, 준비 유형, 일본어 수준, 졸업 예정 시기 또는 경력 연차, 목표 입사 시기, 희망 직종)";

/** 동의 문구에 들어갈 사람이 읽는 항목 목록 */
export function describeItems(items: SharedItem[], titles: Record<string, string>): string {
  return items
    .map((i) =>
      i.kind === "profile"
        ? PROFILE_ITEM_LABEL
        : i.kind === "es"
          ? `ES 최신 버전 「${titles[`es:${i.id}`] ?? "제목 없음"}」`
          : `職務経歴書 「${titles[`career:${i.id}`] ?? "제목 없음"}」`,
    )
    .join(", ");
}
