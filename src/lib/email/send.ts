import "server-only";

import { createAdminClient } from "@/lib/db/admin";
import { serverEnv } from "@/lib/env";
import { createEmailProvider, emailDomain, type EmailMessage } from "./provider";

/**
 * 이메일을 보내고 email_log 에 기록한다(주소 전체는 저장하지 않음).
 * 실패해도 예외를 던지지 않고 false 를 반환한다 — 호출 측 흐름을 막지 않기 위함.
 */
export async function sendEmail(
  kind: string,
  userId: string | null,
  message: EmailMessage,
): Promise<boolean> {
  const provider = createEmailProvider(serverEnv());
  let status = "sent";
  let error: string | null = null;
  try {
    await provider.send(message);
  } catch (e) {
    status = "failed";
    error = String(e).slice(0, 300);
    console.error("[email] 발송 실패", kind, error);
  }
  const admin = createAdminClient();
  await admin.from("email_log").insert({
    user_id: userId,
    kind,
    to_domain: emailDomain(message.to),
    provider: provider.name,
    status,
    error,
  });
  return status === "sent";
}

export async function getUserEmail(userId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin.auth.admin.getUserById(userId);
  return data.user?.email ?? null;
}
