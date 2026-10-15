import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { AiError, classifyApiError } from "@/lib/ai/errors";
import { createAiRunner, type AiRunLog } from "@/lib/ai/runner";
import type { QuotaResult } from "@/lib/db/database.types";

/** 러너가 SDK 에 넘기는 요청 중 테스트가 확인하는 부분 */
type SentParams = {
  output_config: { effort: string; format: { type: string; schema: { type: string } } };
  fallbacks?: string;
  betas?: string[];
  tool_choice?: unknown;
  system: { cache_control?: unknown }[];
  messages: { role: string; content: string }[];
};

type Reply = { text: string; stop_reason?: string; model?: string } | { error: unknown };

/** client.beta.messages.stream 를 흉내 내는 가짜 클라이언트 */
function fakeClient(replies: Reply[]) {
  const calls: Record<string, unknown>[] = [];
  const rawCalls: SentParams[] = [];
  const stream = vi.fn((params: Record<string, unknown>) => {
    rawCalls.push(params as unknown as SentParams);
    calls.push(JSON.parse(JSON.stringify(params)));
    const reply = replies.shift();
    if (!reply) throw new Error("no more replies");
    const listeners: ((d: string) => void)[] = [];
    return {
      on(event: string, cb: (d: string) => void) {
        if (event === "text") listeners.push(cb);
        return this;
      },
      async finalMessage() {
        if ("error" in reply) throw reply.error;
        listeners.forEach((l) => l(reply.text));
        return {
          model: reply.model ?? "claude-sonnet-5-5",
          stop_reason: reply.stop_reason ?? "end_turn",
          content: [{ type: "text", text: reply.text }],
          usage: { input_tokens: 100, output_tokens: 50 },
        };
      },
    };
  });
  return {
    client: { beta: { messages: { stream } } } as unknown as Pick<Anthropic, "beta">,
    calls,
    rawCalls,
    stream,
  };
}

const allowed: QuotaResult = {
  allowed: true,
  reason: null,
  plan: "free",
  day_limit: 10,
  day_used: 1,
};
const schema = z.object({ answer: z.string(), n: z.number().int().max(10) });

function setup(replies: Reply[], quota: QuotaResult = allowed) {
  const { client, calls, rawCalls, stream } = fakeClient(replies);
  const logs: AiRunLog[] = [];
  const refund = vi.fn(async () => undefined);
  const run = createAiRunner({
    client,
    consumeQuota: async () => quota,
    refundQuota: refund,
    logRun: async (l) => {
      logs.push(l);
    },
    now: () => 1000,
  });
  const request = {
    feature: "test",
    promptVersion: "test@1",
    model: "claude-sonnet-5-5",
    system: "sys",
    userMessage: "hello",
    schema,
  };
  return { run, request, logs, refund, calls, rawCalls, stream };
}

