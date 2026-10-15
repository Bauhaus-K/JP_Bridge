import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { publicEnv } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * 요청 사용자 권한(RLS 적용)의 Supabase 클라이언트.
 * Server Component / Server Action / Route Handler 에서 요청마다 새로 만든다.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const env = publicEnv();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component 에서는 쿠키를 쓸 수 없다. 세션 갱신은 proxy 가 담당한다.
          }
        },
      },
    },
  );
}
