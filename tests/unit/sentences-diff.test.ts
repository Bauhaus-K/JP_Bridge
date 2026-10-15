import { describe, expect, it } from "vitest";

import { diffSentences, diffStats } from "@/lib/text/diff";
import { splitSentences } from "@/lib/text/sentences";

describe("splitSentences", () => {
  it("splits on Japanese punctuation and newlines, keeping closing brackets", () => {
    expect(splitSentences("私は「頑張ります。」と言った。次に！本当？\n改行後")).toEqual([
      "私は「頑張ります。」",
      "と言った。",
      "次に！",
      "本当？",
      "改行後",
    ]);
  });

  it("ignores blank lines and surrounding spaces", () => {
    expect(splitSentences("  一文目。\n\n  二文目。  ")).toEqual(["一文目。", "二文目。"]);
    expect(splitSentences("")).toEqual([]);
  });
});

describe("diffSentences", () => {
  it("pairs removed+added sentences as changed with char-level parts", () => {
    const rows = diffSentences(
      "私は頑張りました。結果が出ました。",
      "私は粘り強く取り組みました。結果が出ました。",
    );
    expect(rows[0]).toMatchObject({
      type: "changed",
      before: "私は頑張りました。",
      after: "私は粘り強く取り組みました。",
    });
    expect(rows[1]).toEqual({ type: "same", text: "結果が出ました。" });
    if (rows[0].type !== "changed") throw new Error();
    expect(rows[0].parts.some((p) => p.added)).toBe(true);
    expect(diffStats(rows)).toEqual({ added: 0, removed: 0, changed: 1 });
  });

  it("reports pure additions and removals", () => {
    const rows = diffSentences("A。B。", "A。C。D。");
    expect(diffStats(rows)).toEqual({ added: 1, removed: 0, changed: 1 });
    const removed = diffSentences("A。B。C。", "A。");
    expect(diffStats(removed)).toEqual({ added: 0, removed: 2, changed: 0 });
  });
});
