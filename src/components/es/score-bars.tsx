import { SCORE_LABELS, type EsReview, type EsScoreKey } from "@/lib/ai/schemas/es-review";

const ORDER: EsScoreKey[] = ["structure", "specificity", "naturalness", "company_fit"];

export function ScoreBars({ scores }: { scores: EsReview["scores"] }) {
  return (
    <div className="grid gap-3">
      <p className="text-xs text-muted-foreground">
        점수는 글의 완성도를 높이기 위한 코칭 지표이며, 합격 가능성을 뜻하지 않습니다.
      </p>
      <dl className="grid gap-3">
        {ORDER.map((key) => {
          const s = scores[key];
          return (
            <div key={key} className="grid gap-1">
              <dt className="flex items-center justify-between text-sm font-medium">
                {SCORE_LABELS[key]}
                <span className="font-normal tabular-nums text-muted-foreground">
                  {s.score} / 5
                </span>
              </dt>
              <dd className="grid gap-1">
                <div
                  role="meter"
                  aria-label={`${SCORE_LABELS[key]} 점수`}
                  aria-valuemin={1}
                  aria-valuemax={5}
                  aria-valuenow={s.score}
                  className="h-2 overflow-hidden rounded-full bg-muted"
                >
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${(s.score / 5) * 100}%` }}
                  />
                </div>
                <p className="text-sm text-muted-foreground">{s.comment_ko}</p>
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
