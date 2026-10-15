import { describe, expect, it } from "vitest";

import { parseMarkdown } from "@/lib/content/markdown";

describe("parseMarkdown", () => {
  it("parses headings, paragraphs, lists, quotes and bold", () => {
    const blocks = parseMarkdown(
      "# 제목\n\n> 주의\n\n첫 줄\n이어짐 **굵게**\n\n- 하나\n- 둘\n## 소제목",
    );
    expect(blocks.map((b) => b.type)).toEqual(["heading", "quote", "paragraph", "list", "heading"]);
    expect(blocks[2]).toEqual({
      type: "paragraph",
      inlines: [
        { text: "첫 줄 이어짐 ", bold: false },
        { text: "굵게", bold: true },
      ],
    });
    expect(blocks[3]).toMatchObject({
      type: "list",
      items: [[{ text: "하나" }], [{ text: "둘" }]],
    });
  });

  it("treats HTML as plain text", () => {
    const [block] = parseMarkdown("<script>alert(1)</script>");
    expect(block).toEqual({
      type: "paragraph",
      inlines: [{ text: "<script>alert(1)</script>", bold: false }],
    });
  });
});
