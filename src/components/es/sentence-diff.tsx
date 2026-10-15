import { diffSentences, diffStats } from "@/lib/text/diff";
import { CharDiff } from "./char-diff";

export function SentenceDiff({ before, after }: { before: string; after: string }) {
  const rows = diffSentences(before, after);
  const stats = diffStats(rows);
  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        변경 {stats.changed}문장 · 추가 {stats.added}문장 · 삭제 {stats.removed}문장
      </p>
      <ol lang="ja" className="grid gap-2">
        {rows.map((r, i) => {
          if (r.type === "same") {
            return (
              <li key={i} className="rounded-md px-3 py-2 text-sm text-muted-foreground">
                {r.text}
              </li>
            );
          }
          if (r.type === "changed") {
            return (
              <li key={i} className="grid gap-1 rounded-md border px-3 py-2 text-sm">
                <p>
                  <span className="sr-only">변경 전: </span>
                  <span aria-hidden="true" className="mr-2 text-xs text-destructive">
                    전
                  </span>
                  <CharDiff parts={r.parts} side="before" />
                </p>
                <p>
                  <span className="sr-only">변경 후: </span>
                  <span aria-hidden="true" className="mr-2 text-xs text-primary">
                    후
                  </span>
                  <CharDiff parts={r.parts} side="after" />
                </p>
              </li>
            );
          }
          return (
            <li
              key={i}
              className={
                r.type === "added"
                  ? "rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm"
                  : "rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm line-through"
              }
            >
              <span className="sr-only">{r.type === "added" ? "추가: " : "삭제: "}</span>
              {r.text}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
