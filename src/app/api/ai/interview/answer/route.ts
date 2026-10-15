import { z } from "zod";

import { jsonError, ndjsonResponse } from "@/lib/ai/ndjson-response";
import { getProfile, getSessionUser } from "@/lib/auth/session";
import { answerTurn } from "@/lib/interview/service";
import type { AnswerEvent } from "@/lib/interview/types";

export const maxDuration = 300;

const bodySchema = z.object({
  turnId: z.uuid(),
  answer: z.string().max(10000),
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

  return ndjsonResponse<AnswerEvent>(async (send) => {
    let last = 0;
    const { turn, followup } = await answerTurn({
      userId: user.id,
      profile,
      turnId: parsed.data.turnId,
      answer: parsed.data.answer,
      piiConfirmed: Boolean(parsed.data.piiConfirmed),
      signal: request.signal,
      onProgress: ({ outputChars, attempt }) => {
        if (outputChars - last >= 40) {
          last = outputChars;
          send({ type: "progress", outputChars, attempt });
        }
      },
    });
    send({ type: "result", turn, followup });
  });
}
