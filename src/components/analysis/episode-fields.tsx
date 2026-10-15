import type { EpisodeInput } from "@/lib/ai/schemas/episode";
import { cn } from "@/lib/utils";
import { controlClass } from "@/components/ui/input";

const FIELDS: { key: "situation" | "task" | "action" | "result"; label: string; hint: string }[] = [
  { key: "situation", label: "상황 (Situation)", hint: "언제, 어디서, 어떤 상황이었나요?" },
  { key: "task", label: "과제 (Task)", hint: "해결해야 했던 문제나 목표" },
  { key: "action", label: "행동 (Action)", hint: "내가 직접 생각하고 실행한 것" },
  { key: "result", label: "결과 (Result)", hint: "결과와 배운 점 (수치는 실제 값만)" },
];

/** 에피소드 입력 필드 묶음 (폼 name 기반, 비제어 컴포넌트) */
export function EpisodeFields({
  idPrefix,
  initial,
}: {
  idPrefix: string;
  initial?: Partial<EpisodeInput>;
}) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <label htmlFor={`${idPrefix}-title`} className="text-sm font-medium">
          제목
          <span aria-hidden="true" className="text-destructive">
            *
          </span>
        </label>
        <input
          id={`${idPrefix}-title`}
          name="title"
          required
          maxLength={60}
          defaultValue={initial?.title}
          className={cn(controlClass, "h-10")}
        />
      </div>
      {FIELDS.map((f) => (
        <div key={f.key} className="grid gap-1.5">
          <label htmlFor={`${idPrefix}-${f.key}`} className="text-sm font-medium">
            {f.label}
          </label>
          <textarea
            id={`${idPrefix}-${f.key}`}
            name={f.key}
            rows={2}
            maxLength={1000}
            placeholder={f.hint}
            defaultValue={initial?.[f.key]}
            className={cn(controlClass, "py-2")}
          />
        </div>
      ))}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <label htmlFor={`${idPrefix}-keywords`} className="text-sm font-medium">
            키워드 (쉼표로 구분, 일본어 권장)
          </label>
          <input
            id={`${idPrefix}-keywords`}
            name="keywords"
            lang="ja"
            defaultValue={initial?.keywords?.join(", ")}
            className={cn(controlClass, "h-10")}
          />
        </div>
        <div className="grid gap-1.5">
          <label htmlFor={`${idPrefix}-strengths`} className="text-sm font-medium">
            강점 태그 (쉼표로 구분)
          </label>
          <input
            id={`${idPrefix}-strengths`}
            name="strengths"
            placeholder="主体性(주체성)"
            defaultValue={initial?.strengths?.join(", ")}
            className={cn(controlClass, "h-10")}
          />
        </div>
      </div>
    </div>
  );
}
