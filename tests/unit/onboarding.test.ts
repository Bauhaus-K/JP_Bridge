import { describe, expect, it } from "vitest";

import {
  buildOnboardingSchema,
  onboardingFormToObject,
  onboardingToProfileUpdate,
} from "@/lib/validation/onboarding";

const NOW = new Date(2026, 9, 15); // 2026-10-15 (local)

function form(entries: Record<string, string | string[]>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) {
    for (const item of Array.isArray(v) ? v : [v]) fd.append(k, item);
  }
  return fd;
}

const base = {
  displayName: "김민지",
  personaType: "new_grad",
  jlptLevel: "N2",
  graduationMonth: "2027-02",
  targetStartMonth: "2027-04",
  desiredRoles: ["ソフトウェアエンジニア (개발)"],
  aiNoticeAck: "on",
};

function parse(entries: Record<string, string | string[]>) {
  return buildOnboardingSchema(NOW).safeParse(onboardingFormToObject(form(entries)));
}

function errorPaths(result: ReturnType<typeof parse>) {
  return result.success ? [] : result.error.issues.map((i) => i.path[0]);
}

describe("onboarding schema", () => {
  it("accepts a valid new-grad profile and maps it to profile columns", () => {
    const result = parse(base);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const update = onboardingToProfileUpdate(result.data, NOW);
    expect(update).toMatchObject({
      display_name: "김민지",
      persona_type: "new_grad",
      graduation_date: "2027-02-01",
      career_years: null,
      target_start: "2027-04-01",
      allow_training_use: false,
    });
    expect(update.ai_notice_ack_at).toBe(NOW.toISOString());
  });

  it("requires graduation month for new grads", () => {
    expect(errorPaths(parse({ ...base, graduationMonth: "" }))).toContain("graduationMonth");
  });

  it("requires career years for experienced personas and drops graduation date", () => {
    const missing = parse({ ...base, personaType: "it_career", graduationMonth: "" });
    expect(errorPaths(missing)).toContain("careerYears");

    const ok = parse({ ...base, personaType: "it_career", careerYears: "3" });
    expect(ok.success).toBe(true);
    if (!ok.success) return;
    const update = onboardingToProfileUpdate(ok.data, NOW);
    expect(update.career_years).toBe(3);
    expect(update.graduation_date).toBeNull();
  });

  it("rejects non-integer or out-of-range career years", () => {
    expect(
      errorPaths(parse({ ...base, personaType: "second_new_grad", careerYears: "1.5" })),
    ).toContain("careerYears");
    expect(
      errorPaths(parse({ ...base, personaType: "second_new_grad", careerYears: "99" })),
    ).toContain("careerYears");
  });

  it("limits target start to this month through 36 months ahead", () => {
    expect(parse({ ...base, targetStartMonth: "2026-10" }).success).toBe(true);
    expect(errorPaths(parse({ ...base, targetStartMonth: "2026-09" }))).toContain(
      "targetStartMonth",
    );
    expect(parse({ ...base, targetStartMonth: "2029-10" }).success).toBe(true);
    expect(errorPaths(parse({ ...base, targetStartMonth: "2029-11" }))).toContain(
      "targetStartMonth",
    );
    expect(errorPaths(parse({ ...base, targetStartMonth: "2027-13" }))).toContain(
      "targetStartMonth",
    );
  });

  it("requires the AI notice acknowledgement", () => {
    const { aiNoticeAck: _omit, ...rest } = base;
    expect(errorPaths(parse(rest))).toContain("aiNoticeAck");
  });

  it("merges a custom role, de-duplicates, and requires at least one role", () => {
    const result = parse({
      ...base,
      desiredRoles: ["総合職 (종합직)", "総合職 (종합직)"],
      customRole: "  ゲーム企画  ",
    });
    expect(result.success && result.data.desiredRoles).toEqual(["総合職 (종합직)", "ゲーム企画"]);
    expect(errorPaths(parse({ ...base, desiredRoles: [] }))).toContain("desiredRoles");
  });

  it("rejects missing persona and JLPT selections", () => {
    const paths = errorPaths(parse({ ...base, personaType: "", jlptLevel: "" }));
    expect(paths).toEqual(expect.arrayContaining(["personaType", "jlptLevel"]));
  });

  it("records the optional training-use opt-in", () => {
    const result = parse({ ...base, allowTrainingUse: "on" });
    expect(result.success && result.data.allowTrainingUse).toBe(true);
  });
});
