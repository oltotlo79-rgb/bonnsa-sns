/**
 * ユーザー登録フォームコンポーネント
 *
 * このファイルは、新規ユーザー登録のためのフォームを提供します。
 * 登録ページ (/register) で使用されます。
 *
 * ## 機能概要
 * - ニックネーム入力
 * - メールアドレス入力
 * - パスワード入力（表示/非表示切り替え）
 * - パスワード確認
 * - 利用規約・プライバシーポリシーへの同意
 * - バリデーション（クライアント側）
 * - 登録成功後の自動ログイン
 *
 * ## パスワード要件
 * - 8文字以上
 * - 英字を含む
 * - 数字を含む
 *
 * @module components/auth/RegisterForm
 */

'use client'

// ============================================================
// インポート
// ============================================================

/**
 * NextAuth.jsのサインイン関数
 * 登録成功後の自動ログインに使用
 */
import { signIn } from 'next-auth/react'

/**
 * Next.jsルーター
 * 登録成功後のリダイレクトに使用
 */
import { useRouter } from 'next/navigation'

/**
 * React useState Hook
 * フォームの状態管理
 */
import { useState } from 'react'

/**
 * UIコンポーネント
 */
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * Next.js Linkコンポーネント
 * ログインページへのリンク
 */
import Link from 'next/link'

/**
 * ユーザー登録用Server Action
 */
import { registerUser } from '@/lib/actions/auth'

// ============================================================
// アイコンコンポーネント
// ============================================================

/**
 * 目のアイコン（パスワード表示状態）
 *
 * @param className - 追加のCSSクラス
 */
function EyeIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

/**
 * 目を閉じたアイコン（パスワード非表示状態）
 *
 * @param className - 追加のCSSクラス
 */
function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" x2="22" y1="2" y2="22" />
    </svg>
  )
}

// ============================================================
// メインコンポーネント
// ============================================================

/**
 * ユーザー登録フォームコンポーネント
 *
 * ## 機能
 * - 必須入力フィールド（ニックネーム、メール、パスワード）
 * - パスワード表示/非表示トグル
 * - クライアント側バリデーション
 * - 利用規約への同意チェック
 * - 登録成功後の自動ログイン
 *
 * ## バリデーション
 * - パスワード一致確認
 * - パスワード強度チェック（8文字以上、英数字必須）
 * - 利用規約同意チェック
 *
 * @example
 * ```tsx
 * <RegisterForm />
 * ```
 */
export function RegisterForm() {
  // ------------------------------------------------------------
  // 状態管理
  // ------------------------------------------------------------

  /**
   * Next.jsルーター
   */
  const router = useRouter()

  /**
   * エラーメッセージ
   */
  const [error, setError] = useState<string | null>(null)

  /**
   * ローディング状態
   */
  const [loading, setLoading] = useState(false)

  /**
   * パスワード表示状態
   */
  const [showPassword, setShowPassword] = useState(false)

  /**
   * 確認用パスワード表示状態
   */
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  /**
   * 利用規約同意状態
   */
  const [agreedToTerms, setAgreedToTerms] = useState(false)

  // ------------------------------------------------------------
  // イベントハンドラ
  // ------------------------------------------------------------

  /**
   * フォーム送信ハンドラ
   *
   * ## 処理フロー
   * 1. クライアント側バリデーション
   * 2. Server Actionでユーザー登録
   * 3. 登録成功後、自動ログイン
   * 4. フィードページへリダイレクト
   *
   * @param e - フォームイベント
   */
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const confirmPassword = formData.get('confirmPassword') as string
    const nickname = formData.get('nickname') as string

    if (!agreedToTerms) {
      setError('利用規約とプライバシーポリシーに同意してください')
      setLoading(false)
      return
    }

    if (password !== confirmPassword) {
      setError('パスワードが一致しません')
      setLoading(false)
      return
    }

    if (password.length < 8) {
      setError('パスワードは8文字以上で入力してください')
      setLoading(false)
      return
    }

    const hasLetter = /[a-zA-Z]/.test(password)
    const hasNumber = /[0-9]/.test(password)
    if (!hasLetter || !hasNumber) {
      setError('パスワードはアルファベットと数字を両方含めてください')
      setLoading(false)
      return
    }

    // Server Actionでユーザー登録
    const result = await registerUser({ email, password, nickname })

    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    // 登録成功後、自動ログイン
    const signInResult = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })

    if (signInResult?.error) {
      setError('登録は完了しましたが、ログインに失敗しました。ログインページからお試しください。')
      setLoading(false)
      return
    }

    router.push('/feed')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="nickname">ニックネーム</Label>
        <Input
          id="nickname"
          name="nickname"
          type="text"
          placeholder="表示名"
          required
          maxLength={50}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">メールアドレス</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="mail@example.com"
          required
          autoComplete="email"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">パスワード</Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            placeholder="8文字以上（英字・数字を含む）"
            required
            minLength={8}
            autoComplete="new-password"
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label={showPassword ? 'パスワードを隠す' : 'パスワードを表示'}
          >
            {showPassword ? (
              <EyeOffIcon className="h-4 w-4" />
            ) : (
              <EyeIcon className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">パスワード（確認）</Label>
        <div className="relative">
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type={showConfirmPassword ? 'text' : 'password'}
            placeholder="もう一度入力"
            required
            minLength={8}
            autoComplete="new-password"
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label={showConfirmPassword ? 'パスワードを隠す' : 'パスワードを表示'}
          >
            {showConfirmPassword ? (
              <EyeOffIcon className="h-4 w-4" />
            ) : (
              <EyeIcon className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* 利用規約・プライバシーポリシー同意 */}
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          id="agreeTerms"
          checked={agreedToTerms}
          onChange={(e) => setAgreedToTerms(e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
        />
        <label htmlFor="agreeTerms" className="text-sm text-muted-foreground">
          <Link href="/terms" target="_blank" className="text-primary hover:underline">
            利用規約
          </Link>
          および
          <Link href="/privacy" target="_blank" className="text-primary hover:underline">
            プライバシーポリシー
          </Link>
          に同意します
        </label>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <Button type="submit" className="w-full" disabled={loading || !agreedToTerms}>
        {loading ? '登録中...' : '新規登録'}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        既にアカウントをお持ちの方は{' '}
        <Link href="/login" className="text-primary hover:underline">
          ログイン
        </Link>
      </p>
    </form>
  )
}
