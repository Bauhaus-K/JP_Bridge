export const DEFAULT_AFTER_LOGIN = "/dashboard";

/**
 * 로그인 후 이동 경로(`next`)를 같은 출처의 상대 경로로 제한한다 (오픈 리다이렉트 방지).
 */
export function safeNextPath(
  next: string | null | undefined,
  fallback = DEFAULT_AFTER_LOGIN,
): string {
  if (!next || typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f]/.test(next)) return fallback;
  try {
    const url = new URL(next, "http://placeholder.local");
    if (url.origin !== "http://placeholder.local") return fallback;
    if (url.pathname.startsWith("/auth/")) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

/** 로그인이 필요한 경로 접두사. proxy 와 레이아웃 가드가 함께 사용한다. */
export const PROTECTED_PREFIXES = [
  "/dashboard",
  "/onboarding",
  "/es",
  "/analysis",
  "/interview",
  "/career",
  "/checklist",
  "/referrals",
  "/settings",
  "/admin",
] as const;

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
