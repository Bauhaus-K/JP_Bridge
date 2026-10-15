import { z } from "zod";

import { jsonError, ndjsonResponse } from "@/lib/ai/ndjson-response";
import { chatTurn } from "@/lib/analysis/service";
import type { ChatEvent } from "@/lib/analysis/types";
import { trackEvent } from "@/lib/analytics";
import { getProfile, getSessionUser } from "@/lib/auth/session";

export const maxDuration = 120;

const bodySchema = z.object({
  conversationId: z.uuid().nullable(),
  message: z.string().max(5000),
  piiConfirmed: z.boolean().optional(),
});

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return jsonError(401, "unauthorized", "로그인이 필요합니다.");
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "invalid_input", "요청 형식이 올바르지 않습니다.");
  const profile = await getProfile(user.id);
  if (!profile?.onboarded_at)
    return jsonError(403, "forbidden", "프로필 설정을 먼저 완료해 주세요.");

  return ndjsonResponse<ChatEvent>(
    async (send) => {
      const { conversationId } = await chatTurn({
        userId: user.id,
        profile,
        conversationId: parsed.data.conversationId,
        message: parsed.data.message,
        piiConfirmed: Boolean(parsed.data.piiConfirmed),
        onConversation: (id) => send({ type: "conversation", conversationId: id }),
        onDelta: (text) => send({ type: "delta", text }),
        signal: request.signal,
      });
      send({ type: "done", conversationId });
    },
    async (e) => {
      if (e.code !== "pii") await trackEvent("analysis.chat_failed", { code: e.code });
    },
  );
}
