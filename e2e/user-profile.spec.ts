import { test, expect } from '@playwright/test'

test.describe('ユーザープロフィール', () => {
  test('プロフィールページが表示される', async ({ page }) => {
    // テスト用のユーザーIDにアクセス（実際のIDに置き換え）
    await page.goto('/users/test-user-id')

    // プロフィール情報が表示されることを確認
    await expect(page.locator('[data-testid="user-profile"]')).toBeVisible({ timeout: 10000 })
  })

  test('ユーザーのニックネームが表示される', async ({ page }) => {
    await page.goto('/users/test-user-id')

    await expect(page.locator('[data-testid="user-nickname"]')).toBeVisible()
  })

  test('ユーザーの投稿一覧が表示される', async ({ page }) => {
    await page.goto('/users/test-user-id')

    // 投稿タブがアクティブになっていることを確認
    await expect(page.getByRole('tab', { name: /投稿/i })).toBeVisible()
  })

  test('フォロワー数が表示される', async ({ page }) => {
    await page.goto('/users/test-user-id')

    await expect(page.getByText(/フォロワー/i)).toBeVisible()
  })

  test('フォロー中数が表示される', async ({ page }) => {
    await page.goto('/users/test-user-id')

    await expect(page.getByText(/フォロー中/i)).toBeVisible()
  })

  test('フォロワーページに遷移できる', async ({ page }) => {
    await page.goto('/users/test-user-id')

    await page.getByRole('link', { name: /フォロワー/i }).click()

    await expect(page).toHaveURL(/\/followers/)
  })

  test('フォロー中ページに遷移できる', async ({ page }) => {
    await page.goto('/users/test-user-id')

    await page.getByRole('link', { name: /フォロー中/i }).click()

    await expect(page).toHaveURL(/\/following/)
  })

  test.skip('フォローボタンが表示される（他人のプロフィール）', async ({ page }) => {
    await page.goto('/users/other-user-id')

    await expect(page.getByRole('button', { name: /フォロー/i })).toBeVisible()
  })

  test.skip('フォローボタンをクリックするとフォローできる', async ({ page }) => {
    await page.goto('/users/other-user-id')

    await page.getByRole('button', { name: /フォロー/i }).click()

    // フォロー中状態になることを確認
    await expect(page.getByRole('button', { name: /フォロー中/i })).toBeVisible({ timeout: 10000 })
  })

  test.skip('メッセージボタンが表示される（他人のプロフィール）', async ({ page }) => {
    await page.goto('/users/other-user-id')

    await expect(page.getByRole('button', { name: /メッセージ/i })).toBeVisible()
  })
})

test.describe('ユーザーの投稿一覧', () => {
  test('投稿タブをクリックすると投稿一覧が表示される', async ({ page }) => {
    await page.goto('/users/test-user-id')

    await page.getByRole('tab', { name: /投稿/i }).click()

    await expect(page).toHaveURL(/\/posts/)
  })

  test('いいねタブをクリックするといいね一覧が表示される', async ({ page }) => {
    await page.goto('/users/test-user-id')

    await page.getByRole('tab', { name: /いいね/i }).click()

    await expect(page).toHaveURL(/\/likes/)
  })
})

test.describe('存在しないユーザー', () => {
  test('存在しないユーザーにアクセスすると404ページが表示される', async ({ page }) => {
    await page.goto('/users/non-existent-user-id-12345')

    // 404ページまたはエラーメッセージが表示されることを確認
    await expect(page.getByText(/見つかりませんでした|存在しません/i)).toBeVisible({ timeout: 10000 })
  })
})
