import Anthropic from "@anthropic-ai/sdk";

export type AiErrorCode =
  | "quota_day"
  | "quota_minute"
  | "ai_busy"
  | "network"
  | "validation_failed"
  | "refusal"
  | "config"
  | "bad_request"
  | "unknown";

const MESSAGES: Record<AiErrorCode, string> = {
  quota_day:
    "오늘 사용할 수 있는 AI 코칭 횟수를 모두 사용했습니다. 내일 다시 이용하거나 프로 플랜을 이용해 주세요.",
  quota_minute: "요청이 너무 잦습니다. 1분 정도 기다린 뒤 다시 시도해 주세요.",
  ai_busy:
    "AI 서버가 혼잡합니다. 잠시 후 다시 시도해 주세요. 이번 요청은 사용 횟수에서 차감되지 않았습니다.",
  network:
    "AI 서버와 연결하지 못했습니다. 네트워크 상태를 확인하고 다시 시도해 주세요. 이번 요청은 사용 횟수에서 차감되지 않았습니다.",
  validation_failed:
    "AI 결과를 정리하지 못했습니다. 다시 시도해 주세요. 이번 요청은 사용 횟수에서 차감되지 않았습니다.",
  refusal:
    "이 내용은 AI가 처리할 수 없었습니다. 내용을 확인한 뒤 다시 시도해 주세요. 이번 요청은 사용 횟수에서 차감되지 않았습니다.",
  config: "AI 기능 설정에 문제가 있습니다. 운영자에게 문의해 주세요.",
  bad_request: "요청을 처리할 수 없습니다. 입력이 너무 길지 않은지 확인해 주세요.",
  unknown: "알 수 없는 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
};

export class AiError extends Error {
  constructor(
    public readonly code: AiErrorCode,
    public readonly detail?: string,
  ) {
    super(MESSAGES[code]);
    this.name = "AiError";
  }

  get userMessage() {
    return MESSAGES[this.code];
  }
}

export function aiErrorMessage(code: AiErrorCode) {
  return MESSAGES[code];
}

/** SDK 오류를 사용자 메시지용 코드로 분류한다 (구체적인 클래스부터). */
export function classifyApiError(error: unknown): AiErrorCode {
  if (error instanceof AiError) return error.code;
  if (error instanceof Anthropic.AuthenticationError) return "config";
  if (error instanceof Anthropic.PermissionDeniedError) return "config";
  if (error instanceof Anthropic.NotFoundError) return "config";
  if (error instanceof Anthropic.BadRequestError) return "bad_request";
  if (error instanceof Anthropic.RateLimitError) return "ai_busy";
  if (error instanceof Anthropic.InternalServerError) return "ai_busy"; // 5xx, 529 overloaded 포함
  if (error instanceof Anthropic.APIConnectionError) return "network"; // 타임아웃 포함
  if (error instanceof Anthropic.APIError) {
    return error.status && error.status >= 500 ? "ai_busy" : "unknown";
  }
  return "unknown";
}
