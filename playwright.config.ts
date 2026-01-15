import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2Eテスト設定
 *
 * 実行方法:
 *   npx playwright test              # 全テスト実行
 *   npx playwright test --ui         # UI モードで実行
 *   npx playwright test --headed     # ブラウザを表示して実行
 *   npx playwright test auth.spec.ts # 特定ファイルのみ実行
 */

export default defineConfig({
  // テストファイルの場所
  testDir: './e2e',

  // テストの並列実行設定
  fullyParallel: true,

  // CI環境でのリトライ設定
  retries: process.env.CI ? 2 : 0,

  // CI環境でのワーカー数
  workers: process.env.CI ? 1 : undefined,

  // レポーター設定
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],

  // 共通設定
  use: {
    // ベースURL
    baseURL: 'http://localhost:3000',

    // スクリーンショット設定
    screenshot: 'only-on-failure',

    // ビデオ録画設定
    video: 'retain-on-failure',

    // トレース設定
    trace: 'on-first-retry',

    // タイムアウト
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },

  // プロジェクト（ブラウザ）設定
  projects: [
    // Chromium (デスクトップ)
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    // Firefox (デスクトップ)
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    // WebKit (デスクトップ)
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    // モバイル Chrome
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },

    // モバイル Safari
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  // 開発サーバー設定
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },

  // グローバルタイムアウト
  timeout: 30000,

  // expectのタイムアウト
  expect: {
    timeout: 5000,
  },
})
