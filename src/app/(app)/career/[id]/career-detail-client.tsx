"use client";

import { Check, Copy, HelpCircle, Pencil, Send } from "lucide-react";
import { useState, useTransition } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { controlClass } from "@/components/ui/input";
import type { CareerOutput } from "@/lib/ai/schemas/career";
import { cn } from "@/lib/utils";
import { requestCareerReview, saveCareerEdit } from "../actions";

type Props = {
  id: string;
  output: CareerOutput;
  plainText: string;
  input: string;
  openRequest: boolean;
  adminComment: string | null;
  reviewRemaining: number;
};

export function CareerDetailClient(props: Props) {
  const { output } = props;
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(props.plainText);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const edited = Boolean(output.edited_text_ja?.trim());

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <section aria-labelledby="doc-heading" className="grid content-start gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="doc-heading" className="text-lg font-semibold">
            職務経歴書{" "}
            {edited ? (
              <span className="text-sm font-normal text-muted-foreground">(편집본)</span>
            ) : null}
          </h2>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={async () => {
                await navigator.clipboard?.writeText(text).catch(() => undefined);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
              {copied ? "복사됨" : "텍스트 복사"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setEditing((v) => !v)}
              aria-expanded={editing}
            >
              <Pencil aria-hidden="true" />
              {editing ? "편집 닫기" : "편집"}
            </Button>
          </div>
        </div>

        {editing ? (
          <div className="grid gap-2">
            <label htmlFor="career-edit" className="sr-only">
              職務経歴書 편집
            </label>
            <textarea
              id="career-edit"
              lang="ja"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={24}
              className={cn(controlClass, "py-3 font-mono text-sm leading-7")}
            />
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await saveCareerEdit({ id: props.id, text });
                    setNotice(res.ok ? "편집본을 저장했습니다." : res.message);
                    if (res.ok) setEditing(false);
                  })
                }
              >
                저장
              </Button>
            </div>
          </div>
        ) : edited ? (
          <pre
            lang="ja"
            className="whitespace-pre-wrap rounded-lg border bg-card p-4 font-sans text-sm leading-7"
          >
            {text}
          </pre>
        ) : (
          <article
            lang="ja"
            className="grid gap-5 rounded-lg border bg-card p-4 text-sm leading-7"
            data-testid="career-doc"
          >
            <section>
              <h3 className="font-semibold">■職務要約</h3>
              <p className="whitespace-pre-wrap">{output.shokumu_youyaku_ja}</p>
            </section>
            <section className="grid gap-3">
              <h3 className="font-semibold">■職務内容</h3>
              {output.shokumu_naiyou.map((job, i) => (
                <div key={i} className="grid gap-1 rounded-md bg-muted/40 p-3">
                  <p className="font-medium">
                    {job.period}　{job.company_ja}
                  </p>
                  <p>{job.position_ja}</p>
                  {job.duties_ja.length ? (
                    <>
                      <p className="mt-1 text-xs text-muted-foreground">【担当業務】</p>
                      <ul className="list-disc pl-5">
                        {job.duties_ja.map((d, j) => (
                          <li key={j}>{d}</li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                  {job.achievements_ja.length ? (
                    <>
                      <p className="mt-1 text-xs text-muted-foreground">【実績】</p>
                      <ul className="list-disc pl-5">
                        {job.achievements_ja.map((a, j) => (
                          <li key={j}>{a}</li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                </div>
              ))}
            </section>
            {output.ikaseru_keiken_ja.length ? (
              <section>
                <h3 className="font-semibold">■活かせる経験・知識</h3>
                <ul className="list-disc pl-5">
                  {output.ikaseru_keiken_ja.map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              </section>
            ) : null}
            {output.chishiki_gijutsu_ja.length ? (
              <section>
                <h3 className="font-semibold">■技術・スキル</h3>
                <ul className="list-disc pl-5">
                  {output.chishiki_gijutsu_ja.map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              </section>
            ) : null}
          </article>
        )}
        {notice ? (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {notice}
          </p>
        ) : null}

        <details className="rounded-lg border p-3 text-sm">
          <summary className="cursor-pointer font-medium">원문 (한국어) 보기</summary>
          <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{props.input}</p>
        </details>
      </section>

      <aside className="grid content-start gap-4">
        {props.adminComment ? (
          <Alert variant="info">
            <p className="font-medium">운영자 검수 코멘트</p>
            <p className="mt-1 whitespace-pre-wrap">{props.adminComment}</p>
          </Alert>
        ) : null}
        {output.term_notes.length ? (
          <section
            aria-labelledby="terms-heading"
            className="grid gap-2 rounded-lg border bg-card p-4"
          >
            <h2 id="terms-heading" className="font-semibold">
              용어 주석
            </h2>
            <ul className="grid gap-2 text-sm">
              {output.term_notes.map((t, i) => (
                <li key={i} className="grid gap-0.5">
                  <span>
                    <strong>{t.source_ko}</strong> → <span lang="ja">{t.ja}</span>
                  </span>
                  <span className="text-muted-foreground">{t.note_ko}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {output.questions_ko.length ? (
          <section className="grid gap-2 rounded-lg border border-accent bg-accent/40 p-4 text-sm">
            <h2 className="flex items-center gap-1.5 font-semibold">
              <HelpCircle aria-hidden="true" className="size-4" />
              확인이 필요한 점
            </h2>
            <ul className="list-disc pl-5">
              {output.questions_ko.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ul>
          </section>
        ) : null}
        <div className="grid gap-2 rounded-lg border bg-card p-4 text-sm">
          <h2 className="font-semibold">운영자 검수</h2>
          {props.openRequest ? (
            <p className="text-muted-foreground">
              검수 대기 중입니다. 완료되면 이메일로 알려드립니다.
            </p>
          ) : (
            <>
              <p className="text-muted-foreground">이번 달 남은 요청: {props.reviewRemaining}회</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-fit"
                disabled={pending || props.reviewRemaining <= 0}
                onClick={() =>
                  start(async () => {
                    const res = await requestCareerReview({ id: props.id });
                    setNotice(res.ok ? "운영자 검수를 요청했습니다." : res.message);
                  })
                }
              >
                <Send aria-hidden="true" />
                검수 요청
              </Button>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
