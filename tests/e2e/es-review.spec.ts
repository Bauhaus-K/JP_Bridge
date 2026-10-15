import { expect, test } from "@playwright/test";

import { completeOnboarding, loginWithMagicLink, uniqueEmail } from "./helpers";

const MOCK_URL = process.env.MOCK_ANTHROPIC_URL ?? "http://127.0.0.1:4010";

const DRAFT =
  "私は大学時代、テニスサークルの練習に頑張りました。毎朝早く起きて練習しました。その結果、大会で入賞しました。";

test("가입 → ES 작성 → AI 첨삭 → 수정본 적용·저장 → 버전 비교 → 검수 요청", async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  await loginWithMagicLink(page, uniqueEmail(`es-${testInfo.project.name}`));
  await completeOnboarding(page, "이수진");

  // 대시보드에서 ES 첨삭 진입
  await page.goto("/es");
  await expect(page.getByRole("heading", { name: "ES 첨삭" })).toBeVisible();
  await expect(page.getByText(/오늘 AI 10\/10회 남음/)).toBeVisible();
  await page.getByRole("link", { name: "새 ES 만들기" }).click();

  // 문서 생성
  await page.getByLabel("문항 유형").selectOption("gakuchika");
  await page.getByLabel("제목").fill("サンプル商事 ガクチカ");
  await page.getByLabel("지원 기업 (선택)").fill("サンプル商事");
  await page.getByLabel("글자 수 제한 (선택)").fill("200");
  await page.getByRole("button", { name: "만들기" }).click();
  await expect(page.getByRole("heading", { name: "サンプル商事 ガクチカ" })).toBeVisible();

  // 초안 입력 + 글자 수 + 민감정보 경고/마스킹
  const editor = page.getByLabel(/본문$/);
  await editor.fill(`${DRAFT}連絡先 990101-1234567`);
  await expect(page.getByText("주민등록번호로 보이는 내용이 있습니다.")).toBeVisible();
  await expect(page.getByRole("button", { name: "AI 첨삭 받기" })).toBeDisabled();
  await page.getByRole("button", { name: "마스킹하기" }).click();
  await expect(page.getByText("주민등록번호로 보이는 내용이 있습니다.")).toBeHidden();
  await editor.fill(DRAFT);
  await expect(page.locator("#es-count")).toContainText(`${Array.from(DRAFT).length}자 / 200자`);

  // AI 첨삭 (목 서버)
  await page.getByText("3점").click(); // 첨삭 전 만족도(선택)
  await page.getByRole("button", { name: "AI 첨삭 받기" }).click();
  const result = page.getByTestId("review-result");
  await expect(result).toBeVisible({ timeout: 30_000 });
  await expect(result.getByText("종합 코멘트")).toBeVisible();
  await expect(result.getByRole("meter")).toHaveCount(4);
  await expect(page.getByTestId("revised-text")).toContainText("粘り強く取り組みました");
  await expect(result.getByText("결론(강점)을 첫 문장에 배치했습니다.")).toBeVisible();
  await expect(result.getByTestId("ai-disclaimer")).toBeVisible();

  const history = page.getByRole("list", { name: "버전 히스토리" });
  await expect(history.getByRole("listitem")).toHaveCount(2);
  await expect(history.getByText("AI 첨삭본")).toBeVisible();
  await expect(page.getByText(/오늘 AI 9\/10회 남음/).first()).toBeVisible();

  // 만족도 평가
  await result.locator("label", { hasText: "4점 (도움 됨)" }).click();
  await expect(result.getByText("평가해 주셔서 감사합니다.")).toBeVisible();

  // 수정본 적용 → 저장 → v3
  await result.getByRole("button", { name: "에디터에 적용" }).click();
  await expect(editor).toHaveValue(/粘り強く取り組みました/);
  await expect(page.getByText("저장되지 않은 변경 사항")).toBeVisible();
  // 수정본을 그대로 저장하면 v2(AI 첨삭본)를 재사용하므로, 조금 다듬은 뒤 저장한다
  await editor.press("End");
  await editor.pressSequentially("この経験を貴社でも活かしたいです。");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(history.getByRole("listitem")).toHaveCount(3);
  await expect(page.getByText("저장되지 않은 변경 사항")).toBeHidden();

  // 버전 비교
  await page.getByRole("link", { name: "버전 비교하기" }).click();
  await expect(page.getByRole("heading", { name: "버전 비교" })).toBeVisible();
  for (const [label, prefix] of [
    ["이전", "v1 ·"],
    ["이후", "v3 ·"],
  ] as const) {
    const select = page.getByLabel(label);
    const value = await select.locator("option", { hasText: prefix }).getAttribute("value");
    await select.selectOption(value!);
  }
  await page.getByRole("button", { name: "비교" }).click();
  await expect(page.getByRole("heading", { name: "v1 → v3" })).toBeVisible();
  await expect(page.getByText(/변경 \d+문장/)).toBeVisible();
  await expect(page.locator("ins").first()).toBeVisible();

  // 운영자 검수 요청 (무료 플랜 월 1회)
  await page.goBack();
  await page.goBack();
  await expect(history.getByRole("listitem")).toHaveCount(3);
  await page.getByRole("button", { name: "운영자 검수 요청" }).click();
  await page.getByLabel("운영자에게 전할 메모 (선택)").fill("志望動機との一貫性を見てください");
  await page.getByRole("button", { name: "요청하기" }).click();
  await expect(page.getByText("운영자 검수를 요청했습니다.")).toBeVisible();
  await expect(history.getByText("검수 대기")).toBeVisible();

  // 목 서버가 받은 요청 형식 확인: 구조화 출력, 강제 tool_choice 없음, 서버측 폴백
  const requests = (await (await fetch(`${MOCK_URL}/__requests`)).json()) as {
    url: string;
    headers: Record<string, string | null>;
    body: {
      output_config: { format: { type: string } };
      tool_choice?: unknown;
      stream: boolean;
      messages: { content: string }[];
    };
  }[];
  const last = requests.at(-1)!;
  expect(last.body.output_config.format.type).toBe("json_schema");
  expect(last.body.tool_choice).toBeUndefined();
  expect(last.body.stream).toBe(true);
  expect(last.body.messages[0].content).toContain("サンプル商事");
});

