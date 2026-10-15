import "server-only";

import { modelFor } from "@/lib/ai/client";
import { buildUserMessage, PROMPT_VERSION, SYSTEM_PROMPT } from "@/lib/ai/prompts/career-translate";
import { runStructuredForUser } from "@/lib/ai/run";
import { careerTranslationSchema } from "@/lib/ai/schemas/career";
import { trackEvent } from "@/lib/analytics";
import type { Json, Profile } from "@/lib/db/database.types";
import { createClient } from "@/lib/db/server";
import { detectPii } from "@/lib/pii/detect";

export const CAREER_MAX_INPUT = 6000;

export class CareerError extends Error {
  constructor(
    public readonly code: "empty" | "too_long" | "pii" | "save_failed",
    message: string,
  ) {
    super(message);
  }
}

export async function translateCareer(params: {
  userId: string;
  profile: Profile;
  title: string;
  text: string;
  targetRole: string | null;
  piiConfirmed: boolean;
  onProgress?: (info: { outputChars: number; attempt: number }) => void;
  signal?: AbortSignal;
}): Promise<{ id: string }> {
  const text = params.text.replace(/\r\n?/g, "\n").trim();
  if (text.length < 20) throw new CareerError("empty", "경력 내용을 20자 이상 입력해 주세요.");
  if (text.length > CAREER_MAX_INPUT) {
    throw new CareerError("too_long", `한 번에 ${CAREER_MAX_INPUT}자까지 변환할 수 있습니다.`);
  }
  if (!params.piiConfirmed && detectPii(text).length > 0) {
    throw new CareerError(
      "pii",
      "주민등록번호·여권번호·계좌번호·카드번호로 보이는 내용이 있습니다. 지우거나 마스킹한 뒤 다시 시도해 주세요.",
    );
  }

  const result = await runStructuredForUser(params.userId, {
    feature: "career_translate",
    promptVersion: PROMPT_VERSION,
    model: modelFor("main"),
    system: SYSTEM_PROMPT,
    userMessage: buildUserMessage({
      title: params.title,
      text,
      targetRole: params.targetRole ?? params.profile.desired_roles[0] ?? null,
    }),
    schema: careerTranslationSchema,
    validate: (d) =>
      !d.shokumu_youyaku_ja.trim() || d.shokumu_naiyou.length === 0
        ? "shokumu_youyaku_ja と shokumu_naiyou は必須です。"
        : null,
    effort: "medium",
    storeRaw: params.profile.allow_training_use,
    onProgress: params.onProgress,
    signal: params.signal,
  });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("career_translations")
    .insert({
      title: params.title,
      input: text,
      output: result.data as unknown as Json,
      source: "ai",
      prompt_version: PROMPT_VERSION,
    })
    .select("id")
    .single();
  if (error || !data) throw new CareerError("save_failed", "변환 결과를 저장하지 못했습니다.");
  await trackEvent("career.translated", { attempts: result.attempts });
  return { id: data.id };
}
