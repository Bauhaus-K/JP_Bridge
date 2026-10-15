import { describe, expect, it } from "vitest";

import { parsePublicEnv, parseServerEnv } from "@/lib/env";

describe("parseServerEnv", () => {
  it("applies model defaults and treats empty strings as unset", () => {
    const env = parseServerEnv({ ANTHROPIC_MODEL: "", ANTHROPIC_API_KEY: "" });
    expect(env.ANTHROPIC_MODEL).toBe("claude-sonnet-5-5");
    expect(env.ANTHROPIC_MODEL_FAST).toBe("claude-haiku-5-5");
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
  });

  it("keeps the referral flag off unless explicitly enabled", () => {
    expect(parseServerEnv({}).FEATURE_REFERRAL).toBe(false);
    expect(parseServerEnv({ FEATURE_REFERRAL: "false" }).FEATURE_REFERRAL).toBe(false);
    expect(parseServerEnv({ FEATURE_REFERRAL: "TRUE" }).FEATURE_REFERRAL).toBe(true);
    expect(parseServerEnv({ FEATURE_REFERRAL: "1" }).FEATURE_REFERRAL).toBe(true);
  });

  it("normalizes ADMIN_EMAILS", () => {
    const env = parseServerEnv({ ADMIN_EMAILS: " Ops@Example.com, ,second@example.com " });
    expect(env.ADMIN_EMAILS).toEqual(["ops@example.com", "second@example.com"]);
  });
});

describe("parsePublicEnv", () => {
  it("requires Supabase URL and anon key", () => {
    expect(() => parsePublicEnv({})).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
    expect(() =>
      parsePublicEnv({ NEXT_PUBLIC_SUPABASE_URL: "not-a-url", NEXT_PUBLIC_SUPABASE_ANON_KEY: "k" }),
    ).toThrow();
  });

  it("defaults the site URL", () => {
    const env = parsePublicEnv({
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
    });
    expect(env.NEXT_PUBLIC_SITE_URL).toBe("http://localhost:3000");
  });
});
