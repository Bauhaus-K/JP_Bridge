import "server-only";

import { modelFor } from "@/lib/ai/client";
import {
  buildTranscript,
  CHAT_OPENING_MESSAGE,
  CHAT_PROMPT_VERSION,
  CHAT_SYSTEM_PROMPT,
  EXTRACT_PROMPT_VERSION,
  EXTRACT_SYSTEM_PROMPT,
} from "@/lib/ai/prompts/self-analysis";
import { runStructuredForUser, streamTextForUser } from "@/lib/ai/run";
import { episodeExtractionSchema, type EpisodeExtraction } from "@/lib/ai/schemas/episode";
import { trackEvent } from "@/lib/analytics";
import { createClient } from "@/lib/db/server";
import type { Profile } from "@/lib/db/database.types";
import { detectPii } from "@/lib/pii/detect";

export const CHAT_MAX_MESSAGE = 2000;
const HISTORY_LIMIT = 40;

export class AnalysisError extends Error {
  constructor(
    public readonly code: "not_found" | "empty" | "too_long" | "pii" | "save_failed" | "too_short",
    message: string,
  ) {
    super(message);
  }
}

type ChatMessage = { role: "user" | "assistant"; content: string };

export async function loadMessages(conversationId: string): Promise<ChatMessage[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("analysis_messages")
    .select("role, content, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  return (data ?? []).map((m) => ({ role: m.role, content: m.content }));
}

/** 사용자 메시지를 저장하고 코치 응답을 스트리밍한 뒤 저장한다. 실패하면 사용자 메시지를 지운다. */
export async function chatTurn(params: {
  userId: string;
  profile: Profile;
  conversationId: string | null;
  message: string;
  piiConfirmed: boolean;
  onConversation: (id: string) => void;
  onDelta: (text: string) => void;
  signal?: AbortSignal;
}): Promise<{ conversationId: string; reply: string }> {
  const message = params.message.trim();
  if (!message) throw new AnalysisError("empty", "메시지를 입력해 주세요.");
  if (message.length > CHAT_MAX_MESSAGE) {
    throw new AnalysisError("too_long", `한 번에 ${CHAT_MAX_MESSAGE}자까지 보낼 수 있습니다.`);
  }
  if (!params.piiConfirmed && detectPii(message).length > 0) {
    throw new AnalysisError(
      "pii",
      "주민등록번호·여권번호·계좌번호·카드번호로 보이는 내용이 있습니다. 지우거나 마스킹한 뒤 보내 주세요.",
    );
  }

  const supabase = await createClient();
  let conversationId = params.conversationId;
  const isNew = !conversationId;
  if (!conversationId) {
    const { data, error } = await supabase
      .from("analysis_conversations")
      .insert({ title: message.slice(0, 40) })
      .select("id")
      .single();
    if (error || !data) throw new AnalysisError("save_failed", "대화를 시작하지 못했습니다.");
    conversationId = data.id;
    // 첫 화면에 보여준 코치의 인사말도 기록해 문맥을 유지한다
    await supabase.from("analysis_messages").insert({
      conversation_id: conversationId,
      role: "assistant",
      content: CHAT_OPENING_MESSAGE,
    });
    await trackEvent("analysis.conversation_started");
  } else {
    const { data } = await supabase
      .from("analysis_conversations")
      .select("id")
      .eq("id", conversationId)
      .maybeSingle();
    if (!data) throw new AnalysisError("not_found", "대화를 찾을 수 없습니다.");
  }
  params.onConversation(conversationId);

  const { data: userRow, error: insertError } = await supabase
    .from("analysis_messages")
    .insert({ conversation_id: conversationId, role: "user", content: message })
    .select("id")
    .single();
  if (insertError || !userRow)
    throw new AnalysisError("save_failed", "메시지를 저장하지 못했습니다.");

  try {
    const history = (await loadMessages(conversationId)).slice(-HISTORY_LIMIT);
    // API 는 user 로 시작해야 한다: 앞쪽 assistant 메시지는 사용자 턴 앞 맥락으로 합친다
    while (history.length && history[0].role === "assistant") history.shift();
    const { text } = await streamTextForUser(params.userId, {
      feature: "analysis_chat",
      promptVersion: CHAT_PROMPT_VERSION,
      model: modelFor("fast"),
      system: `${CHAT_SYSTEM_PROMPT}\n\n(コーチの最初の挨拶: ${CHAT_OPENING_MESSAGE})`,
      messages: history,
      quotaKind: "chat",
      storeRaw: params.profile.allow_training_use,
      onDelta: params.onDelta,
      signal: params.signal,
    });
    await supabase
      .from("analysis_messages")
      .insert({ conversation_id: conversationId, role: "assistant", content: text });
    await supabase
      .from("analysis_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId);
    return { conversationId, reply: text };
  } catch (error) {
    // 실패한 턴은 남기지 않는다. 이번 턴에 만든 대화라면 대화째 지운다.
    if (isNew) await supabase.from("analysis_conversations").delete().eq("id", conversationId);
    else await supabase.from("analysis_messages").delete().eq("id", userRow.id);
    throw error;
  }
}

export async function extractEpisodes(params: {
  userId: string;
  profile: Profile;
  conversationId: string;
  onProgress?: (info: { outputChars: number; attempt: number }) => void;
  signal?: AbortSignal;
}): Promise<EpisodeExtraction> {
  const messages = await loadMessages(params.conversationId);
  const userTurns = messages.filter((m) => m.role === "user");
  if (userTurns.length === 0) throw new AnalysisError("not_found", "대화를 찾을 수 없습니다.");
  if (userTurns.map((m) => m.content).join("").length < 40) {
    throw new AnalysisError(
      "too_short",
      "카드로 정리하기에는 이야기가 아직 짧아요. 경험을 조금 더 들려주세요.",
    );
  }
  const result = await runStructuredForUser(params.userId, {
    feature: "analysis_extract",
    promptVersion: EXTRACT_PROMPT_VERSION,
    model: modelFor("main"),
    system: EXTRACT_SYSTEM_PROMPT,
    userMessage: buildTranscript(messages),
    schema: episodeExtractionSchema,
    effort: "medium",
    storeRaw: params.profile.allow_training_use,
    onProgress: params.onProgress,
    signal: params.signal,
  });
  await trackEvent("analysis.cards_extracted", { count: result.data.episodes.length });
  return result.data;
}
