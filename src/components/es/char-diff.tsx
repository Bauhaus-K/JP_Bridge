import type { CharPart } from "@/lib/text/diff";

/** 글자 단위 변경 하이라이트. 색에만 의존하지 않도록 ins/del 시맨틱을 쓴다. */
export function CharDiff({ parts, side }: { parts: CharPart[]; side: "before" | "after" }) {
  return (
    <>
      {parts.map((p, i) => {
        if (p.added) {
          return side === "after" ? (
            <ins key={i} className="rounded-sm bg-primary/15 text-foreground no-underline">
              {p.value}
            </ins>
          ) : null;
        }
        if (p.removed) {
          return side === "before" ? (
            <del key={i} className="rounded-sm bg-destructive/15 text-foreground">
              {p.value}
            </del>
          ) : null;
        }
        return <span key={i}>{p.value}</span>;
      })}
    </>
  );
}
