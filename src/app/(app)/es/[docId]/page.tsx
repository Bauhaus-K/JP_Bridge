import { ArrowLeft, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { EpisodePicker } from "@/components/es/episode-picker";
import { QuotaBadge } from "@/components/es/quota-badge";
import { VersionHistory } from "@/components/es/version-history";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getAfterRatings,
  getEpisodesForDoc,
  getQuotaStatus,
  listReviewRequests,
  listVersions,
} from "@/lib/es/queries";
import { toReviewView } from "@/lib/es/review-view";
import { getEsDocument } from "@/lib/es/service";
import { QUESTION_TYPE_OPTIONS } from "@/lib/validation/es";
import { deleteEsDocument, setEsEpisodes } from "../actions";
import { EsWorkspace } from "./es-workspace";

export const metadata: Metadata = { title: "ES 작성·첨삭" };

export default async function EsDetailPage({ params, searchParams }: PageProps<"/es/[docId]">) {
  const { docId } = await params;
  const { v } = await searchParams;
  const doc = await getEsDocument(docId);
  if (!doc) notFound();

  const [versions, quota, episodeData] = await Promise.all([
    listVersions(doc.id),
    getQuotaStatus(),
    getEpisodesForDoc(doc.id),
  ]);
  const selected = versions.find((x) => x.id === v) ?? versions[0] ?? null;

  // 선택 버전의 첨삭 결과: AI 버전이면 자기 자신, 사용자 버전이면 그 버전을 첨삭한 최신 AI 버전
  const reviewVersion =
    selected?.source === "ai"
      ? selected
      : (versions.find((x) => x.source === "ai" && x.parent_version_id === selected?.id) ?? null);
  const review = reviewVersion ? toReviewView(reviewVersion) : null;

  const [requests, ratings] = await Promise.all([
    listReviewRequests(versions.map((x) => x.id)),
    getAfterRatings(review ? [review.aiVersionId] : []),
  ]);
  const openReviewRequest = Boolean(
    selected &&
    requests.some(
      (r) => r.target_id === selected.id && (r.status === "pending" || r.status === "in_review"),
    ),
  );
  const questionLabel =
    QUESTION_TYPE_OPTIONS.find((q) => q.value === doc.question_type)?.label ?? "";

  return (
    <div className="grid gap-6">
      <div className="grid gap-3">
        <Link
          href="/es"
          className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:underline"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          ES 목록
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{questionLabel}</Badge>
              {doc.char_limit ? <Badge variant="outline">{doc.char_limit}자 이내</Badge> : null}
              {doc.company ? <Badge variant="outline">{doc.company}</Badge> : null}
            </div>
            <h1 className="text-2xl font-semibold">{doc.title}</h1>
            {doc.question_text ? (
              <p lang="ja" className="text-sm text-muted-foreground">
                {doc.question_text}
              </p>
            ) : null}
          </div>
          <QuotaBadge quota={quota} />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_16rem]">
        <EsWorkspace
          key={selected?.id ?? "new"}
          docId={doc.id}
          charLimit={doc.char_limit}
          questionLabel={questionLabel}
          baseVersionId={selected?.id ?? null}
          baseContent={selected?.content ?? ""}
          review={review}
          reviewRating={review ? (ratings[review.aiVersionId] ?? null) : null}
          openReviewRequest={openReviewRequest}
          reviewRemaining={quota ? Math.max(quota.review_limit - quota.review_used, 0) : 0}
        />
        <aside className="grid content-start gap-3">
          <EpisodePicker
            docId={doc.id}
            episodes={episodeData.episodes}
            linked={episodeData.linked}
            action={setEsEpisodes}
          />
          <h2 className="text-sm font-semibold">버전 히스토리</h2>
          <VersionHistory
            docId={doc.id}
            versions={versions}
            selectedId={selected?.id ?? null}
            requests={requests}
          />
          {versions.length >= 2 ? (
            <Link
              href={`/es/${doc.id}/compare`}
              className="text-sm text-primary underline-offset-4 hover:underline"
            >
              버전 비교하기
            </Link>
          ) : null}
          <form action={deleteEsDocument} className="mt-4 border-t pt-4">
            <input type="hidden" name="docId" value={doc.id} />
            <Button type="submit" variant="ghost" size="sm" className="text-destructive">
              <Trash2 aria-hidden="true" />이 ES 삭제
            </Button>
          </form>
        </aside>
      </div>
    </div>
  );
}
