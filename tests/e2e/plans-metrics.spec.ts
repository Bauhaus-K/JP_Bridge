import { expect, test } from "@playwright/test";

import { completeOnboarding, loginWithMagicLink, uniqueEmail } from "./helpers";

test("플랜: 사용자 프로 신청 → 운영자 활성화 → 한도 증가, 지표 대시보드", async ({
  browser,
}, testInfo) => {
  const adminEmail = process.env.E2E_ADMIN_EMAIL;
  test.skip(!adminEmail, "E2E_ADMIN_EMAIL 미설정");
  test.skip(testInfo.project.name !== "desktop", "데스크톱에서만");
  test.setTimeout(120_000);

  const email = uniqueEmail("plan-user");
  const userCtx = await browser.newContext();
  const user = await userCtx.newPage();
  await loginWithMagicLink(user, email);
  await completeOnboarding(user, "플랜테스트");

  await user.getByRole("link", { name: "설정" }).click();
  const plan = user.getByTestId("plan-section");
  await expect(plan.getByText("무료", { exact: true }).first()).toBeVisible();
  await expect(plan.getByRole("meter", { name: /오늘 AI 코칭/ })).toHaveAttribute(
    "aria-valuemax",
    "10",
  );
  await user.getByLabel("문의 사항 (선택)").fill("계좌이체로 결제하고 싶어요");
  await user.getByRole("button", { name: "프로 플랜 신청" }).click();
  // 신청 후 화면이 '접수됨' 상태로 다시 그려진다
  await expect(user.getByText("프로 플랜 신청이 접수되었습니다.")).toBeVisible();
  await user.reload();
  await expect(user.getByRole("button", { name: "신청 취소" })).toBeVisible();

  // 원문 활용 동의 토글
  await user.getByLabel(/AI 입력·출력 원문을 저장·활용/).check();
  await user.getByRole("button", { name: "저장", exact: true }).click();
  await expect(user.getByText("원문 활용에 동의했습니다.")).toBeVisible();

  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await loginWithMagicLink(admin, adminEmail!, "/admin");
  if (admin.url().endsWith("/onboarding")) {
    await completeOnboarding(admin, "운영자");
  }
  await admin.goto("/admin/users?filter=requests");
  const row = admin.getByTestId(`user-row-${email}`);
  await expect(row.getByText("계좌이체로 결제하고 싶어요")).toBeVisible();
  await row.getByLabel(/활성화 기간/).selectOption("3");
  await Promise.all([
    admin.waitForResponse((r) => r.request().method() === "POST" && r.ok()),
    row.getByRole("button", { name: /프로 활성화/ }).click(),
  ]);
  await admin.goto("/admin/users");
  await expect(
    admin.getByTestId(`user-row-${email}`).getByText("프로", { exact: true }),
  ).toBeVisible();

  await user.reload();
  await expect(user.getByText("프로 플랜을 이용 중입니다.")).toBeVisible();
  await expect(
    user.getByTestId("plan-section").getByRole("meter", { name: /오늘 AI 코칭/ }),
  ).toHaveAttribute("aria-valuemax", "100");

  // 지표
  await admin.goto("/admin/metrics");
  await expect(admin.getByTestId("paid-goal")).toBeVisible();
  await expect(admin.getByRole("meter", { name: "유료 전환 목표 달성률" })).toBeVisible();
  await expect(admin.getByText("주별 신규 가입 (최근 8주)")).toBeVisible();
  await expect(admin.getByTestId("feature-usage")).toBeVisible();

  // 해지
  await admin.goto("/admin/users");
  await Promise.all([
    admin.waitForResponse((r) => r.request().method() === "POST" && r.ok()),
    admin
      .getByTestId(`user-row-${email}`)
      .getByRole("button", { name: /프로 해지/ })
      .click(),
  ]);
  await user.reload();
  await expect(
    user.getByTestId("plan-section").getByRole("meter", { name: /오늘 AI 코칭/ }),
  ).toHaveAttribute("aria-valuemax", "10");

  await userCtx.close();
  await adminCtx.close();
});
