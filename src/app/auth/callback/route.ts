import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { safeNextPath } from "@/lib/auth/redirect";
import { syncAdminRole } from "@/lib/auth/sync-role";
import { createClient } from "@/lib/db/server";

const OTP_TYPES: EmailOtpType[] = [
  "magiclink",
  "signup",
  "email",
  "invite",
  "recovery",
  "email_change",
];

/**
 * 매직링크 / OAuth 콜백.
 * - PKCE: ?code=...
 * - 토큰 해시(커스텀 이메일 템플릿): ?token_hash=...&type=magiclink
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next"));
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();
  let ok = false;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  } else if (tokenHash && type && OTP_TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    ok = !error;
  }

  if (!ok) {
    return NextResponse.redirect(
      new URL(`/login?error=callback&next=${encodeURIComponent(next)}`, origin),
    );
  }

  const { data } = await supabase.auth.getClaims();
  if (data?.claims?.sub) {
    const email = typeof data.claims.email === "string" ? data.claims.email : null;
    await syncAdminRole(data.claims.sub, email);
  }

  return NextResponse.redirect(new URL(next, origin));
}
