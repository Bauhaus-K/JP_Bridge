import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

export const LEGAL_DOCS = {
  "ai-notice": "AI 활용 안내",
  privacy: "개인정보처리방침",
  terms: "이용약관",
} as const;

export type LegalSlug = keyof typeof LEGAL_DOCS;

export function isLegalSlug(slug: string): slug is LegalSlug {
  return Object.hasOwn(LEGAL_DOCS, slug);
}

/** 빌드 시 정적 생성되는 페이지에서만 호출한다 (generateStaticParams). */
export async function readLegalDoc(slug: LegalSlug): Promise<string> {
  return readFile(path.join(process.cwd(), "src/content/legal", `${slug}.md`), "utf8");
}
