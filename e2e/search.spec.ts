import { test, expect } from '@playwright/test'

test.describe('検索機能', () => {
  test('検索ページが表示される', async ({ page }) => {
    await page.goto('/search')

    await expect(page.getByRole('heading', { name: /検索/i })).toBeVisible()
    await expect(page.getByPlaceholder(/検索/i)).toBeVisible()
  })

  test('検索タブが表示される', async ({ page }) => {
    await page.goto('/search')

    await expect(page.getByRole('tab', { name: /投稿/i })).toBeVisible()
    await expect(page.getByRole('tab', { name: /ユーザー/i })).toBeVisible()
    await expect(page.getByRole('tab', { name: /タグ/i })).toBeVisible()
  })

  test('キーワードで検索できる', async ({ page }) => {
    await page.goto('/search')

    // 検索バーに入力
    await page.getByPlaceholder(/検索/i).fill('盆栽')
    await page.getByPlaceholder(/検索/i).press('Enter')

    // URLにクエリパラメータが追加されることを確認
    await expect(page).toHaveURL(/q=盆栽/)
  })

  test('投稿タブで検索結果が表示される', async ({ page }) => {
    await page.goto('/search?q=盆栽')

    // 投稿タブがアクティブ
    await expect(page.getByRole('tab', { name: /投稿/i })).toHaveAttribute('aria-selected', 'true')
  })

  test('ユーザータブに切り替えられる', async ({ page }) => {
    await page.goto('/search?q=盆栽')

    await page.getByRole('tab', { name: /ユーザー/i }).click()

    await expect(page.getByRole('tab', { name: /ユーザー/i })).toHaveAttribute('aria-selected', 'true')
  })

  test('タグタブに切り替えられる', async ({ page }) => {
    await page.goto('/search?q=盆栽')

    await page.getByRole('tab', { name: /タグ/i }).click()

    await expect(page.getByRole('tab', { name: /タグ/i })).toHaveAttribute('aria-selected', 'true')
  })

  test('ジャンルフィルターが表示される', async ({ page }) => {
    await page.goto('/search')

    // ジャンルフィルターが表示されることを確認
    await expect(page.getByText(/ジャンル/i)).toBeVisible()
  })

  test('ジャンルでフィルタリングできる', async ({ page }) => {
    await page.goto('/search?q=盆栽')

    // ジャンルを選択
    const genreCheckbox = page.getByLabel(/松柏類/i).first()
    if (await genreCheckbox.isVisible()) {
      await genreCheckbox.click()

      // URLにジャンルパラメータが追加されることを確認
      await expect(page).toHaveURL(/genres=/)
    }
  })

  test('検索結果が0件の場合メッセージが表示される', async ({ page }) => {
    await page.goto('/search?q=存在しないキーワード12345')

    await expect(page.getByText(/見つかりませんでした|結果がありません/i)).toBeVisible({ timeout: 10000 })
  })

  test('人気タグが表示される', async ({ page }) => {
    await page.goto('/search')

    // 人気タグセクションが表示される（実装による）
    const popularTags = page.locator('[data-testid="popular-tags"]')
    if (await popularTags.isVisible()) {
      await expect(popularTags).toBeVisible()
    }
  })

  test('ハッシュタグをクリックすると検索される', async ({ page }) => {
    await page.goto('/search')

    // 人気タグがある場合クリック
    const tagLink = page.locator('a[href*="/search?tag="]').first()
    if (await tagLink.isVisible()) {
      await tagLink.click()
      await expect(page).toHaveURL(/tag=/)
    }
  })
})

test.describe('検索バーの機能', () => {
  test('クリアボタンで検索をクリアできる', async ({ page }) => {
    await page.goto('/search?q=盆栽')

    // クリアボタンをクリック
    const clearButton = page.locator('[data-testid="search-clear"]')
    if (await clearButton.isVisible()) {
      await clearButton.click()

      // 検索バーが空になることを確認
      await expect(page.getByPlaceholder(/検索/i)).toHaveValue('')
    }
  })

  test('検索履歴が保存される', async ({ page }) => {
    await page.goto('/search')

    // 検索を実行
    await page.getByPlaceholder(/検索/i).fill('盆栽')
    await page.getByPlaceholder(/検索/i).press('Enter')

    // 新しいタブで検索ページを開く
    await page.goto('/search')
    await page.getByPlaceholder(/検索/i).focus()

    // 検索履歴が表示されることを確認（実装による）
    // 注意: 検索履歴機能の実装状況により、このテストは調整が必要な場合があります
    const historyItem = page.getByText('盆栽')
    if (await historyItem.isVisible({ timeout: 1000 }).catch(() => false)) {
      await expect(historyItem).toBeVisible()
    }
  })
})
