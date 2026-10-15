import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Markdown } from "@/components/markdown";
import { Alert } from "@/components/ui/alert";
import { isLegalSlug, LEGAL_DOCS, readLegalDoc } from "@/lib/content/legal";

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(LEGAL_DOCS).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/legal/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  return { title: isLegalSlug(slug) ? LEGAL_DOCS[slug] : "문서" };
}

export default async function LegalPage({ params }: PageProps<"/legal/[slug]">) {
  const { slug } = await params;
  if (!isLegalSlug(slug)) notFound();
  const source = await readLegalDoc(slug);
  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <Alert variant="warning" className="mb-6">
        <strong>법률 검토 필요</strong> — 이 문서는 MVP용 플레이스홀더입니다. 정식 서비스 전에 법률
        전문가의 검토를 거쳐 교체해야 합니다.
      </Alert>
      <Markdown source={source} />
    </article>
  );
}
