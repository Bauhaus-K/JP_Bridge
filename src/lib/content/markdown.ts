/**
 * 법적 고지 등 정적 문서용 최소 마크다운 파서.
 * 지원: # ~ ### 제목, 문단, - 목록, > 인용, **굵게**. HTML 은 렌더하지 않는다(텍스트로 처리).
 */
export type Inline = { text: string; bold: boolean };
export type Block =
  | { type: "heading"; level: 1 | 2 | 3; inlines: Inline[] }
  | { type: "paragraph"; inlines: Inline[] }
  | { type: "list"; items: Inline[][] }
  | { type: "quote"; inlines: Inline[] };

export function parseInline(text: string): Inline[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((p) =>
    p.startsWith("**") && p.endsWith("**") && p.length > 4
      ? { text: p.slice(2, -2), bold: true }
      : { text: p, bold: false },
  );
}

export function parseMarkdown(source: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: string[] | null = null;

  const flush = () => {
    if (paragraph.length) {
      blocks.push({ type: "paragraph", inlines: parseInline(paragraph.join(" ")) });
      paragraph = [];
    }
    if (list) {
      blocks.push({ type: "list", items: list.map(parseInline) });
      list = null;
    }
  };

  for (const raw of source.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      blocks.push({
        type: "heading",
        level: heading[1].length as 1 | 2 | 3,
        inlines: parseInline(heading[2]),
      });
      continue;
    }
    const item = /^[-*]\s+(.*)$/.exec(line);
    if (item) {
      if (paragraph.length) flush();
      list ??= [];
      list.push(item[1]);
      continue;
    }
    if (line.startsWith(">")) {
      flush();
      blocks.push({ type: "quote", inlines: parseInline(line.replace(/^>\s?/, "")) });
      continue;
    }
    if (list) flush();
    paragraph.push(line);
  }
  flush();
  return blocks;
}
