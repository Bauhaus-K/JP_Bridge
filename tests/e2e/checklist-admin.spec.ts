import { expect, test } from "@playwright/test";

import { completeOnboarding, loginWithMagicLink, uniqueEmail } from "./helpers";

test("체크리스트: 생성 → 완료 체크 → 대시보드 마감 임박 → 다시 만들기", async ({
  page,
}, testInfo) => {
  await loginWithMagicLink(page, uniqueEmail(`cl-${testInfo.project.name}`));
  await completeOnboarding(page, "정다은");

  await page.goto("/checklist");
  await expect(page.getByText(/비자·법령 관련 내용은 일반 정보이며/)).toBeVisible();
  await page.getByRole("button", { name: "만들기" }).click();
  await expect(page.getByRole("heading", { name: "비자" })).toBeVisible();
  await expect(page.getByText(/0 \/ \d+ 완료/)).toBeVisible();

  const item = page.getByRole("checkbox", { name: /여권 유효기간 확인/ });
  // 서버 액션 저장이 끝난 뒤 새로고침한다
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST" && r.ok()),
    item.check(),
  ]);
  await expect(page.getByText(/1 \/ \d+ 완료/)).toBeVisible();
  await page.reload();
  await expect(page.getByRole("checkbox", { name: /여권 유효기간 확인/ })).toBeChecked();

  await page.goto("/dashboard");
  await expect(page.getByTestId("upcoming-items")).toBeVisible();

  // 목표 시기를 바꿔 다시 만들어도 완료 표시는 유지된다
  await page.goto("/checklist");
  await page.getByText("목표 시기·유형 바꿔서 다시 만들기").click();
  const d = new Date();
  d.setMonth(d.getMonth() + 12);
  await page
    .getByLabel("목표 입사 월")
    .fill(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  await page.getByRole("button", { name: /다시 만들기/ }).click();
  await expect(page.getByRole("checkbox", { name: /여권 유효기간 확인/ })).toBeChecked();
});

test("운영자 검수: 사용자 요청 → 운영자 처리(수정본·코멘트) → 사용자 확인", async ({
  browser,
}, testInfo) => {
  const adminEmail = process.env.E2E_ADMIN_EMAIL;
  test.skip(!adminEmail, "E2E_ADMIN_EMAIL 미설정");
  test.skip(testInfo.project.name !== "desktop", "데스크톱에서만");
  test.setTimeout(120_000);

  // 사용자: ES 작성 → 첨삭 → 검수 요청
  const userCtx = await browser.newContext();
  const user = await userCtx.newPage();
  await loginWithMagicLink(user, uniqueEmail("rv-user"));
  await completeOnboarding(user, "검수요청자");
  await user.goto("/es/new");
  await user.getByLabel("문항 유형").selectOption("shiboudouki");
  await user.getByLabel("제목").fill("志望動機 검수");
  await user.getByRole("button", { name: "만들기" }).click();
  await user
    .getByLabel(/본문$/)
    .fill("私が貴社を志望する理由は、グローバルな事業に挑戦したいからです。");
  await user.getByRole("button", { name: "저장", exact: true }).click();
  await expect(user.getByRole("list", { name: "버전 히스토리" }).getByRole("listitem")).toHaveCount(
    1,
  );
  await user.getByRole("button", { name: "운영자 검수 요청" }).click();
  await user.getByLabel("운영자에게 전할 메모 (선택)").fill("E2E-REVIEW 표현을 봐주세요");
  await user.getByRole("button", { name: "요청하기" }).click();
  await expect(user.getByText("운영자 검수를 요청했습니다.")).toBeVisible();
  const esUrl = user.url();

  // 일반 사용자는 운영자 콘솔에 접근할 수 없다
  expect((await user.goto("/admin/reviews"))?.status()).toBe(404);

  // 운영자: 큐에서 요청을 찾아 처리
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await loginWithMagicLink(admin, adminEmail!, "/admin");
  if (admin.url().endsWith("/onboarding")) {
    await completeOnboarding(admin, "운영자");
    await admin.goto("/admin");
  }
  await admin.getByRole("link", { name: "검수 큐" }).click();
  await admin
    .getByRole("link", { name: /E2E-REVIEW/ })
    .first()
    .click();
  await expect(admin.getByTestId("review-target")).toContainText("グローバルな事業に挑戦したい");
  await admin.getByRole("button", { name: /검수 시작/ }).click();
  await expect(admin.getByText("검수 중", { exact: true })).toBeVisible();
  await admin
    .getByLabel(/검수 코멘트/)
    .fill("지원 동기에 회사의 구체적인 사업을 연결하면 더 좋아요.");
  await admin
    .getByLabel(/운영자 수정본/)
    .fill(
      "私が貴社を志望する理由は、海外インフラ事業を通じてアジアの発展に貢献したいと考えたからです。",
    );
  await admin.getByRole("button", { name: "검수 완료 및 알림 발송" }).click();
  await expect(admin.getByText("검수를 완료하고 사용자에게 알렸습니다.")).toBeVisible();

  // 사용자: 코멘트와 운영자 수정본 확인
  await user.goto(esUrl);
  await expect(user.getByTestId("admin-comment")).toContainText("회사의 구체적인 사업을 연결하면");
  const history = user.getByRole("list", { name: "버전 히스토리" });
  await expect(history.getByText("운영자 수정본")).toBeVisible();
  await expect(history.getByText("검수 완료")).toBeVisible();
  await history.getByRole("link", { name: /운영자 수정본/ }).click();
  await expect(user.getByLabel(/본문$/)).toHaveValue(/海外インフラ事業/);

  await userCtx.close();
  await adminCtx.close();
});
