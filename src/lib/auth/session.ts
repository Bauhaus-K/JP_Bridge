import "server-only";

import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { createClient } from "@/lib/db/server";
import type { Profile } from "@/lib/db/database.types";

export type SessionUser = { id: string; email: string | null };

/** 검증된 JWT 클레임으로 현재 사용자를 얻는다. 요청 단위로 메모이즈된다. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  const email = typeof data.claims.email === "string" ? data.claims.email : null;
  return { id: data.claims.sub, email };
});

export const getProfile = cache(async (userId: string): Promise<Profile | null> => {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle();
  return data;
});

export async function requireUser(next?: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  }
  return user;
}

export async function requireProfile(): Promise<{ user: SessionUser; profile: Profile }> {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  if (!profile) {
    // 가입 트리거가 프로필을 만들지 못한 비정상 상태
    throw new Error("프로필을 불러오지 못했습니다.");
  }
  return { user, profile };
}

/** 온보딩을 마친 사용자만 통과. 아니면 온보딩으로 보낸다. */
export async function requireOnboarded(): Promise<{ user: SessionUser; profile: Profile }> {
  const result = await requireProfile();
  if (!result.profile.onboarded_at) redirect("/onboarding");
  return result;
}

/** admin 이 아니면 존재 자체를 숨긴다(404). */
export async function requireAdmin(): Promise<{ user: SessionUser; profile: Profile }> {
  const result = await requireProfile();
  if (result.profile.role !== "admin") notFound();
  return result;
}
