import { describe, expect, it } from "vitest";

import { compact, delta, percent, pivotFeatureUsage } from "@/lib/metrics";
import { extendPeriod } from "@/lib/payments/provider";
import { TossPaymentProvider } from "@/lib/payments/toss";

describe("extendPeriod", () => {
  const now = new Date("2026-10-19T00:00:00Z");
  it("starts from now when there is no active period", () => {
    expect(extendPeriod(null, 1, now)).toBe("2026-11-19T00:00:00.000Z");
    expect(extendPeriod("2026-10-01T00:00:00Z", 3, now)).toBe("2027-01-19T00:00:00.000Z");
  });
  it("extends from the end of a still-active period", () => {
    expect(extendPeriod("2026-11-10T00:00:00Z", 1, now)).toBe("2026-12-10T00:00:00.000Z");
  });
});

describe("TossPaymentProvider", () => {
  it("is a not-yet-implemented stub", async () => {
    await expect(
      new TossPaymentProvider().activate({
        userId: "u",
        planCode: "pro",
        months: 1,
        actorId: null,
      }),
    ).rejects.toThrow(/not implemented/);
  });
});

describe("metrics helpers", () => {
  it("formats numbers, percents and deltas", () => {
    expect(compact(1284)).toBe("1,284");
    expect(compact(12_900)).toMatch(/1\.3만|12\.9K/);
    expect(percent(3, 30)).toBe("10.0%");
    expect(percent(1, 0)).toBe("-");
    expect(delta(5, 3)).toEqual({ text: "+2", direction: "up" });
    expect(delta(1, 3)).toEqual({ text: "-2", direction: "down" });
    expect(delta(2, 2).direction).toBe("flat");
  });

  it("pivots feature usage into weekly columns sorted by total", () => {
    const weeks = ["2026-09-28T00:00:00+09:00", "2026-10-05T00:00:00+09:00"];
    const rows = pivotFeatureUsage(
      [
        { feature: "es_review", week_start: "2026-09-27T15:00:00+00:00", count: 2 },
        { feature: "es_review", week_start: "2026-10-04T15:00:00+00:00", count: 3 },
        { feature: "analysis_chat", week_start: "2026-10-04T15:00:00+00:00", count: 9 },
        { feature: "unknown_feature", week_start: "2026-01-01T00:00:00Z", count: 100 },
      ],
      weeks,
    );
    expect(rows).toEqual([
      { feature: "analysis_chat", label: "자기분석 대화", weeks: [0, 9], total: 9 },
      { feature: "es_review", label: "ES 첨삭", weeks: [2, 3], total: 5 },
    ]);
  });
});
