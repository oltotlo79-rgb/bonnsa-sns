/**
 * パスワードリセット確認フォームコンポーネント
 *
 * このファイルは、パスワードリセット用のリンクからアクセスしたユーザーが
 * 新しいパスワードを設定するためのフォームを提供します。
 *
 * ## 機能概要
 * - リセットトークンの検証
 * - 新しいパスワードの入力（表示/非表示切り替え）
 * - パスワード確認
 * - パスワード強度チェック
 * - 成功後のログインページへのリダイレクト
 *
 * ## パスワード要件
 * - 8文字以上
 * - 英字（大文字または小文字）を含む
 * - 数字を含む
 *
 * ## 画面遷移
 * 1. トークン検証中 → ローディング表示
 * 2. トークン無効 → エラーメッセージと再リクエストリンク
 * 3. トークン有効 → パスワード入力フォーム
 * 4. 更新成功 → 成功メッセージ → ログインページへ自動遷移
 *
 * @module components/auth/PasswordResetConfirmForm
 */

'use client'

// ============================================================
// インポート
// ============================================================

/**
 * React Hooks
 *
 * useState: フォームの各種状態を管理
 * useEffect: コンポーネントマウント時にトークン検証を実行
 */
import { useState, useEffect } from 'react'

/**
 * Next.js Hooks
 *
 * useSearchParams: URLクエリパラメータ（token, email）を取得
 * useRouter: プログラムによるページ遷移（成功後のリダイレクト）
 */
import { useSearchParams, useRouter } from 'next/navigation'

/**
 * UIコンポーネント
 */
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * Next.js Linkコンポーネント
 * ログインページや再リクエストページへのリンクに使用
 */
import Link from 'next/link'

/**
 * 認証関連のServer Actions
 *
 * resetPassword: パスワードリセットを実行
 * verifyPasswordResetToken: トークンの有効性を検証
 */
import { resetPassword, verifyPasswordResetToken } from '@/lib/actions/auth'

// ============================================================
// アイコンコンポーネント
// ============================================================

/**
 * 目のアイコン（パスワード表示状態）
 *
 * パスワードが表示されている時に表示され、
 * クリックするとパスワードがマスクされる
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
      {/* 目の外形（楕円形） */}
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      {/* 瞳（円形） */}
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

/**
 * 目を閉じたアイコン（パスワード非表示状態）
 *
 * パスワードがマスクされている時に表示され、
 * クリックするとパスワードが表示される
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
      {/* 斜線が入った目のパス */}
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      {/* 斜めの取り消し線 */}
      <line x1="2" x2="22" y1="2" y2="22" />
    </svg>
  )
}

// ============================================================
// メインコンポーネント
// ============================================================

/**
 * パスワードリセット確認フォームコンポーネント
 *
 * ## 処理フロー
 * 1. URLからトークンとメールアドレスを取得
 * 2. マウント時にトークンの有効性を検証
 * 3. 有効な場合はフォームを表示
 * 4. パスワード入力後、バリデーション
 * 5. Server Actionでパスワードを更新
 * 6. 成功後、3秒後にログインページへリダイレクト
 *
 * @example
 * // URL例: /password-reset/confirm?token=xxx&email=user@example.com
 * <PasswordResetConfirmForm />
 */
