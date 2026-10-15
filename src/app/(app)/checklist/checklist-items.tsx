"use client";

import { useOptimistic, useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { dueLabel, dueStatus } from "@/lib/checklist/schedule";
import { CATEGORY_LABELS, type ChecklistCategory } from "@/lib/checklist/templates";
import type { ChecklistItem } from "@/lib/db/database.types";
import { cn } from "@/lib/utils";
import { toggleChecklistItem } from "./actions";

const CATEGORIES: ChecklistCategory[] = ["schedule", "documents", "visa"];

export function ChecklistItems({ items, today }: { items: ChecklistItem[]; today: string }) {
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [, start] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(
    items,
    (state, update: { id: string; done: boolean }) =>
      state.map((i) =>
        i.id === update.id ? { ...i, done_at: update.done ? new Date().toISOString() : null } : i,
      ),
  );
  const doneCount = optimistic.filter((i) => i.done_at).length;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm" aria-live="polite">
          {doneCount} / {optimistic.length} 완료
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={onlyOpen}
            onChange={(e) => setOnlyOpen(e.target.checked)}
            className="size-4 accent-primary"
          />
          미완료만 보기
        </label>
      </div>
      <div
        role="progressbar"
        aria-label="체크리스트 진행률"
        aria-valuemin={0}
        aria-valuemax={optimistic.length}
        aria-valuenow={doneCount}
        className="h-2 overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${(doneCount / Math.max(optimistic.length, 1)) * 100}%` }}
        />
      </div>
      {CATEGORIES.map((cat) => {
        const list = optimistic.filter((i) => i.category === cat && (!onlyOpen || !i.done_at));
        if (list.length === 0) return null;
        return (
          <section key={cat} aria-labelledby={`cat-${cat}`} className="grid gap-2">
            <h2 id={`cat-${cat}`} className="font-semibold">
              {CATEGORY_LABELS[cat]}
            </h2>
            <ul className="grid gap-2">
              {list.map((item) => {
                const status = dueStatus(item, today);
                return (
                  <li
                    key={item.id}
                    className={cn("rounded-lg border bg-card p-3", item.done_at && "opacity-60")}
                  >
                    <label className="flex cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        checked={Boolean(item.done_at)}
                        onChange={(e) => {
                          const done = e.target.checked;
                          start(async () => {
                            setOptimistic({ id: item.id, done });
                            await toggleChecklistItem(item.id, done);
                          });
                        }}
                        className="mt-1 size-4 accent-primary"
                      />
                      <span className="grid flex-1 gap-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className={cn("font-medium", item.done_at && "line-through")}>
                            {item.title}
                          </span>
                          {item.due_date ? (
                            <Badge
                              variant={
                                status === "overdue"
                                  ? "default"
                                  : status === "soon"
                                    ? "warning"
                                    : "outline"
                              }
                              className={
                                status === "overdue"
                                  ? "bg-destructive text-destructive-foreground"
                                  : undefined
                              }
                            >
                              {item.due_date.slice(0, 7).replace("-", ".")} ·{" "}
                              {dueLabel(item.due_date, today)}
                            </Badge>
                          ) : null}
                        </span>
                        {item.description ? (
                          <span className="text-sm text-muted-foreground">{item.description}</span>
                        ) : null}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
