import { describe, expect, it } from "vitest";

import { formatYearMonthKo, monthsUntil } from "@/lib/dates";

describe("dates", () => {
  const now = new Date(2026, 9, 15);

  it("counts whole months until the target month", () => {
    expect(monthsUntil("2027-04-01", now)).toBe(6);
    expect(monthsUntil("2026-10-01", now)).toBe(0);
    expect(monthsUntil("2026-08-01", now)).toBe(-2);
  });

  it("formats year-month in Korean", () => {
    expect(formatYearMonthKo("2027-04-01")).toBe("2027년 4월");
    expect(formatYearMonthKo(null)).toBe("-");
  });
});
