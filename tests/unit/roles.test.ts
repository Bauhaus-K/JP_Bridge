import { describe, expect, it } from "vitest";

import { expectedRoleForEmail } from "@/lib/auth/roles";

describe("expectedRoleForEmail", () => {
  const admins = ["ops@example.com"];

  it("grants admin only to listed emails, case-insensitively", () => {
    expect(expectedRoleForEmail("OPS@example.com ", admins)).toBe("admin");
    expect(expectedRoleForEmail("user@example.com", admins)).toBe("user");
  });

  it("demotes when the email is missing or the list is empty", () => {
    expect(expectedRoleForEmail(null, admins)).toBe("user");
    expect(expectedRoleForEmail("ops@example.com", [])).toBe("user");
  });
});
