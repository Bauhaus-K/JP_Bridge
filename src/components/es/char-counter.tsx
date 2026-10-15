import { cn } from "@/lib/utils";
import { LIMIT_STATUS_MESSAGE, limitStatus } from "@/lib/text/char-count";

export function CharCounter({
  count,
  limit,
  id,
  className,
}: {
  count: number;
  limit: number | null;
  id?: string;
  className?: string;
}) {
  const status = limitStatus(count, limit);
  return (
    <div
      id={id}
      className={cn("flex flex-wrap items-center justify-between gap-2 text-sm", className)}
    >
      <span
        className={cn(
          "font-medium tabular-nums",
          status === "over" && "text-destructive",
          status === "under" && "text-warning-foreground",
        )}
        aria-live="polite"
      >
        {count}자{limit ? ` / ${limit}자` : ""}
        {status === "over" && limit ? ` (${count - limit}자 초과)` : ""}
      </span>
      {limit && status !== "ok" && status !== "empty" ? (
        <span
          className={cn(
            "text-xs",
            status === "over" ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {LIMIT_STATUS_MESSAGE[status]}
        </span>
      ) : null}
    </div>
  );
}
