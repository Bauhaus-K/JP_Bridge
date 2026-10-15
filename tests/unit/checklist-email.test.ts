import { describe, expect, it, vi } from "vitest";

import {
  addMonths,
  buildChecklistItems,
  daysUntil,
  dueLabel,
  dueStatus,
  todayKst,
} from "@/lib/checklist/schedule";
import {
  CHECKLIST_TEMPLATES,
  checklistTemplateSchema,
  templateForPersona,
  VISA_DISCLAIMER,
} from "@/lib/checklist/templates";
import {
  ConsoleEmailProvider,
  createEmailProvider,
  emailDomain,
  ResendEmailProvider,
} from "@/lib/email/provider";
import { reviewDoneEmail } from "@/lib/email/templates";

describe("checklist templates", () => {
  it.each(CHECKLIST_TEMPLATES.map((t) => [t.id, t]))(
    "%s is valid with unique item ids and all categories",
    (_id, t) => {
      expect(checklistTemplateSchema.safeParse(t).success).toBe(true);
      const ids = t.items.map((i) => i.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(new Set(t.items.map((i) => i.category))).toEqual(
        new Set(["schedule", "documents", "visa"]),
      );
    },
  );

  it("maps every persona to its own template", () => {
    expect(templateForPersona("new_grad").id).toBe("new-grad");
    expect(templateForPersona("second_new_grad").id).toBe("second-new-grad");
    expect(templateForPersona("it_career").id).toBe("it-career");
    expect(templateForPersona(null).id).toBe("new-grad");
  });

  it("has the required visa disclaimer wording", () => {
    expect(VISA_DISCLAIMER).toContain("일반 정보");
    expect(VISA_DISCLAIMER).toContain("출입국재류관리청");
  });
});

describe("checklist schedule", () => {
  it("adds months across year boundaries", () => {
    expect(addMonths("2027-04-01", -13)).toBe("2026-03-01");
    expect(addMonths("2027-04-01", -22)).toBe("2025-06-01");
    expect(addMonths("2027-01-01", -1)).toBe("2026-12-01");
    expect(addMonths("2027-04-01", 0)).toBe("2027-04-01");
  });

  it("builds items sorted by due date", () => {
    const items = buildChecklistItems(templateForPersona("new_grad"), "2027-04-01");
    const dues = items.map((i) => i.due_date);
    expect(dues).toEqual([...dues].sort());
    expect(items[0].sort_order).toBe(0);
    expect(items.find((i) => i.template_item_id === "entry")?.due_date).toBe("2026-03-01");
  });

  it("classifies due status with a 14-day window", () => {
    const today = "2026-10-18";
    expect(dueStatus({ due_date: "2026-10-01", done_at: null }, today)).toBe("overdue");
    expect(dueStatus({ due_date: "2026-11-01", done_at: null }, today)).toBe("soon");
    expect(dueStatus({ due_date: "2026-11-02", done_at: null }, today)).toBe("later");
    expect(dueStatus({ due_date: "2026-10-01", done_at: "x" }, today)).toBe("done");
    expect(daysUntil("2026-11-01", today)).toBe(14);
    expect(dueLabel("2026-10-18", today)).toBe("D-day");
    expect(dueLabel("2026-10-15", today)).toBe("3일 지남");
  });

  it("computes today in KST", () => {
    expect(todayKst(new Date("2026-10-17T16:00:00Z"))).toBe("2026-10-18");
  });
});

describe("email", () => {
  it("chooses Resend only when an API key is configured", () => {
    expect(createEmailProvider({ EMAIL_FROM: "a@b.c" })).toBeInstanceOf(ConsoleEmailProvider);
    expect(createEmailProvider({ RESEND_API_KEY: "k", EMAIL_FROM: "a@b.c" })).toBeInstanceOf(
      ResendEmailProvider,
    );
  });

  it("posts the message to Resend and surfaces errors", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ id: "em_1" }), { status: 200 }),
    );
    const provider = new ResendEmailProvider(
      "key",
      "JP Bridge <no@x.y>",
      fetchMock as unknown as typeof fetch,
    );
    await expect(provider.send({ to: "u@example.com", subject: "s", text: "t" })).resolves.toEqual({
      id: "em_1",
    });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer key");
    expect(JSON.parse(String(init.body))).toMatchObject({
      to: ["u@example.com"],
      from: "JP Bridge <no@x.y>",
    });

    const failing = new ResendEmailProvider(
      "key",
      "f",
      (async () => new Response("bad", { status: 422 })) as unknown as typeof fetch,
    );
    await expect(failing.send({ to: "u@x.y", subject: "s", text: "t" })).rejects.toThrow(
      /Resend 422/,
    );
  });

  it("builds an escaped review-done email and extracts domains", () => {
    const mail = reviewDoneEmail({
      to: "u@example.com",
      displayName: "<b>김</b>",
      targetType: "es_version",
      link: "https://x/es/1",
    });
    expect(mail.subject).toContain("ES 검수가 완료");
    expect(mail.text).toContain("https://x/es/1");
    expect(mail.html).toContain("&lt;b&gt;김&lt;/b&gt;님");
    expect(mail.html).not.toContain("<b>김</b>");
    expect(emailDomain("User@Example.COM")).toBe("example.com");
    expect(emailDomain("bad")).toBeNull();
  });
});
