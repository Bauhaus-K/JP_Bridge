import { describe, expect, it } from "vitest";

import { isProtectedPath, safeNextPath } from "@/lib/auth/redirect";

describe("safeNextPath", () => {
  it.each([
    ["/es/123?tab=diff", "/es/123?tab=diff"],
    ["/dashboard", "/dashboard"],
  ])("allows same-origin path %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });

  it.each([
    null,
    "",
    "https://evil.example",
    "//evil.example/path",
    "/\\evil.example",
    "javascript:alert(1)",
    "dashboard",
    "/auth/callback?code=x",
    "/foo\nbar",
  ])("falls back for unsafe value %s", (input) => {
    expect(safeNextPath(input)).toBe("/dashboard");
  });
});

describe("isProtectedPath", () => {
  it("matches protected prefixes on segment boundaries", () => {
    expect(isProtectedPath("/dashboard")).toBe(true);
    expect(isProtectedPath("/admin/users")).toBe(true);
    expect(isProtectedPath("/es")).toBe(true);
    expect(isProtectedPath("/essay")).toBe(false);
    expect(isProtectedPath("/")).toBe(false);
    expect(isProtectedPath("/legal/privacy")).toBe(false);
    expect(isProtectedPath("/login")).toBe(false);
  });
});
