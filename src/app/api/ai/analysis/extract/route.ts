import { z } from "zod";

import { jsonError, ndjsonResponse } from "@/lib/ai/ndjson-response";
import { extractEpisodes } from "@/lib/analysis/service";
import type { ExtractEvent } from "@/lib/analysis/types";
import { getProfile, getSessionUser } from "@/lib/auth/session";

export const maxDuration = 300;

const bodySchema = z.object({ conversationId: z.uuid() });

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return jsonError(401, "unauthorized", "로그인이 필요합니다.");
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "invalid_input", "요청 형식이 올바르지 않습니다.");
  const profile = await getProfile(user.id);
  if (!profile?.onboarded_at)
    return jsonError(403, "forbidden", "프로필 설정을 먼저 완료해 주세요.");

  return ndjsonResponse<ExtractEvent>(async (send) => {
    let last = 0;
    const extraction = await extractEpisodes({
      userId: user.id,
      profile,
      conversationId: parsed.data.conversationId,
      signal: request.signal,
      onProgress: ({ outputChars, attempt }) => {
        if (outputChars - last >= 40) {
          last = outputChars;
          send({ type: "progress", outputChars, attempt });
        }
      },
    });
    send({ type: "result", extraction });
  });
}
