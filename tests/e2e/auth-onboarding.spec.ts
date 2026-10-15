import { expect, test } from "@playwright/test";

import { completeOnboarding, loginWithMagicLink, uniqueEmail } from "./helpers";

test.describe("가입 → 온보딩 → 대시보드", () => {
  test("비로그인 사용자는 보호 경로에서 로그인으로 이동한다", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);
    await expect(page.getByRole("heading", { name: "로그인 / 가입" })).toBeVisible();
  });

  test("매직링크로 가입하고 온보딩을 마치면 대시보드가 보인다", async ({ page }, testInfo) => {
    const email = uniqueEmail(`user-${testInfo.project.name}`);
    await loginWithMagicLink(page, email);

    // 필수값 누락 시 오류를 보여주고 입력값을 유지한다
    await expect(page).toHaveURL(/\/onboarding$/);
    await page.getByLabel("이름(닉네임)").fill("테스트");
    await page.getByRole("button", { name: "시작하기" }).click();
    await expect(page.getByText("입력 내용을 확인해 주세요.")).toBeVisible();
    await expect(page.getByText("AI 활용 안내를 확인해 주세요.")).toBeVisible();
    await expect(page.getByLabel("이름(닉네임)")).toHaveValue("테스트");

    await completeOnboarding(page, "김민지");
    await expect(page.getByRole("heading", { name: "김민지님, 안녕하세요" })).toBeVisible();
    await expect(page.getByText("N2", { exact: true })).toBeVisible();
    await expect(page.getByTestId("ai-disclaimer")).toBeVisible();

    if (testInfo.project.name === "mobile") {
      await expect(page.getByRole("navigation", { name: "하단 메뉴" })).toBeVisible();
    } else {
      await expect(page.getByRole("navigation", { name: "주요 메뉴" })).toBeVisible();
    }

    // 일반 사용자는 운영자 콘솔이 존재하지 않는 것처럼 보인다
    const res = await page.goto("/admin");
    expect(res?.status()).toBe(404);

    // 로그인 상태에서 /login 은 대시보드로
    await page.goto("/login");
    await expect(page).toHaveURL(/\/dashboard$/);

    // 로그아웃
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "로그아웃" }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("로그인 후 next 경로로 돌아간다", async ({ page }, testInfo) => {
    const email = uniqueEmail(`next-${testInfo.project.name}`);
    await loginWithMagicLink(page, email, "/legal/privacy");
    await expect(page).toHaveURL(/\/legal\/privacy$/);
  });

  test("ADMIN_EMAILS 의 사용자는 운영자 콘솔에 접근한다", async ({ page }, testInfo) => {
    const adminEmail = process.env.E2E_ADMIN_EMAIL;
    test.skip(!adminEmail, "E2E_ADMIN_EMAIL 미설정");
    test.skip(testInfo.project.name !== "desktop", "관리자 시나리오는 데스크톱에서만");
    await loginWithMagicLink(page, adminEmail!);
    if (page.url().endsWith("/onboarding")) {
      await completeOnboarding(page, "운영자");
    }
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "운영자 콘솔" })).toBeVisible();
  });
});
