import { z } from "zod";

import { jsonError, ndjsonResponse } from "@/lib/ai/ndjson-response";
import { getProfile, getSessionUser } from "@/lib/auth/session";
import { translateCareer } from "@/lib/career/service";
import type { CareerEvent } from "@/lib/career/types";

export const maxDuration = 300;

const bodySchema = z.object({
  title: z.string().trim().min(1).max(60),
  text: z.string().max(20000),
  targetRole: z.string().trim().max(60).nullable().optional(),
  piiConfirmed: z.boolean().optional(),
});

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return jsonError(401, "unauthorized", "로그인이 필요합니다.");
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "invalid_input", "제목과 경력 내용을 확인해 주세요.");
  const profile = await getProfile(user.id);
  if (!profile?.onboarded_at)
    return jsonError(403, "forbidden", "프로필 설정을 먼저 완료해 주세요.");

  return ndjsonResponse<CareerEvent>(async (send) => {
    let last = 0;
    const { id } = await translateCareer({
      userId: user.id,
      profile,
      title: parsed.data.title,
      text: parsed.data.text,
      targetRole: parsed.data.targetRole ?? null,
      piiConfirmed: Boolean(parsed.data.piiConfirmed),
      signal: request.signal,
      onProgress: ({ outputChars, attempt }) => {
        if (outputChars - last >= 40) {
          last = outputChars;
          send({ type: "progress", outputChars, attempt });
        }
      },
    });
    send({ type: "result", id });
  });
}
