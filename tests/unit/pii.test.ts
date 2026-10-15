import { describe, expect, it } from "vitest";

import { detectPii, maskPii, piiSummary } from "@/lib/pii/detect";

const types = (text: string) => detectPii(text).map((m) => m.type);

describe("detectPii", () => {
  it("detects resident registration numbers with plausible dates", () => {
    expect(types("주민번호 990101-1234567 입니다")).toEqual(["rrn"]);
    expect(types("9901011234567")).toEqual(["rrn"]);
    expect(types("991301-1234567")).toEqual([]); // 13월은 무효
  });

  it("detects passport numbers (KR old/new, JP)", () => {
    expect(types("여권 M12345678")).toEqual(["passport"]);
    expect(types("M123A4567")).toEqual(["passport"]);
    expect(types("TK1234567")).toEqual(["passport"]);
  });

  it("detects Luhn-valid card numbers only", () => {
    expect(types("4111-1111-1111-1111")).toEqual(["card"]);
    expect(types("4111 1111 1111 1112")).toEqual([]);
  });

  it("detects hyphenated bank accounts but not phones or dates", () => {
    expect(types("국민 123-45-6789012")).toEqual(["account"]);
    expect(types("110-123-456789")).toEqual(["account"]);
    expect(types("010-1234-5678")).toEqual([]);
    expect(types("02-123-4567")).toEqual([]);
    expect(types("2024-03-15")).toEqual([]);
  });

  it("does not flag ordinary ES content", () => {
    expect(
      types("TOEIC 900点、2023年4月から売上を120%に伸ばしました。社員番号は不要です。"),
    ).toEqual([]);
  });
});

describe("maskPii", () => {
  it("masks digits/letters while keeping separators and length", () => {
    const text = "번호는 990101-1234567, 카드 4111-1111-1111-1111";
    const masked = maskPii(text);
    expect(masked).toBe(
      "번호는 ＊＊＊＊＊＊-＊＊＊＊＊＊＊, 카드 ＊＊＊＊-＊＊＊＊-＊＊＊＊-＊＊＊＊",
    );
    expect(masked).toHaveLength(text.length);
    expect(detectPii(masked)).toEqual([]);
    expect(piiSummary(detectPii(text))).toBe("주민등록번호, 카드번호");
  });
});
