# テストガイド

このドキュメントでは、BON-LOGプロジェクトのテスト実行方法について説明します。

## テストの種類

| テストタイプ | ツール | 対象 | 実行時間 |
|------------|--------|------|---------|
| ユニットテスト | Jest | Server Actions, ユーティリティ関数 | 高速 |
| コンポーネントテスト | Jest + Testing Library | Reactコンポーネント | 中速 |
| E2Eテスト | Playwright | ページ全体、ユーザーフロー | 低速 |

## セットアップ

```bash
# 依存関係のインストール
npm install

# Playwrightブラウザのインストール（E2Eテスト用）
npx playwright install
```

## テスト実行コマンド

### ユニットテスト・コンポーネントテスト（Jest）

```bash
# 全テストを実行
npm test

# ウォッチモードで実行（ファイル変更時に自動再実行）
npm run test:watch

# カバレッジレポート付きで実行
npm run test:coverage

# CI環境用（カバレッジ付き、非インタラクティブ）
npm run test:ci
```

### E2Eテスト（Playwright）

```bash
# 全E2Eテストを実行
npm run test:e2e

# UIモードで実行（テスト選択・デバッグが可能）
npm run test:e2e:ui

# ブラウザを表示して実行
npm run test:e2e:headed

# デバッグモードで実行
npm run test:e2e:debug

# 特定のテストファイルのみ実行
npx playwright test e2e/auth.spec.ts

# 特定のブラウザのみで実行
npx playwright test --project=chromium
```

### 全テスト実行

```bash
# ユニットテスト + E2Eテストを順次実行
npm run test:all
```

## テストファイル構成

```
project/
├── __tests__/                    # Jestテスト
│   ├── utils/
│   │   └── test-utils.tsx        # テストユーティリティ、モック
│   ├── lib/
│   │   └── actions/              # Server Actionsテスト
│   │       ├── post.test.ts
│   │       ├── comment.test.ts
│   │       ├── like.test.ts
│   │       ├── follow.test.ts
│   │       ├── bookmark.test.ts
│   │       └── search.test.ts
│   └── components/               # コンポーネントテスト
│       ├── post/
│       │   └── PostCard.test.tsx
│       ├── search/
│       │   └── SearchBar.test.tsx
│       └── auth/
│           └── LoginForm.test.tsx
├── e2e/                          # Playwrightテスト
│   ├── auth.spec.ts              # 認証テスト
│   ├── feed.spec.ts              # フィードテスト
│   ├── search.spec.ts            # 検索テスト
│   └── user-profile.spec.ts      # プロフィールテスト
├── jest.config.js                # Jest設定
├── jest.setup.js                 # Jestセットアップ
└── playwright.config.ts          # Playwright設定
```

## テストの書き方

### Server Actionsのテスト

```typescript
/**
 * @jest-environment node
 */

import { createMockPrismaClient, mockUser } from '../../utils/test-utils'

// Prismaモック
const mockPrisma = createMockPrismaClient()
jest.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}))

// 認証モック
const mockAuth = jest.fn()
jest.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}))

describe('Post Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
  })

  it('認証なしの場合はエラーを返す', async () => {
    mockAuth.mockResolvedValue(null)

    const { createPost } = await import('@/lib/actions/post')
    const formData = new FormData()
    formData.append('content', 'テスト')

    const result = await createPost(formData)
    expect(result).toEqual({ error: '認証が必要です' })
  })
})
```

### コンポーネントテスト

```typescript
import { render, screen, fireEvent } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'

describe('MyComponent', () => {
  it('ボタンをクリックするとアクションが実行される', async () => {
    const user = userEvent.setup()
    render(<MyComponent />)

    await user.click(screen.getByRole('button', { name: /送信/i }))

    expect(screen.getByText(/成功/i)).toBeInTheDocument()
  })
})
```

### E2Eテスト

```typescript
import { test, expect } from '@playwright/test'

test.describe('ログイン機能', () => {
  test('ログインページが表示される', async ({ page }) => {
    await page.goto('/login')

    await expect(page.getByRole('heading', { name: /ログイン/i })).toBeVisible()
    await expect(page.getByLabel(/メールアドレス/i)).toBeVisible()
  })

  test('ログインできる', async ({ page }) => {
    await page.goto('/login')

    await page.getByLabel(/メールアドレス/i).fill('test@example.com')
    await page.getByLabel(/パスワード/i).fill('password123')
    await page.getByRole('button', { name: /ログイン/i }).click()

    await expect(page).toHaveURL('/feed')
  })
})
```

## モックデータ

テストユーティリティ (`__tests__/utils/test-utils.tsx`) に定義されたモックデータ:

- `mockUser` - テスト用ユーザー
- `mockPost` - テスト用投稿
- `mockComment` - テスト用コメント
- `mockSession` - テスト用セッション
- `mockGenres` - テスト用ジャンル
- `mockNotification` - テスト用通知
- `mockConversation` - テスト用会話

## カバレッジ目標

| 項目 | 目標 |
|------|------|
| Statements | 50% |
| Branches | 50% |
| Functions | 50% |
| Lines | 50% |

カバレッジレポートは `coverage/` ディレクトリに出力されます。

## CI/CD統合

GitHub Actionsでのテスト実行例:

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm run test:ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps

      - name: Run E2E tests
        run: npm run test:e2e

      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

## トラブルシューティング

### よくある問題

1. **テストがタイムアウトする**
   - `jest.setTimeout(10000)` でタイムアウトを延長
   - E2Eテストは `playwright.config.ts` の `timeout` を調整

2. **モックが動作しない**
   - `jest.clearAllMocks()` を `beforeEach` で呼び出す
   - モジュールのキャッシュをクリア: `jest.resetModules()`

3. **E2Eテストで要素が見つからない**
   - `await expect(element).toBeVisible({ timeout: 10000 })` でタイムアウトを延長
   - ページの読み込みを待つ: `await page.waitForLoadState('networkidle')`

4. **Playwrightブラウザが見つからない**
   ```bash
   npx playwright install
   ```

## 参考リンク

- [Jest ドキュメント](https://jestjs.io/docs/getting-started)
- [Testing Library ドキュメント](https://testing-library.com/docs/)
- [Playwright ドキュメント](https://playwright.dev/docs/intro)
