import { test, expect } from '@playwright/test'

test.describe('認証機能', () => {
  test.describe('ログインページ', () => {
    test('ログインページが表示される', async ({ page }) => {
      await page.goto('/login')

      await expect(page.getByRole('heading', { name: /ログイン/i })).toBeVisible()
      await expect(page.getByLabel(/メールアドレス/i)).toBeVisible()
      await expect(page.getByLabel(/パスワード/i)).toBeVisible()
      await expect(page.getByRole('button', { name: /ログイン/i })).toBeVisible()
    })

    test('空のフォームでログインするとエラーが表示される', async ({ page }) => {
      await page.goto('/login')

      await page.getByRole('button', { name: /ログイン/i }).click()

      // バリデーションエラーまたはHTMLの required属性によるエラー
      await expect(page.getByLabel(/メールアドレス/i)).toBeFocused()
    })

    test('無効な認証情報でログインするとエラーが表示される', async ({ page }) => {
      await page.goto('/login')

      await page.getByLabel(/メールアドレス/i).fill('invalid@example.com')
      await page.getByLabel(/パスワード/i).fill('wrongpassword')
      await page.getByRole('button', { name: /ログイン/i }).click()

      // エラーメッセージが表示されることを確認
      await expect(page.getByText(/メールアドレスまたはパスワードが正しくありません/i)).toBeVisible({
        timeout: 10000,
      })
    })

    test('新規登録ページへのリンクが動作する', async ({ page }) => {
      await page.goto('/login')

      await page.getByRole('link', { name: /新規登録/i }).click()

      await expect(page).toHaveURL('/register')
    })

    test('パスワードリセットページへのリンクが動作する', async ({ page }) => {
      await page.goto('/login')

      await page.getByRole('link', { name: /パスワードを忘れた/i }).click()

      await expect(page).toHaveURL('/password-reset')
    })
  })

  test.describe('新規登録ページ', () => {
    test('新規登録ページが表示される', async ({ page }) => {
      await page.goto('/register')

      await expect(page.getByRole('heading', { name: /新規登録/i })).toBeVisible()
      await expect(page.getByLabel(/ニックネーム/i)).toBeVisible()
      await expect(page.getByLabel(/メールアドレス/i)).toBeVisible()
      await expect(page.getByLabel(/^パスワード$/i)).toBeVisible()
    })

    test('ログインページへのリンクが動作する', async ({ page }) => {
      await page.goto('/register')

      await page.getByRole('link', { name: /ログイン/i }).click()

      await expect(page).toHaveURL('/login')
    })
  })

  test.describe('パスワードリセット', () => {
    test('パスワードリセットページが表示される', async ({ page }) => {
      await page.goto('/password-reset')

      await expect(page.getByRole('heading', { name: /パスワードリセット/i })).toBeVisible()
      await expect(page.getByLabel(/メールアドレス/i)).toBeVisible()
    })
  })
})

test.describe('認証が必要なページへのアクセス', () => {
  test('未ログイン状態でフィードにアクセスするとログインページにリダイレクトされる', async ({ page }) => {
    await page.goto('/feed')

    await expect(page).toHaveURL(/\/login/)
  })

  test('未ログイン状態で設定ページにアクセスするとログインページにリダイレクトされる', async ({ page }) => {
    await page.goto('/settings')

    await expect(page).toHaveURL(/\/login/)
  })

  test('未ログイン状態で通知ページにアクセスするとログインページにリダイレクトされる', async ({ page }) => {
    await page.goto('/notifications')

    await expect(page).toHaveURL(/\/login/)
  })

  test('未ログイン状態でブックマークページにアクセスするとログインページにリダイレクトされる', async ({ page }) => {
    await page.goto('/bookmarks')

    await expect(page).toHaveURL(/\/login/)
  })
})
