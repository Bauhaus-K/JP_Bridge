import Link from "next/link";

import { Button } from "@/components/ui/button";
import type { Episode } from "@/lib/db/database.types";

/** ES 첨삭 시 참고할 에피소드 카드 선택 (최대 5개). 서버 액션 폼. */
export function EpisodePicker({
  docId,
  episodes,
  linked,
  action,
}: {
  docId: string;
  episodes: Episode[];
  linked: string[];
  action: (formData: FormData) => Promise<void>;
}) {
  return (
    <details className="rounded-lg border p-3 text-sm" open={linked.length > 0}>
      <summary className="cursor-pointer font-medium">
        참고 에피소드 {linked.length ? `(${linked.length})` : ""}
      </summary>
      {episodes.length === 0 ? (
        <p className="mt-2 text-muted-foreground">
          <Link href="/analysis" className="text-primary underline-offset-4 hover:underline">
            자기분석
          </Link>
          에서 카드를 만들면 첨삭에 참고 자료로 쓸 수 있어요.
        </p>
      ) : (
        <form action={action} className="mt-2 grid gap-2">
          <input type="hidden" name="docId" value={docId} />
          <p className="text-xs text-muted-foreground">
            선택한 카드의 사실만 AI가 활용합니다 (최대 5개).
          </p>
          <fieldset className="grid gap-1.5">
            <legend className="sr-only">참고할 에피소드</legend>
            {episodes.map((e) => (
              <label key={e.id} className="flex items-start gap-2">
                <input
                  type="checkbox"
                  name="episodeIds"
                  value={e.id}
                  defaultChecked={linked.includes(e.id)}
                  className="mt-0.5 size-4 accent-primary"
                />
                <span>{e.title}</span>
              </label>
            ))}
          </fieldset>
          <Button type="submit" size="sm" variant="outline" className="w-fit">
            선택 저장
          </Button>
        </form>
      )}
    </details>
  );
}
