import { diffArrays, diffChars } from "diff";

import { splitSentences } from "./sentences";

export type CharPart = { value: string; added?: boolean; removed?: boolean };

export type SentenceDiffRow =
  | { type: "same"; text: string }
  | { type: "added"; text: string }
  | { type: "removed"; text: string }
  | { type: "changed"; before: string; after: string; parts: CharPart[] };

/**
 * 두 텍스트를 문장 단위로 비교한다.
 * 삭제 직후 추가가 이어지면 '변경'으로 묶고 글자 단위 하이라이트를 계산한다.
 */
export function diffSentences(before: string, after: string): SentenceDiffRow[] {
  const changes = diffArrays(splitSentences(before), splitSentences(after));
  const rows: SentenceDiffRow[] = [];

  for (let i = 0; i < changes.length; i++) {
    const c = changes[i];
    if (!c.added && !c.removed) {
      c.value.forEach((text) => rows.push({ type: "same", text }));
      continue;
    }
    const next = changes[i + 1];
    if (c.removed && next?.added) {
      const n = Math.max(c.value.length, next.value.length);
      for (let j = 0; j < n; j++) {
        const b = c.value[j];
        const a = next.value[j];
        if (b !== undefined && a !== undefined) {
          rows.push({ type: "changed", before: b, after: a, parts: diffChars(b, a) });
        } else if (b !== undefined) {
          rows.push({ type: "removed", text: b });
        } else if (a !== undefined) {
          rows.push({ type: "added", text: a });
        }
      }
      i++;
      continue;
    }
    c.value.forEach((text) => rows.push({ type: c.added ? "added" : "removed", text }));
  }
  return rows;
}

export function diffStats(rows: SentenceDiffRow[]) {
  return rows.reduce(
    (acc, r) => {
      if (r.type !== "same") acc[r.type] += 1;
      return acc;
    },
    { added: 0, removed: 0, changed: 0 },
  );
}
