import { expect, test } from "@playwright/test";

import { completeOnboarding, loginWithMagicLink, uniqueEmail } from "./helpers";

const referralOn = process.env.E2E_REFERRAL === "1";

test("리퍼럴: 제휴사 등록 → 동의(국외 이전 포함) → 운영자 전달 → 결과 보고 → 철회 → 내보내기 → 탈퇴", async ({
  browser,
}, testInfo) => {
  const adminEmail = process.env.E2E_ADMIN_EMAIL;
  test.skip(!referralOn || !adminEmail, "E2E_REFERRAL=1 과 E2E_ADMIN_EMAIL 필요");
  test.skip(testInfo.project.name !== "desktop", "데스크톱에서만");
  test.setTimeout(150_000);
  const partnerName = `Bridge Career ${Date.now()}`;

  // 운영자: 제휴사 등록
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await loginWithMagicLink(admin, adminEmail!, "/admin/partners");
  if (admin.url().endsWith("/onboarding")) {
    await completeOnboarding(admin, "운영자");
    await admin.goto("/admin/partners");
  }
  await admin.getByLabel("회사명").fill(partnerName);
  await admin.getByLabel("전달·연락 이메일").fill("partner@example.jp");
  await admin.getByLabel("유료직업소개 허가번호").fill("13-ユ-999999");
  await admin.getByRole("button", { name: "등록" }).click();
  await expect(admin.getByText("제휴사를 등록했습니다.")).toBeVisible();

  // 사용자: ES 준비 후 동의
  const email = uniqueEmail("ref-user");
  const userCtx = await browser.newContext();
  const user = await userCtx.newPage();
  await loginWithMagicLink(user, email);
  await completeOnboarding(user, "리퍼럴테스트");
  await user.goto("/es/new");
  await user.getByLabel("문항 유형").selectOption("self_pr");
  await user.getByLabel("제목").fill("自己PR 리퍼럴용");
  await user.getByRole("button", { name: "만들기" }).click();
  await user.getByLabel(/본문$/).fill("私の強みは粘り強さです。REFERRAL-ES-CONTENT");
  await user.getByRole("button", { name: "저장", exact: true }).click();
  await expect(user.getByRole("list", { name: "버전 히스토리" }).getByRole("listitem")).toHaveCount(
    1,
  );

  await user.getByRole("link", { name: "제휴사 연결" }).click();
  const card = user.getByRole("listitem").filter({ hasText: partnerName });
  await card.getByRole("link", { name: "연결 신청" }).click();
  await user.getByLabel("ES 최신 버전 「自己PR 리퍼럴용」").check();
  const consent = user.getByTestId("consent-text");
  await expect(consent).toContainText(partnerName);
  await expect(consent).toContainText("13-ユ-999999");
  await expect(consent).toContainText("ES 최신 버전 「自己PR 리퍼럴용」");
  await expect(consent).toContainText("국외 이전");
  await user.getByRole("button", { name: "동의하고 연결 신청" }).click();
  await expect(user.getByText("필수 동의 항목을 모두 확인해 주세요.")).toBeVisible();
  // 실패 후 폼이 초기화되어도 화면의 항목·동의 문구·제출 값이 서로 일치해야 한다
  await expect(user.getByLabel("ES 최신 버전 「自己PR 리퍼럴용」")).toBeChecked();
  await expect(consent).toContainText("ES 최신 버전 「自己PR 리퍼럴용」");
  await user.getByLabel(/제공하는 데 동의합니다/).check();
  await user.getByLabel(/국외\(일본\)로 이전되는 데 동의합니다/).check();
  await user.getByLabel(/확인했습니다/).check();
  await user.getByRole("button", { name: "동의하고 연결 신청" }).click();
  await expect(user.getByText("동의를 기록했습니다.")).toBeVisible();
  const item = user.getByTestId("referral-item").filter({ hasText: partnerName });
  await expect(item.getByText("동의 완료 · 전달 대기")).toBeVisible();

  // 운영자: 전달 자료 확인 후 발송
  await admin.goto("/admin/referrals");
  await admin.getByRole("link", { name: new RegExp(`리퍼럴테스트.*${partnerName}`) }).click();
  await expect(admin.getByText(/referral-v1/)).toBeVisible();
  const packet = admin.getByTestId("packet");
  await expect(packet).toContainText("리퍼럴테스트");
  await expect(packet).toContainText(email);
  await expect(packet).toContainText("REFERRAL-ES-CONTENT");
  await admin.getByRole("button", { name: /전달 이메일 발송/ }).click();
  await expect(admin.getByText(/전달 완료/)).toBeVisible();

  // 사용자: 상태 확인 → 결과 보고 → 철회
  await user.reload();
  await expect(item.getByText("제휴사에 전달됨")).toBeVisible();
  await item.getByLabel("진행 결과 알려주기").selectOption("interviewing");
  await item.getByRole("button", { name: "결과 저장" }).click();
  await expect(item.getByText("결과: 면접 진행 중")).toBeVisible();
  await item.getByRole("button", { name: "동의 철회" }).click();
  await expect(item.getByText("철회됨")).toBeVisible();

  // 운영자: 철회 후 전달 자료가 더 이상 보이지 않는다
  await admin.reload();
  await expect(
    admin.getByText("동의가 철회되었거나 종료되어 전달 자료를 표시하지 않습니다."),
  ).toBeVisible();
  await expect(admin.getByText(/철회 · referral-revoke-v1/)).toBeVisible();

  // 데이터 내보내기
  const res = await user.request.get("/api/account/export");
  expect(res.ok()).toBe(true);
  expect(res.headers()["content-disposition"]).toContain("jp-bridge-export");
  const data = await res.json();
  expect(data.account.email).toBe(email);
  expect(data.es_documents).toHaveLength(1);
  expect(data.referrals).toHaveLength(1);
  expect(data.consents).toHaveLength(2);

  // 계정 삭제
  await user.goto("/settings");
  await user.getByLabel(/'탈퇴'를 입력하세요|‘탈퇴’를 입력하세요/).fill("탈퇴");
  await user.getByRole("button", { name: "계정과 모든 데이터 삭제" }).click();
  await expect(user.getByText("계정과 데이터가 삭제되었습니다.")).toBeVisible();
  await user.goto("/dashboard");
  await expect(user).toHaveURL(/\/login/);

  await userCtx.close();
  await adminCtx.close();
});

test("FEATURE_REFERRAL 이 꺼져 있으면 리퍼럴 화면이 없다", async ({ page }) => {
  test.skip(referralOn, "플래그가 켜진 서버에서는 건너뜀");
  await loginWithMagicLink(page, uniqueEmail("ref-off"));
  await completeOnboarding(page, "플래그오프");
  expect((await page.goto("/referrals"))?.status()).toBe(404);
  await page.goto("/dashboard");
  await expect(page.getByRole("link", { name: "제휴사 연결" })).toHaveCount(0);
});
