import { describe, expect, it } from "vitest";

import { countChars, isHalfWidth, limitStatus } from "@/lib/text/char-count";

describe("countChars", () => {
  it("counts each visible character as one by default", () => {
    expect(countChars("私の強みは粘り強さです。")).toBe(12);
    expect(countChars("ABC 123")).toBe(7);
    expect(countChars("한국어와日本語")).toBe(7);
  });

  it("excludes newlines unless requested and normalizes CRLF", () => {
    expect(countChars("一行目\r\n二行目\n")).toBe(6);
    expect(countChars("一行目\r\n二行目\n", { includeNewlines: true })).toBe(8);
  });

  it("counts grapheme clusters, not code units", () => {
    expect(countChars("👨‍👩‍👧")).toBe(1);
    expect(countChars("が")).toBe(1); // NFD 결합 문자
    expect(countChars("𠮷野家")).toBe(3); // 서로게이트 페어
  });

  it("can count half-width characters as half", () => {
    expect(countChars("TOEIC900点", { halfWidthAsHalf: true })).toBe(5);
    expect(countChars("ｶﾀｶﾅ", { halfWidthAsHalf: true })).toBe(2);
    expect(countChars("ＡＢＣ", { halfWidthAsHalf: true })).toBe(3); // 전각 영문은 1자
    expect(isHalfWidth("A")).toBe(true);
    expect(isHalfWidth("Ａ")).toBe(false);
  });
});

describe("limitStatus", () => {
  it("classifies against the limit with a 90% guideline", () => {
    expect(limitStatus(0, 400)).toBe("empty");
    expect(limitStatus(359, 400)).toBe("under");
    expect(limitStatus(360, 400)).toBe("ok");
    expect(limitStatus(400, 400)).toBe("ok");
    expect(limitStatus(401, 400)).toBe("over");
    expect(limitStatus(10, null)).toBe("ok");
  });
});
