/**
 * 일본어/한국어 혼용 텍스트를 문장 단위로 나눈다.
 * 구분: 「。」「．」「！」「？」「!」「?」 뒤(닫는 괄호·따옴표 포함), 그리고 줄바꿈.
 */
const SENTENCE_RE = /[^。．！？!?\n]*(?:[。．！？!?]+[」』）)"'”’]*|\n|$)/g;

export function splitSentences(text: string): string[] {
  const normalized = text.replace(/\r\n?/g, "\n");
  const result: string[] = [];
  for (const match of normalized.matchAll(SENTENCE_RE)) {
    const s = match[0].replace(/\n$/, "").trim();
    if (s) result.push(s);
  }
  return result;
}
