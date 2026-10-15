import { describe, expect, it } from "vitest";

import { esDocumentFormToObject, esDocumentSchema } from "@/lib/validation/es";

function form(entries: Record<string, string>) {
  const fd = new FormData();
  Object.entries(entries).forEach(([k, v]) => fd.append(k, v));
  return esDocumentSchema.safeParse(esDocumentFormToObject(fd));
}

describe("esDocumentSchema", () => {
  it("accepts minimal input and normalizes optional fields to null", () => {
    const r = form({ title: " 自己PR ", questionType: "self_pr", company: "", charLimit: "" });
    expect(r.success && r.data).toEqual({
      title: "自己PR",
      questionType: "self_pr",
      company: null,
      questionText: null,
      charLimit: null,
    });
  });

  it("validates the character limit range", () => {
    expect(form({ title: "t", questionType: "free", charLimit: "400" }).success).toBe(true);
    expect(form({ title: "t", questionType: "free", charLimit: "10" }).success).toBe(false);
    expect(form({ title: "t", questionType: "free", charLimit: "400.5" }).success).toBe(false);
  });

  it("requires title and question type", () => {
    const r = form({ title: "", questionType: "" });
    expect(r.success).toBe(false);
    if (!r.success)
      expect(r.error.issues.map((i) => i.path[0]).sort()).toEqual(["questionType", "title"]);
  });
});