describe("createAiRunner", () => {
  it("returns parsed data, logs success, and sends structured-output + fallback params", async () => {
    const { run, request, logs, refund, calls, rawCalls } = setup([
      { text: '{"answer":"ok","n":3}' },
    ]);
    const progress = vi.fn();
    const res = await run({ ...request, onProgress: progress });
    expect(res.data).toEqual({ answer: "ok", n: 3 });
    expect(res.attempts).toBe(1);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      status: "success",
      attempt: 1,
      prompt_version: "test@1",
      raw: null,
    });
    expect(refund).not.toHaveBeenCalled();
    expect(progress).toHaveBeenCalled();

    const params = calls[0] as unknown as SentParams;
    expect(params.output_config.format.type).toBe("json_schema");
    expect(params.output_config.format.schema.type).toBe("object");
    // SDK 자동 파싱을 막기 위해 parse 함수를 넘기지 않는다 (넘기면 재시도 전에 SDK 가 예외를 던진다)
    expect(rawCalls[0].output_config.format).not.toHaveProperty("parse");
    expect(params.output_config.effort).toBe("medium");
    expect(params.fallbacks).toBe("default");
    expect(params.betas).toEqual(["server-side-fallback-2026-07-01"]);
    expect(params.tool_choice).toBeUndefined(); // 강제 tool_choice 는 Sonnet 5.5 에서 400
    expect(params.system[0].cache_control).toEqual({ type: "ephemeral" });
  });

  it("does not send fallbacks for models without server-side fallback", async () => {
    const { run, request, calls } = setup([{ text: '{"answer":"ok","n":1}' }]);
    await run({ ...request, model: "claude-haiku-5-5" });
    expect((calls[0] as Record<string, unknown>).fallbacks).toBeUndefined();
  });

  it("retries once with feedback when the output fails validation", async () => {
    const { run, request, logs, calls } = setup([
      { text: '{"answer":"ok","n":99}' },
      { text: '{"answer":"fixed","n":5}' },
    ]);
    const res = await run(request);
    expect(res.data.answer).toBe("fixed");
    expect(res.attempts).toBe(2);
    expect(logs.map((l) => l.status)).toEqual(["validation_error", "success"]);
    const second = calls[1] as { messages: { role: string; content: string }[] };
    expect(second.messages.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(second.messages[2].content).toContain("n");
  });

  it("applies the custom validate hook", async () => {
    const { run, request } = setup([
      { text: '{"answer":"long","n":1}' },
      { text: '{"answer":"s","n":1}' },
    ]);
    const res = await run({
      ...request,
      validate: (d) => (d.answer.length > 2 ? "too long" : null),
    });
    expect(res.data.answer).toBe("s");
  });

  it("fails with validation_failed after two bad outputs and refunds quota", async () => {
    const { run, request, logs, refund } = setup([{ text: "not json" }, { text: '{"answer":1}' }]);
    await expect(run(request)).rejects.toMatchObject({ code: "validation_failed" });
    expect(logs.map((l) => l.status)).toEqual(["validation_error", "validation_error"]);
    expect(refund).toHaveBeenCalledTimes(1);
  });

  it("treats max_tokens truncation as a validation failure", async () => {
    const { run, request } = setup([
      { text: '{"answer":"cut', stop_reason: "max_tokens" },
      { text: '{"answer":"ok","n":1}' },
    ]);
    await expect(run(request)).resolves.toMatchObject({ attempts: 2 });
  });

  it("does not retry refusals and refunds quota", async () => {
    const { run, request, logs, refund, stream } = setup([{ text: "", stop_reason: "refusal" }]);
    await expect(run(request)).rejects.toMatchObject({ code: "refusal" });
    expect(stream).toHaveBeenCalledTimes(1);
    expect(logs[0]).toMatchObject({ status: "api_error", error_code: "refusal" });
    expect(refund).toHaveBeenCalledTimes(1);
  });

  it("maps API errors and refunds quota", async () => {
    const overloaded = new Anthropic.InternalServerError(
      529,
      { type: "overloaded_error" },
      "Overloaded",
      new Headers(),
    );
    const { run, request, logs, refund } = setup([{ error: overloaded }]);
    const err = await run(request).catch((e) => e);
    expect(err).toBeInstanceOf(AiError);
    expect(err.code).toBe("ai_busy");
    expect(err.userMessage).toContain("차감되지 않았습니다");
    expect(logs[0]).toMatchObject({ status: "api_error", error_code: "ai_busy" });
    expect(refund).toHaveBeenCalledTimes(1);
  });

  it("rejects without calling the model when quota is exhausted", async () => {
    const { run, request, logs, refund, stream } = setup([], {
      allowed: false,
      reason: "day",
      plan: "free",
      day_limit: 10,
      day_used: 10,
    });
    await expect(run(request)).rejects.toMatchObject({ code: "quota_day" });
    expect(stream).not.toHaveBeenCalled();
    expect(logs[0]).toMatchObject({ status: "quota_exceeded", error_code: "day" });
    expect(refund).not.toHaveBeenCalled();
  });

  it("maps minute limits and stores raw only when opted in", async () => {
    const minute = setup([], {
      allowed: false,
      reason: "minute",
      plan: "free",
      day_limit: 10,
      day_used: 2,
    });
    await expect(minute.run(minute.request)).rejects.toMatchObject({ code: "quota_minute" });

    const opted = setup([{ text: '{"answer":"ok","n":1}' }]);
    await opted.run({ ...opted.request, storeRaw: true });
    expect(opted.logs[0].raw).toEqual({ input: "hello", output: '{"answer":"ok","n":1}' });
  });
});

describe("classifyApiError", () => {
  const h = new Headers();
  it.each([
    [new Anthropic.RateLimitError(429, {}, "rate", h), "ai_busy"],
    [new Anthropic.AuthenticationError(401, {}, "auth", h), "config"],
    [new Anthropic.BadRequestError(400, {}, "bad", h), "bad_request"],
    [new Anthropic.APIConnectionError({ message: "down" }), "network"],
    [new Anthropic.APIConnectionTimeoutError(), "network"],
    [new Error("boom"), "unknown"],
  ])("%s → %s", (error, code) => {
    expect(classifyApiError(error)).toBe(code);
  });
});
