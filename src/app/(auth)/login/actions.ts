"use server";

import { redirect } from "next/navigation";

import { safeNextPath } from "@/lib/auth/redirect";
import { createClient } from "@/lib/db/server";
import { publicEnv } from "@/lib/env";
import { emailLoginSchema } from "@/lib/validation/auth";

export type LoginState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | { status: "error"; message: string; fieldError?: string };

function callbackUrl(next: string) {
  const url = new URL("/auth/callback", publicEnv().NEXT_PUBLIC_SITE_URL);
  url.searchParams.set("next", next);
  return url.toString();
}

export async function signInWithEmail(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = emailLoginSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return {
      status: "error",
      message: "입력 내용을 확인해 주세요.",
      fieldError: parsed.error.issues[0]?.message,
    };
  }
  const next = safeNextPath(String(formData.get("next") ?? ""));
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { emailRedirectTo: callbackUrl(next), shouldCreateUser: true },
  });
  if (error) {
    const rateLimited = error.status === 429 || /rate|seconds/i.test(error.message);
    return {
      status: "error",
      message: rateLimited
        ? "요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요."
        : "로그인 메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.",
    };
  }
  return { status: "sent", email: parsed.data.email };
}

export async function signInWithGoogle(formData: FormData): Promise<void> {
  const next = safeNextPath(String(formData.get("next") ?? ""));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callbackUrl(next) },
  });
  if (error || !data.url) {
    redirect(`/login?error=oauth&next=${encodeURIComponent(next)}`);
  }
  redirect(data.url);
}
