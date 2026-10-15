import { expect, type Page } from "@playwright/test";

/** Supabase 로컬 메일 수신함(Mailpit). Supabase CLI 기본 포트는 54324. */
export const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

type MailpitSummary = { ID: string; Created: string };

async function latestMessageId(email: string, after: number): Promise<string | null> {
  const res = await fetch(
    `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
  );
  if (!res.ok) return null;
  const body = (await res.json()) as { messages: MailpitSummary[] };
  const fresh = body.messages.filter((m) => new Date(m.Created).getTime() >= after);
  return fresh[0]?.ID ?? null;
}

export async function waitForMagicLink(email: string, after: number): Promise<string> {
  let id: string | null = null;
  await expect
    .poll(async () => (id = await latestMessageId(email, after)), { timeout: 20_000 })
    .not.toBeNull();
  const res = await fetch(`${MAILPIT_URL}/api/v1/message/${id}`);
  const msg = (await res.json()) as { HTML: string; Text: string };
  const match =
    /href="([^"]*\/auth\/v1\/verify[^"]*)"/.exec(msg.HTML) ??
    /(http\S*\/auth\/v1\/verify\S*)/.exec(msg.Text);
  if (!match) throw new Error("magic link not found in email");
  return match[1].replace(/&amp;/g, "&");
}

export function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
}

/** 로그인 페이지에서 매직링크를 요청하고, 메일의 링크로 로그인한다. */
export async function loginWithMagicLink(page: Page, email: string, next?: string) {
  const startedAt = Date.now() - 1000;
  await page.goto(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  await page.getByLabel("이메일").fill(email);
  await page.getByRole("button", { name: "이메일로 로그인 링크 받기" }).click();
  await expect(page.getByText(`${email}로 로그인 링크를 보냈습니다.`)).toBeVisible();
  const link = await waitForMagicLink(email, startedAt);
  await page.goto(link);
}

export async function completeOnboarding(page: Page, name: string) {
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByLabel("이름(닉네임)").fill(name);
  await page.getByLabel(/新卒 \(졸업 예정/).check();
  await page.getByLabel("일본어 수준 (JLPT)").selectOption("N2");
  await page.getByLabel("졸업 (예정) 월").fill(nextMonths(4));
  await page.getByLabel("목표 입사 시기").fill(nextMonths(6));
  await page.getByText("ソフトウェアエンジニア (개발)").click();
  await page.getByLabel("위 내용을 확인했습니다.").check();
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

function nextMonths(n: number) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
