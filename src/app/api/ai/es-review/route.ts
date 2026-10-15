import { z } from "zod";

import { AiError } from "@/lib/ai/errors";
import { trackEvent } from "@/lib/analytics";
import { getProfile, getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { EsError, getEsDocument, reviewEsDraft, saveUserVersion } from "@/lib/es/service";
import type { EsReviewEvent } from "@/lib/es/types";

export const maxDuration = 300;

const bodySchema = z.object({
  docId: z.uuid(),
  content: z.string().max(20000),
  parentVersionId: z.uuid().nullable(),
  beforeRating: z.number().int().min(1).max(5).nullable().optional(),
  piiConfirmed: z.boolean().optional(),
});

function json(status: number, event: EsReviewEvent) {
  return Response.json(event, { status });
}

/**
 * ES AI 첨삭. 응답은 NDJSON 스트림(EsReviewEvent 한 줄씩).
 * 입력 검증·저장 오류는 일반 JSON 오류 응답으로 즉시 반환한다.
 */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user)
    return json(401, { type: "error", code: "unauthorized", message: "로그인이 필요합니다." });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return json(400, {
      type: "error",
      code: "invalid_input",
      message: "요청 형식이 올바르지 않습니다.",
    });
  }
  const body = parsed.data;

  const [profile, doc] = await Promise.all([getProfile(user.id), getEsDocument(body.docId)]);
  if (!profile || !doc) {
    return json(404, { type: "error", code: "not_found", message: "ES 문서를 찾을 수 없습니다." });
  }

  let sourceVersionId: string;
  try {
    const saved = await saveUserVersion({
      docId: doc.id,
      content: body.content,
      parentVersionId: body.parentVersionId,
      piiConfirmed: Boolean(body.piiConfirmed),
    });
    sourceVersionId = saved.versionId;
  } catch (error) {
    if (error instanceof EsError) {
      return json(400, { type: "error", code: error.code, message: error.message });
    }
    throw error;
  }

  if (body.beforeRating) {
    const supabase = await createClient();
    await supabase.from("feedback_ratings").insert({
      feature: "es_review",
      target_id: sourceVersionId,
      phase: "before",
      rating: body.beforeRating,
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: EsReviewEvent) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          // 클라이언트 연결이 끊긴 경우
        }
      };
      send({ type: "saved", sourceVersionId });

      let lastSent = 0;
      try {
        const review = await reviewEsDraft({
          userId: user.id,
          profile,
          doc,
          sourceVersionId,
          content: body.content.replace(/\r\n?/g, "\n").trimEnd(),
          signal: request.signal,
          onProgress: ({ outputChars, attempt }) => {
            if (outputChars - lastSent >= 40) {
              lastSent = outputChars;
              send({ type: "progress", outputChars, attempt });
            }
          },
        });
        send({ type: "result", sourceVersionId, review });
      } catch (error) {
        const code = error instanceof AiError || error instanceof EsError ? error.code : "unknown";
        const message =
          error instanceof AiError
            ? error.userMessage
            : error instanceof EsError
              ? error.message
              : "알 수 없는 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";
        if (!(error instanceof AiError || error instanceof EsError))
          console.error("[es-review]", error);
        await trackEvent("es.review_failed", { code });
        send({ type: "error", code, message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
