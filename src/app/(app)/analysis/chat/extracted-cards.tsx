"use client";

import { HelpCircle } from "lucide-react";
import { useState, useTransition } from "react";

import { AiDisclaimer } from "@/components/ai/ai-disclaimer";
import { EpisodeFields } from "@/components/analysis/episode-fields";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { EpisodeExtraction, EpisodeInput } from "@/lib/ai/schemas/episode";
import { episodeFormToObject } from "@/lib/validation/episode";
import { saveExtractedEpisodes } from "../actions";

export function ExtractedCards({
  conversationId,
  extraction,
  onDismiss,
}: {
  conversationId: string;
  extraction: EpisodeExtraction;
  onDismiss: () => void;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <section
      aria-labelledby="extracted-heading"
      className="grid gap-3 rounded-xl border bg-card p-4"
      data-testid="extracted-cards"
    >
      <h2 id="extracted-heading" className="font-semibold">
        정리된 카드 {extraction.episodes.length}개
      </h2>
      <AiDisclaimer />
      {extraction.missing_info_ko.length > 0 ? (
        <div className="grid gap-1 rounded-lg bg-accent/50 p-3 text-sm">
          <p className="flex items-center gap-1.5 font-medium">
            <HelpCircle aria-hidden="true" className="size-4" />더 알려주시면 좋아요
          </p>
          <ul className="list-disc pl-5">
            {extraction.missing_info_ko.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {extraction.episodes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          아직 카드로 만들 만큼 구체적인 이야기가 없어요. 대화를 조금 더 이어가 보세요.
        </p>
      ) : (
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const episodes: EpisodeInput[] = [];
            form.querySelectorAll<HTMLFieldSetElement>("fieldset[data-card]").forEach((fs) => {
              const include = fs.querySelector<HTMLInputElement>("input[name=include]");
              if (!include?.checked) return;
              const fd = new FormData();
              fs.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
                "input[name], textarea[name]",
              ).forEach((el) => fd.append(el.name, el.value));
              episodes.push(episodeFormToObject(fd));
            });
            if (episodes.length === 0) {
              setMessage("저장할 카드를 하나 이상 선택해 주세요.");
              return;
            }
            startTransition(async () => {
              const res = await saveExtractedEpisodes({ conversationId, episodes });
              if (res && !res.ok) setMessage(res.message);
            });
          }}
        >
          {extraction.episodes.map((ep, i) => (
            <fieldset key={i} data-card className="grid gap-3 rounded-lg border p-3">
              <legend className="px-1 text-sm font-medium">카드 {i + 1}</legend>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="include"
                  defaultChecked
                  className="size-4 accent-primary"
                />
                이 카드 저장
              </label>
              <EpisodeFields idPrefix={`card-${i}`} initial={ep} />
            </fieldset>
          ))}
          {message ? <Alert variant="destructive">{message}</Alert> : null}
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              선택한 카드 저장
            </Button>
            <Button type="button" variant="ghost" onClick={onDismiss}>
              닫기
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
