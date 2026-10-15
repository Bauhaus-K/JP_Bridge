/**
 * 단일 시리즈 세로 막대 (크기 비교, 한 가지 색).
 * - 막대 끝 4px 라운드, 기준선 고정, 막대 사이 2px 이상 간격
 * - 호버·키보드 포커스 시 툴팁, 표 보기 제공 (색만으로 정보 전달하지 않음)
 */
export function ColumnChart({
  title,
  data,
  valueLabel,
}: {
  title: string;
  data: { label: string; value: number }[];
  valueLabel: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const ticks = [max, Math.round(max / 2), 0].filter((v, i, arr) => arr.indexOf(v) === i);
  return (
    <figure className="grid gap-3 rounded-xl border bg-card p-4">
      <figcaption className="text-sm font-medium">{title}</figcaption>
      <div className="grid grid-cols-[auto_1fr] gap-2">
        <div
          className="relative h-40 text-right text-xs tabular-nums text-muted-foreground"
          aria-hidden="true"
        >
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute right-0 -translate-y-1/2"
              style={{ top: `${100 - (t / max) * 100}%` }}
            >
              {t}
            </span>
          ))}
        </div>
        <div className="relative h-40">
          {ticks.map((t) => (
            <div
              key={t}
              className="absolute inset-x-0 border-t border-chart-grid"
              style={{ top: `${100 - (t / max) * 100}%` }}
              aria-hidden="true"
            />
          ))}
          <ol className="absolute inset-0 flex items-end gap-1" aria-label={title}>
            {data.map((d) => (
              <li
                key={d.label}
                className="group relative flex h-full flex-1 items-end justify-center"
              >
                <span
                  tabIndex={0}
                  aria-label={`${d.label}: ${d.value}${valueLabel}`}
                  className="block w-full max-w-10 rounded-t-[4px] bg-chart-1 outline-none ring-ring/50 focus-visible:ring-[3px]"
                  style={{
                    height: `${Math.max((d.value / max) * 100, d.value > 0 ? 2 : 0)}%`,
                    minHeight: d.value > 0 ? 2 : 0,
                  }}
                />
                <span
                  role="tooltip"
                  className="pointer-events-none absolute bottom-full z-10 mb-1 hidden whitespace-nowrap rounded-md border bg-card px-2 py-1 text-xs shadow group-focus-within:block group-hover:block"
                >
                  {d.label} · <strong>{d.value}</strong>
                  {valueLabel}
                </span>
              </li>
            ))}
          </ol>
        </div>
        <span />
        <div
          className="flex gap-1 text-center text-[11px] text-muted-foreground"
          aria-hidden="true"
        >
          {data.map((d) => (
            <span key={d.label} className="flex-1 truncate">
              {d.label}
            </span>
          ))}
        </div>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">표로 보기</summary>
        <table className="mt-2 w-full">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th scope="col" className="font-medium">
                구간
              </th>
              <th scope="col" className="text-right font-medium">
                값
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.label} className="border-t">
                <td>{d.label}</td>
                <td className="text-right tabular-nums">{d.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
