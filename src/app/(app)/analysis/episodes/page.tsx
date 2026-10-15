import { ArrowLeft, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/db/server";
import { EpisodeCard, NewEpisodeForm } from "./episode-forms";

export const metadata: Metadata = { title: "에피소드 카드" };

export default async function EpisodesPage({ searchParams }: PageProps<"/analysis/episodes">) {
  const { saved } = await searchParams;
  const supabase = await createClient();
  const { data: episodes } = await supabase
    .from("episodes")
    .select("*")
    .order("updated_at", { ascending: false });

  return (
    <div className="grid gap-6">
      <Link
        href="/analysis"
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        자기분석
      </Link>
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold">에피소드 카드</h1>
        <p className="text-muted-foreground">
          ES 첨삭과 모의면접에서 참고 자료로 선택할 수 있습니다. 카드에 적힌 사실만 AI가 활용합니다.
        </p>
      </div>
      {saved ? <Alert variant="info">카드를 저장했습니다.</Alert> : null}

      <details className="rounded-xl border bg-card p-4">
        <summary className="flex cursor-pointer items-center gap-2 font-medium">
          <Plus aria-hidden="true" className="size-4" />
          직접 카드 추가
        </summary>
        <div className="mt-4">
          <NewEpisodeForm />
        </div>
      </details>

      {!episodes?.length ? (
        <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
          아직 카드가 없습니다. 자기분석 대화 후 “카드로 정리”를 누르거나 직접 추가해 보세요.
        </p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {episodes.map((e) => (
            <li key={e.id}>
              <EpisodeCard episode={e}>
                <div className="flex flex-wrap gap-1">
                  {e.strengths.map((s) => (
                    <Badge key={s}>{s}</Badge>
                  ))}
                  {e.keywords.map((k) => (
                    <Badge key={k} variant="outline" lang="ja">
                      {k}
                    </Badge>
                  ))}
                </div>
              </EpisodeCard>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
