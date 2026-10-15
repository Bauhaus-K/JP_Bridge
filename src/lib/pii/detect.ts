/**
 * 민감 개인정보 패턴 감지 (PRD 4. 개인정보 최소 수집, DECISIONS D5)
 * 차단이 아니라 경고용이다. 오탐을 줄이기 위해 형식 검증을 함께 한다.
 */
export type PiiType = "rrn" | "passport" | "card" | "account";

export type PiiMatch = { type: PiiType; start: number; end: number; value: string };

export const PII_LABEL: Record<PiiType, string> = {
  rrn: "주민등록번호",
  passport: "여권번호",
  card: "카드번호",
  account: "계좌번호",
};

function validRrn(digits: string): boolean {
  const mm = Number(digits.slice(2, 4));
  const dd = Number(digits.slice(4, 6));
  const g = Number(digits[6]);
  return mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31 && g >= 1 && g <= 8;
}

function luhn(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

const PHONE_RE = /^0(?:1[016789]|2|[3-6][1-5]|70)-\d{3,4}-\d{4}$/;

type Rule = { type: PiiType; re: RegExp; valid?: (raw: string, digits: string) => boolean };

// 앞뒤가 숫자/영문이 아닌 경계에서만 매칭한다
const B = "(?<![0-9A-Za-z])";
const E = "(?![0-9A-Za-z])";

const RULES: Rule[] = [
  {
    type: "rrn",
    re: new RegExp(`${B}\\d{6}[-‐－ ]?\\d{7}${E}`, "g"),
    valid: (_r, d) => validRrn(d),
  },
  {
    type: "card",
    re: new RegExp(`${B}\\d{4}([- ])?\\d{4}\\1\\d{4}\\1\\d{4}${E}`, "g"),
    valid: (_r, d) => luhn(d),
  },
  // 한국 여권: M12345678 / M123A4567 (구·신형), 일본 여권: TK1234567
  {
    type: "passport",
    re: new RegExp(`${B}(?:[MSRODG]\\d{8}|[MSRODG]\\d{3}[A-Z]\\d{4}|[A-Z]{2}\\d{7})${E}`, "g"),
  },
  {
    type: "account",
    re: new RegExp(`${B}\\d{2,6}-\\d{2,6}-\\d{2,7}(?:-\\d{1,3})?${E}`, "g"),
    valid: (raw, d) =>
      d.length >= 10 && d.length <= 14 && !PHONE_RE.test(raw) && !/^\d{4}-\d{2}-\d{2}$/.test(raw),
  },
];

export function detectPii(text: string): PiiMatch[] {
  const found: PiiMatch[] = [];
  for (const rule of RULES) {
    for (const m of text.matchAll(rule.re)) {
      const raw = m[0];
      const digits = raw.replace(/\D/g, "");
      if (rule.valid && !rule.valid(raw, digits)) continue;
      const start = m.index ?? 0;
      const end = start + raw.length;
      // 앞선 규칙과 겹치면 건너뛴다 (예: 주민번호를 계좌번호로 중복 감지)
      if (found.some((f) => start < f.end && end > f.start)) continue;
      found.push({ type: rule.type, start, end, value: raw });
    }
  }
  return found.sort((a, b) => a.start - b.start);
}

/** 감지된 부분을 같은 길이의 '＊'로 바꾼다 (구분자는 유지). */
export function maskPii(text: string, matches = detectPii(text)): string {
  let out = text;
  for (const m of [...matches].sort((a, b) => b.start - a.start)) {
    const masked = m.value.replace(/[0-9A-Za-z]/g, "＊");
    out = out.slice(0, m.start) + masked + out.slice(m.end);
  }
  return out;
}

export function piiSummary(matches: PiiMatch[]): string {
  return Array.from(new Set(matches.map((m) => PII_LABEL[m.type]))).join(", ");
}
