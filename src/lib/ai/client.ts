import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import { serverEnv } from "@/lib/env";
import { AiError } from "./errors";

export type ModelTier = "main" | "fast";

let client: Anthropic | undefined;

/** 서버 전용 Anthropic 클라이언트. ANTHROPIC_BASE_URL 이 있으면 SDK 가 그 주소를 쓴다(테스트용 목 서버). */
export function getAnthropic(): Anthropic {
  const key = serverEnv().ANTHROPIC_API_KEY;
  if (!key) throw new AiError("config", "ANTHROPIC_API_KEY missing");
  client ??= new Anthropic({ apiKey: key, timeout: 180_000, maxRetries: 2 });
  return client;
}

export function modelFor(tier: ModelTier): string {
  const env = serverEnv();
  return tier === "main" ? env.ANTHROPIC_MODEL : env.ANTHROPIC_MODEL_FAST;
}
