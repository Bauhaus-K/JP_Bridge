"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useActionState, useState } from "react";

import { EpisodeFields } from "@/components/analysis/episode-fields";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import type { Episode } from "@/lib/db/database.types";
import { createEpisode, deleteEpisode, updateEpisode, type EpisodeFormState } from "../actions";

export function NewEpisodeForm() {
  const [state, action] = useActionState<EpisodeFormState, FormData>(createEpisode, {});
  return (
    <form action={action} className="grid gap-3">
      <EpisodeFields idPrefix="new" />
      {state.message ? (
        <Alert variant={state.ok ? "info" : "destructive"}>{state.message}</Alert>
      ) : null}
      <SubmitButton className="w-fit">추가</SubmitButton>
    </form>
  );
}

const STAR = [
  ["situation", "상황"],
  ["task", "과제"],
  ["action", "행동"],
  ["result", "결과"],
] as const;

export function EpisodeCard({
  episode,
  children,
}: {
  episode: Episode;
  children?: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [state, action] = useActionState<EpisodeFormState, FormData>(async (prev, fd) => {
    const res = await updateEpisode(prev, fd);
    if (res.ok) setEditing(false);
    return res;
  }, {});

  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-start justify-between gap-2">
        <CardTitle as="h2" className="text-base">
          {episode.title}
        </CardTitle>
        <div className="flex shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`카드 수정: ${episode.title}`}
            aria-expanded={editing}
            onClick={() => setEditing((v) => !v)}
          >
            <Pencil aria-hidden="true" />
          </Button>
          <form action={deleteEpisode}>
            <input type="hidden" name="id" value={episode.id} />
            <Button
              type="submit"
              variant="ghost"
              size="icon"
              aria-label={`카드 삭제: ${episode.title}`}
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </form>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        {editing ? (
          <form action={action} className="grid gap-3">
            <input type="hidden" name="id" value={episode.id} />
            <EpisodeFields idPrefix={`ep-${episode.id}`} initial={episode} />
            {state.message && !state.ok ? (
              <Alert variant="destructive">{state.message}</Alert>
            ) : null}
            <div className="flex gap-2">
              <SubmitButton size="sm">저장</SubmitButton>
              <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
                취소
              </Button>
            </div>
          </form>
        ) : (
          <>
            <dl className="grid gap-2 text-sm">
              {STAR.map(([key, label]) =>
                episode[key] ? (
                  <div key={key} className="grid grid-cols-[3rem_1fr] gap-2">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="whitespace-pre-wrap">{episode[key]}</dd>
                  </div>
                ) : null,
              )}
            </dl>
            {children}
          </>
        )}
      </CardContent>
    </Card>
  );
}
