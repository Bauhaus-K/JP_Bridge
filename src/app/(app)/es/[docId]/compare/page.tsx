import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SentenceDiff } from "@/components/es/sentence-diff";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { listVersions } from "@/lib/es/queries";
import { getEsDocument } from "@/lib/es/service";

export const metadata: Metadata = { title: "버전 비교" };

const SOURCE_LABEL = { user: "내 작성", ai: "AI 첨삭본", admin: "운영자 수정본" } as const;

export default async function EsComparePage({
  params,
  searchParams,
}: PageProps<"/es/[docId]/compare">) {
  const { docId } = await params;
  const sp = await searchParams;
  const doc = await getEsDocument(docId);
  if (!doc) notFound();
  const versions = await listVersions(doc.id);

  const b = versions.find((x) => x.id === sp.b) ?? versions[0];
  const a =
    versions.find((x) => x.id === sp.a) ??
    versions.find((x) => x.id === b?.parent_version_id) ??
    versions.find((x) => b && x.version_no < b.version_no);

  const option = (v: (typeof versions)[number]) => (
    <option key={v.id} value={v.id}>
      v{v.version_no} · {SOURCE_LABEL[v.source]} · {v.char_count}자
    </option>
  );

  return (
    <div className="grid gap-6">
      <Link
        href={`/es/${doc.id}`}
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {doc.title}
      </Link>
      <h1 className="text-2xl font-semibold">버전 비교</h1>

      {versions.length < 2 || !a || !b ? (
        <p className="text-muted-foreground">비교하려면 버전이 2개 이상 필요합니다.</p>
      ) : (
        <>
          <form className="flex flex-wrap items-end gap-3" method="get">
            <div className="grid gap-1.5">
              <Label htmlFor="a">이전</Label>
              <Select id="a" name="a" defaultValue={a.id} className="w-64">
                {versions.map(option)}
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="b">이후</Label>
              <Select id="b" name="b" defaultValue={b.id} className="w-64">
                {versions.map(option)}
              </Select>
            </div>
            <Button type="submit" variant="outline">
              비교
            </Button>
          </form>
          <h2 className="text-lg font-semibold">
            v{a.version_no} → v{b.version_no}
          </h2>
          <SentenceDiff before={a.content} after={b.content} />
        </>
      )}
    </div>
  );
}
