import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { completeOnboarding, loginWithMagicLink, uniqueEmail } from "./helpers";

async function expectNoViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const summary = results.violations.map(
    (v) =>
      `${label} :: ${v.id} (${v.impact}) — ${v.nodes
        .map((n) => n.target.join(" "))
        .slice(0, 3)
        .join(" | ")}`,
  );
  expect(summary, summary.join("\n")).toEqual([]);
}

test("공개 페이지 접근성 (WCAG 2.1 AA 자동 검사)", async ({ page }) => {
  for (const path of ["/", "/login", "/legal/privacy", "/legal/ai-notice"]) {
    await page.goto(path);
    await expectNoViolations(page, path);
  }
});

test("로그인 후 주요 화면 접근성", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  await loginWithMagicLink(page, uniqueEmail(`a11y-${testInfo.project.name}`));
  await expectNoViolations(page, "/onboarding");
  await completeOnboarding(page, "접근성");

  // 각 기능에 데이터를 하나씩 만들어 결과 화면까지 검사한다
  await page.goto("/es/new");
  await expectNoViolations(page, "/es/new");
  await page.getByLabel("문항 유형").selectOption("self_pr");
  await page.getByLabel("제목").fill("自己PR");
  await page.getByLabel("글자 수 제한 (선택)").fill("200");
  await page.getByRole("button", { name: "만들기" }).click();
  await page
    .getByLabel(/본문$/)
    .fill("私の強みは粘り強さです。テニスサークルで新入部員の定着に頑張りました。");
  await page.getByRole("button", { name: "AI 첨삭 받기" }).click();
  await expect(page.getByTestId("review-result")).toBeVisible({ timeout: 30_000 });
  await expectNoViolations(page, "/es/[docId] with review");
  await page.getByRole("link", { name: "버전 비교하기" }).click();
  await expectNoViolations(page, "/es/[docId]/compare");

  await page.goto("/analysis/chat");
  await page.getByLabel("메시지").fill("동아리에서 신입 부원을 위한 멘토 제도를 만들었어요.");
  await page.getByLabel("메시지").press("Enter");
  await expect(page.getByText("그때 직접 어떤 방법을 시도하셨는지")).toBeVisible();
  await expectNoViolations(page, "/analysis/chat");

  await page.goto("/interview");
  await expectNoViolations(page, "/interview");
  await page.getByLabel("질문 수").selectOption("3");
  await page.getByRole("button", { name: "면접 시작" }).click();
  await expect(page.getByTestId("current-question")).toBeVisible({ timeout: 30_000 });
  await expectNoViolations(page, "/interview/[id]");

  await page.goto("/checklist");
  await page.getByRole("button", { name: "만들기" }).click();
  await expect(page.getByRole("heading", { name: "비자" })).toBeVisible();

  for (const path of [
    "/dashboard",
    "/es",
    "/analysis",
    "/analysis/episodes",
    "/career",
    "/career/new",
    "/checklist",
    "/settings",
  ]) {
    await page.goto(path);
    await expectNoViolations(page, path);
  }
});

test("운영자 화면 접근성", async ({ page }, testInfo) => {
  const adminEmail = process.env.E2E_ADMIN_EMAIL;
  test.skip(!adminEmail || testInfo.project.name !== "desktop", "데스크톱 + E2E_ADMIN_EMAIL");
  await loginWithMagicLink(page, adminEmail!, "/admin");
  if (page.url().endsWith("/onboarding")) await completeOnboarding(page, "운영자");
  for (const path of [
    "/admin",
    "/admin/reviews",
    "/admin/users",
    "/admin/metrics",
    "/admin/partners",
    "/admin/referrals",
  ]) {
    await page.goto(path);
    await expectNoViolations(page, path);
  }
});

test("키보드: 본문 건너뛰기 링크와 주요 메뉴 포커스", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "데스크톱 키보드 시나리오");
  await loginWithMagicLink(page, uniqueEmail("kbd"));
  await completeOnboarding(page, "키보드");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "본문으로 건너뛰기" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main$/);

  // 사이드바 메뉴를 Tab 으로 이동해 Enter 로 진입
  const esLink = page
    .getByRole("navigation", { name: "주요 메뉴" })
    .getByRole("link", { name: "ES 첨삭" });
  await esLink.focus();
  await expect(esLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/es$/);
});
