/** fetch 응답 본문을 NDJSON 이벤트로 읽는다. 마지막 줄의 개행이 없어도 처리한다. */
export async function* readNdjson<T>(body: ReadableStream<Uint8Array>): AsyncGenerator<T> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    let idx: number;
    while ((idx = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (line) yield JSON.parse(line) as T;
    }
    if (done) break;
  }
  const rest = buffer.trim();
  if (rest) yield JSON.parse(rest) as T;
}

type ErrorLike = { type: "error"; code: string; message: string };

/**
 * NDJSON 스트리밍 API 를 호출한다. 스트림이 아닌 오류 응답(400 등)도 error 이벤트로 바꿔 전달한다.
 * 네트워크 오류는 code 'network' 의 error 이벤트가 된다.
 */
export async function postNdjson<E extends { type: string }>(
  url: string,
  body: unknown,
  onEvent: (event: E | ErrorLike) => void,
  signal?: AbortSignal,
): Promise<void> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
    if (!res.body || !res.headers.get("content-type")?.includes("ndjson")) {
      const err = (await res.json().catch(() => null)) as ErrorLike | null;
      onEvent(
        err?.type === "error"
          ? err
          : {
              type: "error",
              code: "unknown",
              message: "요청을 처리하지 못했습니다. 다시 시도해 주세요.",
            },
      );
      return;
    }
    for await (const event of readNdjson<E | ErrorLike>(res.body)) onEvent(event);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return;
    onEvent({
      type: "error",
      code: "network",
      message: "네트워크 오류로 결과를 받지 못했습니다. 연결을 확인하고 다시 시도해 주세요.",
    });
  }
}
