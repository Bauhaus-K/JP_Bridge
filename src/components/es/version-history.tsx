import { GitCompare } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import type { EsVersion, ReviewRequest } from "@/lib/db/database.types";
import { cn } from "@/lib/utils";

const SOURCE_LABEL = { user: "내 작성", ai: "AI 첨삭본", admin: "운영자 수정본" } as const;

const fmt = new Intl.DateTimeFormat("ko-KR", {
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Seoul",
});

export function VersionHistory({
  docId,
  versions,
  selectedId,
  requests,
}: {
  docId: string;
  versions: EsVersion[];
  selectedId: string | null;
  requests: ReviewRequest[];
}) {
  if (versions.length === 0) {
    return <p className="text-sm text-muted-foreground">아직 저장된 버전이 없습니다.</p>;
  }
  return (
    <ol className="grid gap-1" aria-label="버전 히스토리">
      {versions.map((v) => {
        const active = v.id === selectedId;
        const compareWith =
          v.parent_version_id ?? versions.find((p) => p.version_no === v.version_no - 1)?.id;
        const openReq = requests.find(
          (r) => r.target_id === v.id && (r.status === "pending" || r.status === "in_review"),
        );
        const doneReq = requests.find((r) => r.target_id === v.id && r.status === "done");
        return (
          <li
            key={v.id}
            className={cn("flex items-center gap-1 rounded-md", active && "bg-accent")}
          >
            <Link
              href={`/es/${docId}?v=${v.id}`}
              aria-current={active ? "true" : undefined}
              className="flex min-w-0 flex-1 flex-col gap-0.5 rounded-md px-3 py-2 text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="font-medium">v{v.version_no}</span>
                <Badge variant={v.source === "user" ? "outline" : "secondary"}>
                  {SOURCE_LABEL[v.source]}
                </Badge>
                {openReq ? <Badge variant="warning">검수 대기</Badge> : null}
                {doneReq ? <Badge>검수 완료</Badge> : null}
              </span>
              <span className="text-xs text-muted-foreground">
                {fmt.format(new Date(v.created_at))} · {v.char_count}자
              </span>
            </Link>
            {compareWith ? (
              <Link
                href={`/es/${docId}/compare?a=${compareWith}&b=${v.id}`}
                className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                aria-label={`v${v.version_no}을 이전 버전과 비교`}
                title="이전 버전과 비교"
              >
                <GitCompare aria-hidden="true" className="size-4" />
              </Link>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
