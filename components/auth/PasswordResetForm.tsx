/**
 * パスワードリセットリクエストフォームコンポーネント
 *
 * このファイルは、パスワードを忘れたユーザーがリセットをリクエストするための
 * フォームを提供します。パスワードリセットページ (/password-reset) で使用されます。
 *
 * ## 機能概要
 * - メールアドレス入力
 * - パスワードリセット用のメール送信リクエスト
 * - 送信成功後の確認メッセージ表示
 * - エラーメッセージ表示
 *
 * ## パスワードリセットフロー
 * 1. ユーザーがメールアドレスを入力
 * 2. サーバーにリセットリクエストを送信
 * 3. 成功時: リセット用リンクを含むメールが送信される
 * 4. ユーザーはメール内のリンクからパスワードを再設定
 *
 * @module components/auth/PasswordResetForm
 */

'use client'

// ============================================================
// インポート
// ============================================================

/**
 * React useState Hook
 * フォームの状態（エラー、成功、ローディング）を管理するために使用
 */
import { useState } from 'react'

/**
 * shadcn/ui Buttonコンポーネント
 * 送信ボタンのスタイリングに使用
 */
import { Button } from '@/components/ui/button'

/**
 * shadcn/ui Inputコンポーネント
 * メールアドレス入力フィールドに使用
 */
import { Input } from '@/components/ui/input'

/**
 * shadcn/ui Labelコンポーネント
 * 入力フィールドのラベル表示に使用
 */
import { Label } from '@/components/ui/label'

/**
 * Next.js Linkコンポーネント
 * ログインページへのリンクに使用（クライアントサイドナビゲーション対応）
 */
import Link from 'next/link'

/**
 * パスワードリセットリクエスト用のServer Action
 * サーバーサイドでメール送信処理を実行
 */
import { requestPasswordReset } from '@/lib/actions/auth'

// ============================================================
// メインコンポーネント
// ============================================================

/**
 * パスワードリセットリクエストフォームコンポーネント
 *
 * ## 機能
 * - メールアドレスの入力と送信
 * - バリデーション（空欄チェック）
 * - 送信成功/失敗時のフィードバック表示
 *
 * ## 状態遷移
 * 1. 初期状態: フォーム表示
 * 2. 送信中: ローディング表示
 * 3. 成功: 確認メッセージ表示
 * 4. 失敗: エラーメッセージ表示
 *
 * @example
 * ```tsx
 * <PasswordResetForm />
 * ```
 */
export function PasswordResetForm() {
  // ------------------------------------------------------------
  // 状態管理
  // ------------------------------------------------------------

  /**
   * エラーメッセージ
   * nullの場合はエラーなし、文字列の場合はエラーあり
   */
  const [error, setError] = useState<string | null>(null)

  /**
   * 送信成功フラグ
   * trueの場合は成功メッセージを表示
   */
  const [success, setSuccess] = useState(false)

  /**
   * ローディング状態
   * trueの場合は送信ボタンを無効化し、「送信中...」と表示
   */
  const [loading, setLoading] = useState(false)

  // ------------------------------------------------------------
  // イベントハンドラ
  // ------------------------------------------------------------

  /**
   * フォーム送信ハンドラ
   *
   * ## 処理フロー
   * 1. フォームのデフォルト送信を防止
   * 2. ローディング状態を開始
   * 3. メールアドレスを取得して空欄チェック
   * 4. Server Actionでリセットリクエストを送信
   * 5. 成功: successフラグをtrue、失敗: エラーメッセージを設定
   *
   * @param e - フォームのsubmitイベント
   */
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    /**
     * デフォルトのフォーム送信（ページリロード）を防止
     */
    e.preventDefault()
    setLoading(true)
    setError(null)

    /**
     * FormDataからメールアドレスを取得
     * FormDataはブラウザ標準APIで、フォームの値を簡単に取得できる
     */
    const formData = new FormData(e.currentTarget)
    const email = formData.get('email') as string

    /**
     * 空欄チェック
     * 必須フィールドなのでHTML側でも制御されるが、念のためチェック
     */
    if (!email) {
      setError('メールアドレスを入力してください')
      setLoading(false)
      return
    }

    /**
     * Server Actionでパスワードリセットをリクエスト
     * サーバーサイドでメール送信処理が実行される
     */
    const result = await requestPasswordReset(email)

    /**
     * エラーがあれば表示して処理終了
     */
    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    /**
     * 成功時: successフラグをtrueにして確認画面を表示
     */
    setSuccess(true)
    setLoading(false)
  }

  // ------------------------------------------------------------
  // 条件付きレンダリング（成功時）
  // ------------------------------------------------------------

  /**
   * 送信成功時は確認メッセージを表示
   * フォームは非表示にする
   */
  if (success) {
    return (
      <div className="space-y-4">
        {/* 成功メッセージカード（緑色の背景） */}
        <div className="rounded-lg bg-green-50 p-4 text-center">
          <p className="text-green-800 font-medium">メールを送信しました</p>
          <p className="text-green-700 text-sm mt-2">
            入力されたメールアドレスにパスワードリセット用のリンクを送信しました。
            メールをご確認ください。
          </p>
        </div>

        {/* 迷惑メールの確認を促す注意書き */}
        <p className="text-center text-sm text-muted-foreground">
          メールが届かない場合は、迷惑メールフォルダもご確認ください。
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
  // レンダリング（通常時）
  // ------------------------------------------------------------

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* 説明文 */}
      <p className="text-sm text-muted-foreground">
        登録したメールアドレスを入力してください。
        パスワードリセット用のリンクをお送りします。
      </p>

      {/* メールアドレス入力フィールド */}
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

      {/* エラーメッセージ表示 */}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* 送信ボタン */}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? '送信中...' : 'リセットメールを送信'}
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
