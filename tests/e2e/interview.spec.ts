import { expect, test } from "@playwright/test";

import { completeOnboarding, loginWithMagicLink, uniqueEmail } from "./helpers";

test("모의면접: 질문 생성 → 답변·피드백 → 꼬리질문 → 리포트 → 검수 요청", async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  await loginWithMagicLink(page, uniqueEmail(`iv-${testInfo.project.name}`));
  await completeOnboarding(page, "한서윤");

  await page.goto("/interview");
  await page.getByLabel("기업명 (선택)").fill("サンプル商事");
  await page.getByLabel("면접 단계").selectOption("first");
  await page.getByLabel("질문 수").selectOption("3");
  await page.getByRole("button", { name: "면접 시작" }).click();

  await expect(page).toHaveURL(/\/interview\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  await expect(page.getByText("본질문 0 / 3 답변 완료")).toBeVisible();
  const question = page.getByTestId("current-question");
  await expect(question).toHaveText("まず、簡単に自己紹介をお願いします。");

  await page.getByRole("button", { name: "질문 의도·답변 팁" }).click();
  await expect(page.getByText("결론을 먼저 말하고 구체적인 행동을 덧붙이세요.")).toBeVisible();

  // 1번 답변 → 피드백 + 꼬리질문
  await page
    .getByLabel("내 답변")
    .fill("韓国の大学で経営学を専攻しているキムと申します。御社で頑張りたいと思います。");
  await page.getByRole("button", { name: "답변 제출" }).click();
  const fb = page.getByTestId("interview-feedback");
  await expect(fb).toBeVisible({ timeout: 30_000 });
  await expect(fb.getByText("貢献したいと考えております")).toBeVisible();
  await expect(page.getByTestId("ai-disclaimer")).toBeVisible();
  await page.getByRole("button", { name: "꼬리질문 받기" }).click();
  await expect(question).toHaveText("その経験で一番苦労したことは何ですか。");
  await expect(page.getByText("꼬리질문", { exact: true })).toBeVisible();

  // 꼬리질문 답변 → 꼬리질문 없이 다음 질문
  await page.getByLabel("내 답변").fill("新入部員の定着が一番苦労しました。");
  await page.getByRole("button", { name: "답변 제출" }).click();
  await expect(fb).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "다음 질문" }).click();
  await expect(question).toHaveText("学生時代に最も力を入れたことを教えてください。");
  await expect(page.getByText("본질문 1 / 3 답변 완료")).toBeVisible();

  // 중간 종료 → 리포트
  await page.getByRole("button", { name: "면접 종료하고 리포트 받기" }).click();
  const report = page.getByTestId("interview-report");
  await expect(report).toBeVisible({ timeout: 30_000 });
  await expect(
    report.getByText("결론을 먼저 말하는 구조가 좋았습니다", { exact: false }),
  ).toBeVisible();
  await expect(report.getByText("あなたの弱みは何ですか。")).toBeVisible();
  await expect(page.getByText(/점|合格/).filter({ hasText: /\d+점/ })).toHaveCount(0);

  await page.getByRole("button", { name: "검수 요청" }).click();
  await expect(page.getByText("운영자 검수를 요청했습니다.")).toBeVisible();

  await page.goto("/interview");
  await expect(page.getByRole("link", { name: /サンプル商事/ })).toContainText("완료");
});
