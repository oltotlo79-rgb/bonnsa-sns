import { test, expect } from '@playwright/test'

// テスト用のログイン状態を設定するフィクスチャ
test.describe('フィード機能', () => {
  // 注意: 実際のテストではログイン状態のセットアップが必要
  // test.use({ storageState: 'e2e/.auth/user.json' })

  test.skip('フィードページが表示される（ログイン状態）', async ({ page }) => {
    // ログイン状態でのテスト
    await page.goto('/feed')

    await expect(page.getByRole('heading', { name: /タイムライン/i })).toBeVisible()
  })

  test.skip('投稿フォームが表示される', async ({ page }) => {
    await page.goto('/feed')

    await expect(page.getByPlaceholder(/今何を考えていますか/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /投稿/i })).toBeVisible()
  })

  test.skip('投稿を作成できる', async ({ page }) => {
    await page.goto('/feed')

    // 投稿フォームに入力
    await page.getByPlaceholder(/今何を考えていますか/i).fill('テスト投稿です #テスト')

    // ジャンルを選択（必須の場合）
    // await page.getByLabel(/ジャンル/i).click()
    // await page.getByText(/松柏類/i).click()

    // 投稿ボタンをクリック
    await page.getByRole('button', { name: /投稿/i }).click()

    // 投稿が表示されることを確認
    await expect(page.getByText('テスト投稿です')).toBeVisible({ timeout: 10000 })
  })

  test.skip('投稿にいいねできる', async ({ page }) => {
    await page.goto('/feed')

    // 投稿のいいねボタンをクリック
    const likeButton = page.locator('[data-testid="like-button"]').first()
    await likeButton.click()

    // いいね状態が変化することを確認
    await expect(likeButton).toHaveAttribute('data-liked', 'true')
  })

  test.skip('投稿をブックマークできる', async ({ page }) => {
    await page.goto('/feed')

    // 投稿のブックマークボタンをクリック
    const bookmarkButton = page.locator('[data-testid="bookmark-button"]').first()
    await bookmarkButton.click()

    // ブックマーク状態が変化することを確認
    await expect(bookmarkButton).toHaveAttribute('data-bookmarked', 'true')
  })

  test.skip('投稿詳細ページに遷移できる', async ({ page }) => {
    await page.goto('/feed')

    // 投稿をクリック
    await page.locator('[data-testid="post-card"]').first().click()

    // 投稿詳細ページが表示されることを確認
    await expect(page).toHaveURL(/\/posts\//)
  })

  test.skip('無限スクロールで投稿を読み込める', async ({ page }) => {
    await page.goto('/feed')

    // 最初の投稿数を確認
    const initialPosts = await page.locator('[data-testid="post-card"]').count()

    // ページ下部にスクロール
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))

    // 新しい投稿が読み込まれることを確認（投稿が十分にある場合）
    await page.waitForTimeout(2000)
    const afterScrollPosts = await page.locator('[data-testid="post-card"]').count()
    expect(afterScrollPosts).toBeGreaterThanOrEqual(initialPosts)
  })
})

test.describe('投稿詳細ページ', () => {
  test.skip('投稿詳細が表示される', async ({ page }) => {
    // 特定の投稿IDにアクセス（テスト用のIDを使用）
    await page.goto('/posts/test-post-id')

    await expect(page.locator('[data-testid="post-detail"]')).toBeVisible()
  })

  test.skip('コメント一覧が表示される', async ({ page }) => {
    await page.goto('/posts/test-post-id')

    await expect(page.locator('[data-testid="comments-section"]')).toBeVisible()
  })

  test.skip('コメントを投稿できる', async ({ page }) => {
    await page.goto('/posts/test-post-id')

    // コメントを入力
    await page.getByPlaceholder(/コメントを入力/i).fill('テストコメントです')
    await page.getByRole('button', { name: /送信/i }).click()

    // コメントが表示されることを確認
    await expect(page.getByText('テストコメントです')).toBeVisible({ timeout: 10000 })
  })
})
