/**
 * 일본 ES 글자 수 계산 (DECISIONS D1)
 * - 기본: 화면에 보이는 글자(grapheme) 1개 = 1자. 전각·반각 구분 없음 (대부분의 エントリーフォーム 방식)
 * - halfWidthAsHalf: 반각 영숫자·기호·반각 가나를 0.5자로 계산 (원고지식 규정 대응)
 * - 줄바꿈은 기본 제외 (includeNewlines 로 포함 가능)
 */
export type CharCountOptions = {
  halfWidthAsHalf?: boolean;
  includeNewlines?: boolean;
};

const segmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter("ja", { granularity: "grapheme" })
    : null;

function graphemes(text: string): string[] {
  if (segmenter) return Array.from(segmenter.segment(text), (s) => s.segment);
  return Array.from(text);
}

/** 반각 문자: ASCII 출력 문자(공백 포함)와 반각 가나(U+FF61–U+FF9F) */
export function isHalfWidth(grapheme: string): boolean {
  if (grapheme.length !== 1) return false;
  const code = grapheme.charCodeAt(0);
  return (code >= 0x20 && code <= 0x7e) || (code >= 0xff61 && code <= 0xff9f);
}

export function countChars(text: string, options: CharCountOptions = {}): number {
  const normalized = text.replace(/\r\n?/g, "\n");
  let total = 0;
  for (const g of graphemes(normalized)) {
    if (g === "\n") {
      if (options.includeNewlines) total += 1;
      continue;
    }
    total += options.halfWidthAsHalf && isHalfWidth(g) ? 0.5 : 1;
  }
  return total;
}

export type LimitStatus = "empty" | "under" | "ok" | "over";

/** 글자 수 제한 대비 상태. 90% 미만은 'under'(일본 ES 관행상 8~9할 이상 권장). */
export function limitStatus(count: number, limit: number | null | undefined): LimitStatus {
  if (count === 0) return "empty";
  if (!limit) return "ok";
  if (count > limit) return "over";
  if (count < limit * 0.9) return "under";
  return "ok";
}

export const LIMIT_STATUS_MESSAGE: Record<LimitStatus, string> = {
  empty: "내용을 입력해 주세요.",
  under: "제한의 90% 미만입니다. 일본 ES는 보통 제한의 8~9할 이상을 채우는 것을 권장합니다.",
  ok: "적정 분량입니다.",
  over: "글자 수 제한을 초과했습니다.",
};