export function PasswordResetConfirmForm() {
  // ------------------------------------------------------------
  // Hooks
  // ------------------------------------------------------------

  /**
   * URLのクエリパラメータを取得
   * ?token=xxx&email=yyy の形式で渡される
   */
  const searchParams = useSearchParams()

  /**
   * Next.jsルーター
   * 成功後のログインページへのリダイレクトに使用
   */
  const router = useRouter()

  /**
   * トークンとメールアドレスをURLから取得
   */
  const token = searchParams.get('token')
  const email = searchParams.get('email')

  // ------------------------------------------------------------
  // 状態管理
  // ------------------------------------------------------------

  /**
   * エラーメッセージ
   * バリデーションエラーやサーバーエラーを表示
   */
  const [error, setError] = useState<string | null>(null)

  /**
   * パスワード更新成功フラグ
   * trueの場合は成功メッセージを表示
   */
  const [success, setSuccess] = useState(false)

  /**
   * フォーム送信中のローディング状態
   */
  const [loading, setLoading] = useState(false)

  /**
   * 新しいパスワードの表示/非表示状態
   */
  const [showPassword, setShowPassword] = useState(false)

  /**
   * 確認用パスワードの表示/非表示状態
   */
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  /**
   * トークンの有効性
   * null: 未検証、true: 有効、false: 無効
   */
  const [tokenValid, setTokenValid] = useState<boolean | null>(null)

  /**
   * トークン検証中のローディング状態
   */
  const [verifying, setVerifying] = useState(true)

  // ------------------------------------------------------------
  // Effects
  // ------------------------------------------------------------

  /**
   * コンポーネントマウント時にトークンを検証
   *
   * ## 検証フロー
   * 1. トークンまたはメールがない場合は無効
   * 2. Server Actionでトークンを検証
   * 3. 結果をtokenValid状態に設定
   */
  useEffect(() => {
    async function verify() {
      /**
       * トークンまたはメールがない場合は無効とする
       */
      if (!token || !email) {
        setTokenValid(false)
        setVerifying(false)
        return
      }

      /**
       * Server Actionでトークンの有効性を検証
       * 期限切れや不正なトークンをチェック
       */
      const result = await verifyPasswordResetToken(email, token)
      setTokenValid(result.valid)
      setVerifying(false)
    }

    verify()
  }, [token, email])

  // ------------------------------------------------------------
  // イベントハンドラ
  // ------------------------------------------------------------

  /**
   * フォーム送信ハンドラ
   *
   * ## 処理フロー
   * 1. フォームのデフォルト送信を防止
   * 2. パスワード一致チェック
   * 3. パスワード長さチェック（8文字以上）
   * 4. パスワード強度チェック（英数字必須）
   * 5. トークンとメールの存在チェック
   * 6. Server Actionでパスワードを更新
   * 7. 成功時: 3秒後にログインページへリダイレクト
   *
   * @param e - フォームのsubmitイベント
   */
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    /**
     * フォームデータを取得
     */
    const formData = new FormData(e.currentTarget)
    const password = formData.get('password') as string
    const confirmPassword = formData.get('confirmPassword') as string

    /**
     * パスワード一致チェック
     * 確認用パスワードと一致しない場合はエラー
     */
    if (password !== confirmPassword) {
      setError('パスワードが一致しません')
      setLoading(false)
      return
    }

    /**
     * パスワード長さチェック
     * 8文字未満の場合はエラー
     */
    if (password.length < 8) {
      setError('パスワードは8文字以上で入力してください')
      setLoading(false)
      return
    }

    /**
     * パスワード強度チェック
     * 英字と数字の両方を含む必要がある
     */
    const hasLetter = /[a-zA-Z]/.test(password)
    const hasNumber = /[0-9]/.test(password)
    if (!hasLetter || !hasNumber) {
      setError('パスワードはアルファベットと数字を両方含めてください')
      setLoading(false)
      return
    }

    /**
     * トークンとメールの存在チェック
     * URLから正しく取得できていない場合はエラー
     */
    if (!token || !email) {
      setError('無効なリセットリンクです')
      setLoading(false)
      return
    }

    /**
     * Server Actionでパスワードをリセット
     */
    const result = await resetPassword({
      email,
      token,
      newPassword: password,
    })

    /**
     * エラーがあれば表示
     */
    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    /**
     * 成功時の処理
     */
    setSuccess(true)
    setLoading(false)

    /**
     * 3秒後にログインページへ自動リダイレクト
     * ユーザーに成功メッセージを読む時間を与える
     */
    setTimeout(() => {
      router.push('/login')
    }, 3000)
  }

  // ------------------------------------------------------------
  // 条件付きレンダリング（検証中）
  // ------------------------------------------------------------

  /**
   * トークン検証中はローディングスピナーを表示
   */
  if (verifying) {
    return (
      <div className="text-center py-8">
        {/* ローディングスピナー */}
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="mt-4 text-muted-foreground">リンクを検証中...</p>
      </div>
    )
  }

  // ------------------------------------------------------------
  // 条件付きレンダリング（トークン無効）
  // ------------------------------------------------------------

  /**
   * トークンが無効または期限切れの場合はエラーメッセージを表示
   */
  if (!tokenValid) {
    return (
      <div className="space-y-4">
        {/* エラーメッセージカード（赤色の背景） */}
        <div className="rounded-lg bg-red-50 p-4 text-center">
          <p className="text-red-800 font-medium">リンクが無効です</p>
          <p className="text-red-700 text-sm mt-2">
            リセットリンクが無効または期限切れです。
            もう一度パスワードリセットをお試しください。
          </p>
        </div>

        {/* 再リクエストへのリンク */}
        <p className="text-center">
          <Link href="/password-reset" className="text-primary hover:underline">
            パスワードリセットを再度リクエスト
          </Link>
        </p>

        {/* ログインページへのリンク */}
        <p className="text-center text-sm text-muted-foreground">
          <Link href="/login" className="text-primary hover:underline">
            ログインページへ戻る
          </Link>
        </p>
      </div>
    )
  }

  // ------------------------------------------------------------
  // 条件付きレンダリング（成功時）
  // ------------------------------------------------------------

  /**
   * パスワード更新成功時は成功メッセージを表示
   */
  if (success) {
    return (
      <div className="space-y-4">
        {/* 成功メッセージカード（緑色の背景） */}
        <div className="rounded-lg bg-green-50 p-4 text-center">
          <p className="text-green-800 font-medium">パスワードを更新しました</p>
          <p className="text-green-700 text-sm mt-2">
            新しいパスワードでログインできます。
            ログインページへ移動します...
          </p>
        </div>

        {/* すぐにログインしたい場合のリンク */}
        <p className="text-center">
          <Link href="/login" className="text-primary hover:underline">
            今すぐログインする
          </Link>
        </p>
      </div>
    )
  }

  // ------------------------------------------------------------
  // レンダリング（フォーム表示）
  // ------------------------------------------------------------

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* 説明文 */}
      <p className="text-sm text-muted-foreground">
        新しいパスワードを入力してください。
      </p>

      {/* 新しいパスワード入力フィールド */}
      <div className="space-y-2">
        <Label htmlFor="password">新しいパスワード</Label>
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

      {/* 確認用パスワード入力フィールド */}
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">新しいパスワード（確認）</Label>
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
          {/* パスワード表示トグルボタン */}
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

      {/* エラーメッセージ表示 */}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* 送信ボタン */}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? '更新中...' : 'パスワードを更新'}
      </Button>

      {/* ログインページへ戻るリンク */}
      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="text-primary hover:underline">
          ログインページへ戻る
        </Link>
      </p>
    </form>
  )
}
