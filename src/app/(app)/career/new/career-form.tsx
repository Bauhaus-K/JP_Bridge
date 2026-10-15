"use client";

import { AlertTriangle, Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { controlClass, Input } from "@/components/ui/input";
import type { CareerEvent } from "@/lib/career/types";
import { postNdjson } from "@/lib/ndjson";
import { detectPii, maskPii, piiSummary } from "@/lib/pii/detect";
import { cn } from "@/lib/utils";

const PLACEHOLDER = `예)
○○전자 (2021.03 ~ 2024.02) / 정규직
- 경영지원본부 IT팀, 대리
- 사내 ERP 유지보수 및 신규 모듈 개발 (Java, Spring)
- 협력사 포털 리뉴얼 프로젝트 PL, 5명 팀 리드
- 장애 대응 프로세스 개선으로 월 장애 건수 절반으로 감소`;

export function CareerForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [piiConfirmed, setPiiConfirmed] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pii = useMemo(() => detectPii(text), [text]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setProgress(0);
    let resultId: string | null = null;
    await postNdjson<CareerEvent>(
      "/api/ai/career",
      { title, text, targetRole: targetRole || null, piiConfirmed },
      (ev) => {
        if (ev.type === "progress") setProgress(ev.outputChars);
        else if (ev.type === "result") resultId = ev.id;
        else if (ev.type === "error") setError(ev.message);
      },
    );
    setProgress(null);
    if (resultId) router.push(`/career/${resultId}`);
  }

  const busy = progress !== null;
  return (
    <form onSubmit={submit} className="grid gap-5">
      <Field id="career-title" label="제목" required hint="예: ○○전자 IT팀 경력">
        {(aria) => (
          <Input
            {...aria}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={60}
            required
          />
        )}
      </Field>
      <Field
        id="career-role"
        label="지원 희망 직종 (선택)"
        hint="비워 두면 프로필의 희망 직종을 참고합니다."
      >
        {(aria) => (
          <Input
            {...aria}
            value={targetRole}
            onChange={(e) => setTargetRole(e.target.value)}
            maxLength={60}
          />
        )}
      </Field>
      <Field id="career-text" label="경력 내용 (한국어)" required>
        {(aria) => (
          <textarea
            {...aria}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setPiiConfirmed(false);
            }}
            rows={12}
            maxLength={6000}
            placeholder={PLACEHOLDER}
            className={cn(controlClass, "py-3 leading-7")}
          />
        )}
      </Field>
      {pii.length > 0 ? (
        <Alert variant="warning" className="grid gap-2">
          <p className="flex items-center gap-1.5 font-medium">
            <AlertTriangle aria-hidden="true" className="size-4" />
            {piiSummary(pii)}로 보이는 내용이 있습니다.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setText(maskPii(text, pii))}
            >
              마스킹하기
            </Button>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={piiConfirmed}
                onChange={(e) => setPiiConfirmed(e.target.checked)}
                className="size-4 accent-primary"
              />
              민감정보가 아닙니다
            </label>
          </div>
        </Alert>
      ) : null}
      {error ? <Alert variant="destructive">{error}</Alert> : null}
      <div className="flex items-center gap-3">
        <Button
          type="submit"
          disabled={
            busy || !title.trim() || text.trim().length < 20 || (pii.length > 0 && !piiConfirmed)
          }
        >
          {busy ? (
            <Loader2 aria-hidden="true" className="animate-spin" />
          ) : (
            <Sparkles aria-hidden="true" />
          )}
          職務経歴書로 변환
        </Button>
        {busy ? (
          <span role="status" className="text-sm text-muted-foreground">
            변환 중{progress ? ` (${progress}자 작성)` : ""}… 보통 30초~1분 걸립니다.
          </span>
        ) : null}
      </div>
    </form>
  );
}
