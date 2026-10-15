import { expect, test } from "@playwright/test";

import { completeOnboarding, loginWithMagicLink, uniqueEmail } from "./helpers";

const MOCK_URL = process.env.MOCK_ANTHROPIC_URL ?? "http://127.0.0.1:4010";

test("자기분석 대화 → 카드 정리·저장·수정 → ES 첨삭에 참고", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await loginWithMagicLink(page, uniqueEmail(`ana-${testInfo.project.name}`));
  await completeOnboarding(page, "박지훈");

  await page.goto("/analysis");
  await expect(page.getByRole("heading", { name: "자기분석", exact: true })).toBeVisible();
  await expect(page.getByText(/오늘 대화 40\/40회 남음/)).toBeVisible();
  await page.getByRole("link", { name: "새 대화 시작" }).click();

  const input = page.getByLabel("메시지");
  const extractButton = page.getByRole("button", { name: "카드로 정리" });
  await expect(extractButton).toBeDisabled();

  await input.fill(
    "대학 테니스 동아리에서 신입 부원이 자꾸 그만둬서 선배와 1:1로 묶어주는 제도를 만들었어요.",
  );
  await input.press("Enter");
  await expect(page.getByText("그때 직접 어떤 방법을 시도하셨는지").first()).toBeVisible();
  await expect(page).toHaveURL(/\/analysis\/chat\?c=/);

  await input.fill(
    "매주 선배가 신입과 같이 연습하고 고민을 들어주게 했고, 그 해에는 그만둔 사람이 거의 없었어요.",
  );
  await page.getByRole("button", { name: "보내기" }).click();
  await expect(page.getByText("그때 직접 어떤 방법을 시도하셨는지")).toHaveCount(2);

  await extractButton.click();
  const cards = page.getByTestId("extracted-cards");
  await expect(cards).toBeVisible({ timeout: 30_000 });
  await expect(cards.getByLabel("제목").first()).toHaveValue("동아리 신입 정착 프로그램");
  await expect(cards.getByText("이탈자가 이전에는 몇 명 정도였나요?")).toBeVisible();
  await expect(cards.getByTestId("ai-disclaimer")).toBeVisible();
  await cards.getByRole("button", { name: "선택한 카드 저장" }).click();

  await expect(page).toHaveURL(/\/analysis\/episodes\?saved=1/);
  await expect(page.getByRole("heading", { name: "동아리 신입 정착 프로그램" })).toBeVisible();
  await expect(page.getByText("主体性(주체성)")).toBeVisible();

  // 카드 수정
  await page.getByRole("button", { name: "카드 수정: 동아리 신입 정착 프로그램" }).click();
  const card = page.getByRole("listitem").filter({ hasText: "동아리 신입 정착 프로그램" });
  await card.getByLabel("결과 (Result)").fill("그 해 이탈자 0명 (전년도 5명)");
  await card.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByText("그 해 이탈자 0명 (전년도 5명)")).toBeVisible();

  // 대화 기록이 목록에 남는다
  await page.goto("/analysis");
  await expect(page.getByRole("link", { name: /대학 테니스 동아리/ })).toBeVisible();
  await expect(page.getByText(/오늘 대화 38\/40회 남음/)).toBeVisible();

  // ES 에서 에피소드 참고
  await page.goto("/es/new");
  await page.getByLabel("문항 유형").selectOption("gakuchika");
  await page.getByLabel("제목").fill("ガクチカ");
  await page.getByRole("button", { name: "만들기" }).click();
  await page.getByText("참고 에피소드").click();
  await page.getByLabel("동아리 신입 정착 프로그램").check();
  await page.getByRole("button", { name: "선택 저장" }).click();
  await expect(page.getByText("참고 에피소드 (1)")).toBeVisible();
  await page.getByLabel(/본문$/).fill("私はテニスサークルで新入部員の定着に頑張りました。");
  await page.getByRole("button", { name: "AI 첨삭 받기" }).click();
  await expect(page.getByTestId("review-result")).toBeVisible({ timeout: 30_000 });

  const requests = (await (await fetch(`${MOCK_URL}/__requests`)).json()) as {
    body: { messages: { content: string }[] };
  }[];
  const esRequest = requests.findLast((r) =>
    r.body.messages[0].content.includes("新入部員の定着に頑張りました"),
  );
  expect(esRequest?.body.messages[0].content).toContain("동아리 신입 정착 프로그램");
  expect(esRequest?.body.messages[0].content).toContain("그 해 이탈자 0명");
});

test("경력 번역: 변환 → 職務経歴書 표시 → 편집 저장", async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  await loginWithMagicLink(page, uniqueEmail(`career-${testInfo.project.name}`));
  await completeOnboarding(page, "최현우");

  await page.goto("/career");
  await page.getByRole("link", { name: "새 변환" }).click();
  await page.getByLabel("제목").fill("○○전자 IT팀");
  await page
    .getByLabel("경력 내용 (한국어)")
    .fill(
      "○○전자 (2021.03 ~ 2024.02) 정규직\n- IT팀 대리, ERP 유지보수 및 신규 모듈 개발 (Java, Spring)\n- 장애 대응 프로세스 개선으로 월 장애 건수 절반으로 감소",
    );
  await page.getByRole("button", { name: "職務経歴書로 변환" }).click();

  await expect(page).toHaveURL(/\/career\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  const doc = page.getByTestId("career-doc");
  await expect(doc.getByText("■職務要約")).toBeVisible();
  await expect(doc.getByText("代理（主任〜係長相当）", { exact: false })).toBeVisible();
  await expect(page.getByText("대리", { exact: true })).toBeVisible(); // 용어 주석
  await expect(page.getByText("협력사 포털 리뉴얼의 기간을 알려 주세요.")).toBeVisible();
  await expect(page.getByTestId("ai-disclaimer")).toBeVisible();

  await page.getByRole("button", { name: "편집" }).click();
  const editor = page.getByLabel("職務経歴書 편집");
  await expect(editor).toHaveValue(/■職務要約/);
  await editor.fill("■職務要約\n編集した要約です。");
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page.getByText("편집본을 저장했습니다.")).toBeVisible();
  await page.reload();
  await expect(page.getByText("(편집본)")).toBeVisible();
  await expect(page.getByText("編集した要約です。")).toBeVisible();

  await page.getByRole("button", { name: "검수 요청" }).click();
  await expect(page.getByText("운영자 검수를 요청했습니다.")).toBeVisible();
});

test("자기분석 대화 실패 시 메시지를 되돌리고 횟수를 차감하지 않는다", async ({
  page,
}, testInfo) => {
  await loginWithMagicLink(page, uniqueEmail(`ana-err-${testInfo.project.name}`));
  await completeOnboarding(page, "오류");
  await page.goto("/analysis/chat");
  const input = page.getByLabel("메시지");
  await input.fill("첫 이야기입니다 E2E_OVERLOADED");
  await input.press("Enter");
  await expect(page.getByText(/AI 서버가 혼잡합니다/)).toBeVisible({ timeout: 20_000 });
  await expect(input).toHaveValue("첫 이야기입니다 E2E_OVERLOADED");
  await expect(page).toHaveURL(/\/analysis\/chat$/);
  await page.goto("/analysis");
  await expect(page.getByText(/오늘 대화 40\/40회 남음/)).toBeVisible();
  await expect(page.getByText("아직 대화가 없습니다")).toBeVisible();
});
