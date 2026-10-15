import { AiError } from "./errors";

export type StreamErrorEvent = { type: "error"; code: string; message: string };

/** AiError 또는 code/message 를 가진 도메인 오류를 클라이언트용 이벤트로 바꾼다. */
export function toErrorEvent(error: unknown): StreamErrorEvent {
  if (error instanceof AiError)
    return { type: "error", code: error.code, message: error.userMessage };
  if (error instanceof Error && "code" in error && typeof error.code === "string") {
    return { type: "error", code: error.code, message: error.message };
  }
  console.error("[ai-stream]", error);
  return {
    type: "error",
    code: "unknown",
    message: "알 수 없는 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
  };
}

/** NDJSON 스트림 응답. run 안에서 send 로 이벤트를 보내고, 예외는 error 이벤트로 바꾼다. */
export function ndjsonResponse<E>(
  run: (send: (event: E) => void) => Promise<void>,
  onError?: (event: StreamErrorEvent) => Promise<void> | void,
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: E | StreamErrorEvent) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          // 클라이언트 연결 종료
        }
      };
      try {
        await run(send);
      } catch (error) {
        const event = toErrorEvent(error);
        await onError?.(event);
        send(event);
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

export function jsonError(status: number, code: string, message: string) {
  return Response.json({ type: "error", code, message } satisfies StreamErrorEvent, { status });
}
