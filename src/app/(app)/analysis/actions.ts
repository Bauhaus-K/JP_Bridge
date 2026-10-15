"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { episodeSchema } from "@/lib/ai/schemas/episode";
import { trackEvent } from "@/lib/analytics";
import { requireOnboarded } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { parseEpisodeForm } from "@/lib/validation/episode";

export type EpisodeFormState = { message?: string; ok?: boolean };

export async function createEpisode(
  _prev: EpisodeFormState,
  formData: FormData,
): Promise<EpisodeFormState> {
  await requireOnboarded();
  const parsed = parseEpisodeForm(formData);
  if (!parsed.success) return { message: parsed.message };
  const supabase = await createClient();
  const { error } = await supabase.from("episodes").insert(parsed.data);
  if (error) return { message: "저장하지 못했습니다. 잠시 후 다시 시도해 주세요." };
  await trackEvent("episode.created", { source: "manual" });
  revalidatePath("/analysis/episodes");
  return { ok: true, message: "카드를 추가했습니다." };
}

export async function updateEpisode(
  _prev: EpisodeFormState,
  formData: FormData,
): Promise<EpisodeFormState> {
  await requireOnboarded();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return { message: "카드를 찾을 수 없습니다." };
  const parsed = parseEpisodeForm(formData);
  if (!parsed.success) return { message: parsed.message };
  const supabase = await createClient();
  const { error } = await supabase.from("episodes").update(parsed.data).eq("id", id.data);
  if (error) return { message: "저장하지 못했습니다. 잠시 후 다시 시도해 주세요." };
  revalidatePath("/analysis/episodes");
  return { ok: true, message: "저장했습니다." };
}

export async function deleteEpisode(formData: FormData): Promise<void> {
  await requireOnboarded();
  const id = z.uuid().safeParse(formData.get("id"));
  if (id.success) {
    const supabase = await createClient();
    await supabase.from("episodes").delete().eq("id", id.data);
  }
  revalidatePath("/analysis/episodes");
}

const saveExtractedSchema = z.object({
  conversationId: z.uuid(),
  episodes: z.array(episodeSchema).min(1).max(5),
});

export async function saveExtractedEpisodes(
  input: z.infer<typeof saveExtractedSchema>,
): Promise<{ ok: false; message: string } | never> {
  await requireOnboarded();
  const parsed = saveExtractedSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, message: "카드 내용을 확인해 주세요. 제목은 필수입니다." };
  const supabase = await createClient();
  const { error } = await supabase.from("episodes").insert(
    parsed.data.episodes.map((e) => ({
      ...e,
      source_conversation_id: parsed.data.conversationId,
    })),
  );
  if (error) return { ok: false, message: "저장하지 못했습니다. 잠시 후 다시 시도해 주세요." };
  await trackEvent("episode.created", { source: "analysis", count: parsed.data.episodes.length });
  revalidatePath("/analysis/episodes");
  redirect("/analysis/episodes?saved=1");
}

export async function deleteConversation(formData: FormData): Promise<void> {
  await requireOnboarded();
  const id = z.uuid().safeParse(formData.get("id"));
  if (id.success) {
    const supabase = await createClient();
    await supabase.from("analysis_conversations").delete().eq("id", id.data);
  }
  redirect("/analysis");
}
