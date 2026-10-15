import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "retain-on-failure",
    // 사전 설치된 Chromium 을 쓰는 환경(CI 컨테이너 등)에서는 경로를 지정한다.
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : undefined,
  },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: [
    {
      // Anthropic API 목 서버 — 앱은 ANTHROPIC_BASE_URL 로 이 서버를 호출한다
      command: "node tests/e2e/mock-anthropic.mjs",
      port: 4010,
      reuseExistingServer: !process.env.CI,
    },
    {
      // CI 는 빌드를 먼저 끝내고 start 만 실행한다
      command: process.env.CI ? `npm run start -- -p ${port}` : `npm run build && npm run start -- -p ${port}`,
      port,
      timeout: 240_000,
      reuseExistingServer: !process.env.CI,
      env: {
        ANTHROPIC_BASE_URL: "http://127.0.0.1:4010",
        ANTHROPIC_API_KEY: "e2e-mock-key",
        FEATURE_REFERRAL: process.env.FEATURE_REFERRAL ?? "false",
      },
    },
  ],
});
