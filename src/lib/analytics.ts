import "server-only";

import type { Json } from "@/lib/db/database.types";
import { createClient } from "@/lib/db/server";

/** 제품 분석 이벤트 기록. 실패해도 사용자 흐름을 막지 않는다. */
export async function trackEvent(name: string, props: Record<string, Json> = {}): Promise<void> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("events").insert({ name, props });
    if (error) console.warn("[events] 기록 실패", name, error.message);
  } catch (e) {
    console.warn("[events] 기록 실패", name, e);
  }
}
