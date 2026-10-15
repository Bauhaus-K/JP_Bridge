import type { UserRole } from "@/lib/db/database.types";

/** ADMIN_EMAILS(소문자 정규화 목록)에 따라 기대 역할을 계산한다. */
export function expectedRoleForEmail(
  email: string | null | undefined,
  adminEmails: string[],
): UserRole {
  if (!email) return "user";
  return adminEmails.includes(email.trim().toLowerCase()) ? "admin" : "user";
}