test("AI 서버 혼잡 시 한국어 오류를 보여주고 사용 횟수를 차감하지 않는다", async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000);
  await loginWithMagicLink(page, uniqueEmail(`es-err-${testInfo.project.name}`));
  await completeOnboarding(page, "오류테스트");
  await page.goto("/es/new");
  await page.getByLabel("문항 유형").selectOption("self_pr");
  await page.getByLabel("제목").fill("自己PR");
  await page.getByRole("button", { name: "만들기" }).click();

  await page.getByLabel(/본문$/).fill("私の強みは継続力です。E2E_OVERLOADED");
  await page.getByRole("button", { name: "AI 첨삭 받기" }).click();
  await expect(page.getByText(/AI 서버가 혼잡합니다/)).toBeVisible({ timeout: 30_000 });
  await page.reload();
  await expect(page.getByText(/오늘 AI 10\/10회 남음/)).toBeVisible();

  // 형식 오류 1회 → 자동 재시도로 성공
  const token = `E2E_INVALID_ONCE_${Date.now()}`;
  await page.getByLabel(/본문$/).fill(`私の強みは継続力です。毎日頑張りました。${token}`);
  await page.getByRole("button", { name: "AI 첨삭 받기" }).click();
  await expect(page.getByTestId("review-result")).toBeVisible({ timeout: 30_000 });

  // 재시도 요청은 직전 출력과 문제점을 대화로 이어 붙인다
  const requests = (await (await fetch(`${MOCK_URL}/__requests`)).json()) as {
    body: { messages: { role: string }[] };
  }[];
  const mine = requests.filter((r) => JSON.stringify(r.body.messages).includes(token));
  expect(mine.map((r) => r.body.messages.map((m) => m.role).join(","))).toEqual([
    "user",
    "user,assistant,user",
  ]);
});
