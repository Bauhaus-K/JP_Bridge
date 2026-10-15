import { describe, expect, it } from "vitest";

import { readNdjson } from "@/lib/ndjson";

function streamOf(chunks: string[]) {
  const enc = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(c) {
      chunks.forEach((ch) => c.enqueue(enc.encode(ch)));
      c.close();
    },
  });
}

describe("readNdjson", () => {
  it("parses events split across chunks, including multibyte boundaries", async () => {
    const bytes = new TextEncoder().encode('{"a":"日本"}\n{"b":2}');
    const s = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(bytes.slice(0, 7)); // '日' 중간에서 자른다
        c.enqueue(bytes.slice(7));
        c.close();
      },
    });
    const out = [];
    for await (const e of readNdjson(s)) out.push(e);
    expect(out).toEqual([{ a: "日本" }, { b: 2 }]);
  });

  it("skips blank lines", async () => {
    const out = [];
    for await (const e of readNdjson(streamOf(['{"x":1}\n\n', '{"x":2}\n']))) out.push(e);
    expect(out).toEqual([{ x: 1 }, { x: 2 }]);
  });
});
