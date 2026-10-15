"use client";

import { Star } from "lucide-react";
import { useState, useTransition } from "react";

import { cn } from "@/lib/utils";

const LABELS = ["전혀 도움 안 됨", "별로", "보통", "도움 됨", "매우 도움 됨"];

export function Rating({
  initial,
  label,
  onRate,
}: {
  initial: number | null;
  label: string;
  onRate: (rating: number) => Promise<{ ok: boolean; message?: string }>;
}) {
  const [value, setValue] = useState<number | null>(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <fieldset className="grid gap-2" disabled={pending}>
      <legend className="text-sm font-medium">{label}</legend>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <label
            key={n}
            className="cursor-pointer rounded-md p-1 has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50"
          >
            <input
              type="radio"
              name={label}
              value={n}
              checked={value === n}
              onChange={() => {
                setValue(n);
                startTransition(async () => {
                  const res = await onRate(n);
                  setMessage(
                    res.ok ? "평가해 주셔서 감사합니다." : (res.message ?? "저장하지 못했습니다."),
                  );
                });
              }}
              className="sr-only"
            />
            <Star
              aria-hidden="true"
              className={cn(
                "size-6",
                value && n <= value ? "fill-primary text-primary" : "text-muted-foreground",
              )}
            />
            <span className="sr-only">
              {n}점 ({LABELS[n - 1]})
            </span>
          </label>
        ))}
      </div>
      {message ? (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {message}
        </p>
      ) : null}
    </fieldset>
  );
}
