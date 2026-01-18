/**
 * ログインフォームコンポーネント
 *
 * このファイルは、ユーザーログインのためのフォームを提供します。
 * ログインページ (/login) で使用されます。
 *
 * ## 機能概要
 * - メールアドレス入力
 * - パスワード入力（表示/非表示切り替え）
 * - NextAuth.js による認証
 * - エラーメッセージ表示
 * - ログイン成功後のリダイレクト
 *
 * ## 認証フロー
 * 1. ユーザーがフォームに入力
 * 2. signIn('credentials')でNextAuth.jsに認証リクエスト
 * 3. 成功時: /feedへリダイレクト
 * 4. 失敗時: エラーメッセージ表示
 *
 * @module components/auth/LoginForm
 */

'use client'

// ============================================================
// インポート
// ============================================================

/**
 * NextAuth.jsのサインイン関数
 * 認証処理に使用
 */
import { signIn } from 'next-auth/react'

/**
 * Next.jsルーター
 * ログイン成功後のリダイレクトに使用
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
 * パスワードリセットや新規登録へのリンク
 */
import Link from 'next/link'

import { checkLoginAllowed, recordLoginFailure, clearLoginAttempts } from '@/lib/actions/auth'

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
 * ログインフォームコンポーネント
 *
 * ## 機能
 * - メールアドレスとパスワードによる認証
 * - パスワード表示/非表示トグル
 * - エラーメッセージ表示
 * - パスワードリセットリンク
 * - 新規登録へのリンク
 *
 * @example
 * ```tsx
 * <LoginForm />
 * ```
 */
export function LoginForm() {
  // ------------------------------------------------------------
  // 状態管理
  // ------------------------------------------------------------

  /**
   * Next.jsルーター
   */
  const router = useRouter()

  /**
   * エラーメッセージ
   * 認証失敗時やエラー発生時に表示
   */
  const [error, setError] = useState<string | null>(null)

  /**
   * ローディング状態
   * 認証処理中はtrueになり、ボタンを無効化
   */
  const [loading, setLoading] = useState(false)

  /**
   * パスワード表示状態
   * true: テキスト表示, false: マスク表示
   */
  const [showPassword, setShowPassword] = useState(false)

  // ------------------------------------------------------------
  // イベントハンドラ
  // ------------------------------------------------------------

  /**
   * フォーム送信ハンドラ
   *
   * ## 処理フロー
   * 1. フォームデータを取得
   * 2. NextAuth.jsのsignIn関数で認証
   * 3. 成功: フィードページへリダイレクト
   * 4. 失敗: エラーメッセージを表示
   *
   * @param e - フォームイベント
   */
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    /**
     * デフォルトのフォーム送信を防止
     */
    e.preventDefault()
    setLoading(true)
    setError(null)

    /**
     * FormDataからメールアドレスとパスワードを取得
     */
    const formData = new FormData(e.currentTarget)
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    try {
      // レート制限チェック（ブルートフォース攻撃対策）
      try {
        const checkResult = await checkLoginAllowed(email)
        if (!checkResult.allowed) {
          setError(checkResult.message || 'ログイン試行回数の上限に達しました。しばらく待ってから再試行してください。')
          setLoading(false)
          return
        }
      } catch (checkError) {
        console.error('Login check error:', checkError)
        // レート制限チェックに失敗しても認証処理は続行
      }

      /**
       * NextAuth.jsによる認証
       *
       * redirect: false を指定することで、
       * 認証結果をJavaScriptで処理できる
       */
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      /**
       * 認証失敗時のエラー処理
       */
      if (result?.error) {
        // ログイン失敗を記録（レート制限用）
        try {
          await recordLoginFailure(email)
        } catch (recordError) {
          console.error('Failed to record login failure:', recordError)
        }
        setError('メールアドレスまたはパスワードが間違っています')
        setLoading(false)
        return
      }

      // ログイン成功時は失敗カウントをクリア
      try {
        await clearLoginAttempts(email)
      } catch (clearError) {
        console.error('Failed to clear login attempts:', clearError)
      }

      /**
       * 認証成功時: フィードページへリダイレクト
       * router.refresh()でサーバーコンポーネントを再取得
       */
      router.push('/feed')
      router.refresh()
    } catch (err) {
      /**
       * 予期せぬエラーのハンドリング
       */
      console.error('Login error:', err)
      setError('ログイン中にエラーが発生しました。再度お試しください。')
      setLoading(false)
    }
  }

  // ------------------------------------------------------------
  // レンダリング
  // ------------------------------------------------------------

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* メールアドレス入力 */}
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

      {/* パスワード入力（表示/非表示トグル付き） */}
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
            autoComplete="current-password"
            className="pr-10"
          />
          {/* パスワード表示トグルボタン */}
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

      {/* エラーメッセージ表示 */}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* ログインボタン */}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'ログイン中...' : 'ログイン'}
      </Button>

      {/* リンク（パスワードリセット・新規登録） */}
      <div className="text-center text-sm space-y-2">
        <p>
          <Link href="/password-reset" className="text-primary hover:underline">
            パスワードをお忘れですか？
          </Link>
        </p>
        <p className="text-muted-foreground">
          アカウントをお持ちでない方は{' '}
          <Link href="/register" className="text-primary hover:underline">
            新規登録
          </Link>
        </p>
      </div>
    </form>
  )
}
