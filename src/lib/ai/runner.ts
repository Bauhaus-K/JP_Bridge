import type Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";

import type { AiRunStatus, Json, QuotaResult } from "@/lib/db/database.types";
import { AiError, classifyApiError } from "./errors";

/** server-side refusal fallback(`fallbacks: "default"`)을 지원하는 모델 */
const SERVER_FALLBACK_MODELS = new Set([
  "claude-fable-5-1",
  "claude-opus-5-5",
  "claude-opus-5",
  "claude-sonnet-5-5",
]);

export type AiRunLog = {
  feature: string;
  model: string;
  prompt_version: string;
  input_tokens: number | null;
  output_tokens: number | null;
  latency_ms: number;
  status: AiRunStatus;
  error_code: string | null;
  attempt: number;
  raw: Json | null;
};

export type AiRunnerDeps = {
  client: Pick<Anthropic, "beta">;
  consumeQuota: () => Promise<QuotaResult>;
  refundQuota: () => Promise<void>;
  logRun: (log: AiRunLog) => Promise<void>;
  now?: () => number;
};

export type StructuredRequest<S extends z.ZodType> = {
  feature: string;
  promptVersion: string;
  model: string;
  system: string;
  userMessage: string;
  schema: S;
  /** 스키마 통과 후 추가 검사. 문제 설명(모델에게 전달)을 반환하면 1회 재시도한다. */
  validate?: (data: z.infer<S>) => string | null;
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
  maxTokens?: number;
  /** 원문(입력·출력) 저장 여부 — 사용자 옵트인 시에만 true */
  storeRaw?: boolean;
  onProgress?: (info: { outputChars: number; attempt: number }) => void;
  signal?: AbortSignal;
};

export type StructuredResult<T> = {
  data: T;
  model: string;
  attempts: number;
  usage: { input_tokens: number; output_tokens: number };
};

const MAX_ATTEMPTS = 2; // 최초 1회 + 검증 실패 시 1회 재시도

type Failure = { reason: string; text: string };

function extractText(message: Anthropic.Beta.BetaMessage): string {
  return message.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

function describeZodError(error: z.ZodError): string {
  return error.issues
    .slice(0, 5)
    .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("; ");
}

export function createAiRunner(deps: AiRunnerDeps) {
  const now = deps.now ?? (() => Date.now());

  return async function runStructured<S extends z.ZodType>(
    req: StructuredRequest<S>,
  ): Promise<StructuredResult<z.infer<S>>> {
    const quota = await deps.consumeQuota();
    if (!quota.allowed) {
      await deps.logRun({
        feature: req.feature,
        model: req.model,
        prompt_version: req.promptVersion,
        input_tokens: null,
        output_tokens: null,
        latency_ms: 0,
        status: "quota_exceeded",
        error_code: quota.reason,
        attempt: 0,
        raw: null,
      });
      throw new AiError(quota.reason === "minute" ? "quota_minute" : "quota_day");
    }

    const messages: Anthropic.Beta.BetaMessageParam[] = [
      { role: "user", content: req.userMessage },
    ];
    const useFallback = SERVER_FALLBACK_MODELS.has(req.model);
    const usage = { input_tokens: 0, output_tokens: 0 };
    let lastFailure: Failure | null = null;

    try {
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        if (lastFailure) {
          // 직전 출력과 문제점을 대화로 이어 붙여 고치게 한다 (prefill 아님)
          messages.push({ role: "assistant", content: lastFailure.text || "(empty)" });
          messages.push({
            role: "user",
            content: `直前の出力には次の問題がありました: ${lastFailure.reason}\n問題を修正し、指定のJSON形式で全体をもう一度出力してください。`,
          });
        }

        const started = now();
        let outputChars = 0;
        const stream = deps.client.beta.messages.stream(
          {
            model: req.model,
            max_tokens: req.maxTokens ?? 16000,
            system: [{ type: "text", text: req.system, cache_control: { type: "ephemeral" } }],
            messages,
            output_config: {
              effort: req.effort ?? "medium",
              // SDK 헬퍼의 parse 함수는 넘기지 않는다: 넘기면 finalMessage() 가 스키마 불일치에서
              // 자체 예외를 던져 우리 재시도 로직을 건너뛴다. 스키마(제약 제거본)만 쓰고 검증은 직접 한다.
              format: { type: "json_schema", schema: betaZodOutputFormat(req.schema).schema },
            },
            ...(useFallback
              ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
              : {}),
          },
          { signal: req.signal },
        );
        stream.on("text", (delta) => {
          outputChars += delta.length;
          req.onProgress?.({ outputChars, attempt });
        });

        let message: Anthropic.Beta.BetaMessage;
        try {
          message = await stream.finalMessage();
        } catch (error) {
          await deps.logRun({
            feature: req.feature,
            model: req.model,
            prompt_version: req.promptVersion,
            input_tokens: null,
            output_tokens: null,
            latency_ms: now() - started,
            status: "api_error",
            error_code: classifyApiError(error),
            attempt,
            raw: null,
          });
          throw new AiError(classifyApiError(error), String(error));
        }

        usage.input_tokens += message.usage.input_tokens;
        usage.output_tokens += message.usage.output_tokens;
        const text = extractText(message);
        const baseLog = {
          feature: req.feature,
          model: message.model,
          prompt_version: req.promptVersion,
          input_tokens: message.usage.input_tokens,
          output_tokens: message.usage.output_tokens,
          latency_ms: now() - started,
          attempt,
          raw: req.storeRaw ? ({ input: req.userMessage, output: text } as Json) : null,
        };

        if (message.stop_reason === "refusal") {
          await deps.logRun({ ...baseLog, status: "api_error", error_code: "refusal" });
          throw new AiError("refusal");
        }

        let failure: string | null = null;
        let data: z.infer<S> | undefined;
        if (message.stop_reason === "max_tokens") {
          failure = "出力が長すぎて途中で切れました。より簡潔に出力してください。";
        } else {
          let json: unknown;
          try {
            json = JSON.parse(text);
          } catch {
            failure = "JSONとして解析できませんでした。";
          }
          if (!failure) {
            const parsed = req.schema.safeParse(json);
            if (!parsed.success) {
              failure = `スキーマに合いません: ${describeZodError(parsed.error)}`;
            } else {
              data = parsed.data;
              failure = req.validate?.(parsed.data) ?? null;
            }
          }
        }

        if (!failure && data !== undefined) {
          await deps.logRun({ ...baseLog, status: "success", error_code: null });
          return { data, model: message.model, attempts: attempt, usage };
        }

        await deps.logRun({
          ...baseLog,
          status: "validation_error",
          error_code: (failure ?? "unknown").slice(0, 200),
        });
        lastFailure = { reason: failure ?? "unknown", text };
      }
      throw new AiError("validation_failed", lastFailure?.reason);
    } catch (error) {
      // 사용자 책임이 아닌 실패는 사용 횟수를 돌려준다
      await deps.refundQuota().catch(() => undefined);
      throw error instanceof AiError ? error : new AiError(classifyApiError(error), String(error));
    }
  };
}
