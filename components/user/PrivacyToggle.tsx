/**
 * プライバシー設定トグルコンポーネント
 *
 * このファイルは、アカウントの公開/非公開を切り替えるトグルスイッチを提供します。
 * 設定ページのプライバシー設定セクションで使用されます。
 *
 * ## 機能概要
 * - アカウントの公開/非公開を切り替え
 * - トグルの状態に応じて説明文を動的に変更
 * - Server Actionを使用してデータベースを更新
 *
 * ## 公開/非公開の違い
 * - 公開: 誰でもあなたの投稿を閲覧できます
 * - 非公開: フォロワーのみがあなたの投稿を閲覧できます
 *
 * @module components/user/PrivacyToggle
 */

'use client'

// ============================================================
// インポート
// ============================================================

/**
 * React useState Hook
 * 公開状態、ローディング状態、エラー状態の管理に使用
 */
import { useState } from 'react'

/**
 * Next.js useRouter Hook
 * 設定変更後にページをリフレッシュして最新状態を反映するために使用
 */
import { useRouter } from 'next/navigation'

/**
 * shadcn/ui Switchコンポーネント
 * オン/オフを切り替えるトグルスイッチUI
 */
import { Switch } from '@/components/ui/switch'

/**
 * shadcn/ui Labelコンポーネント
 * フォーム要素のラベル表示
 */
import { Label } from '@/components/ui/label'

/**
 * プライバシー設定更新用Server Action
 * データベースのユーザーのisPublicフィールドを更新
 */
import { updatePrivacy } from '@/lib/actions/user'

// ============================================================
// 型定義
// ============================================================

/**
 * PrivacyToggleコンポーネントのprops型
 *
 * @property initialIsPublic - 初期の公開状態（true=公開, false=非公開）
 */
type PrivacyToggleProps = {
  initialIsPublic: boolean
}

// ============================================================
// メインコンポーネント
// ============================================================

/**
 * プライバシー設定トグルコンポーネント
 *
 * ## 機能
 * - トグルスイッチでアカウントの公開/非公開を切り替え
 * - 設定変更時にServer Actionを呼び出し
 * - エラー時はエラーメッセージを表示
 *
 * ## ユーザー体験
 * - 公開時: 「誰でもあなたの投稿を閲覧できます」と表示
 * - 非公開時: 「フォロワーのみがあなたの投稿を閲覧できます」と表示
 *
 * @param initialIsPublic - 初期の公開状態
 *
 * @example
 * ```tsx
 * // 設定ページでの使用例
 * <PrivacyToggle initialIsPublic={user.isPublic} />
 * ```
 */
export function PrivacyToggle({ initialIsPublic }: PrivacyToggleProps) {
  // ------------------------------------------------------------
  // 状態管理
  // ------------------------------------------------------------

  /**
   * 公開状態
   * true: 公開（誰でも閲覧可能）
   * false: 非公開（フォロワーのみ閲覧可能）
   */
  const [isPublic, setIsPublic] = useState(initialIsPublic)

  /**
   * ローディング状態
   * Server Action呼び出し中はtrueになり、スイッチが無効化される
   */
  const [loading, setLoading] = useState(false)

  /**
   * エラー状態
   * Server Actionがエラーを返した場合にエラーメッセージを格納
   */
  const [error, setError] = useState<string | null>(null)

  /**
   * Next.jsルーター
   * 設定変更後にページをリフレッシュするために使用
   */
  const router = useRouter()

  // ------------------------------------------------------------
  // イベントハンドラ
  // ------------------------------------------------------------

  /**
   * トグルスイッチ変更ハンドラ
   *
   * ## 処理フロー
   * 1. ローディング状態を開始
   * 2. エラー状態をクリア
   * 3. Server Actionを呼び出してプライバシー設定を更新
   * 4. 成功時: 状態を更新し、ページをリフレッシュ
   * 5. エラー時: エラーメッセージを表示
   * 6. ローディング状態を終了
   *
   * @param checked - 新しいトグル状態（true=公開, false=非公開）
   */
  async function handleChange(checked: boolean) {
    // ローディング開始、エラークリア
    setLoading(true)
    setError(null)

    // Server Actionを呼び出してプライバシー設定を更新
    const result = await updatePrivacy(checked)

    if (result.error) {
      // エラー時: エラーメッセージを表示
      setError(result.error)
    } else {
      // 成功時: 状態を更新し、ページをリフレッシュ
      setIsPublic(checked)
      router.refresh()
    }

    // ローディング終了
    setLoading(false)
  }

  // ------------------------------------------------------------
  // レンダリング
  // ------------------------------------------------------------

  return (
    <div className="space-y-3">
      {/* トグルスイッチとラベル */}
      <div className="flex items-center justify-between">
        <div>
          {/* ラベル: 設定項目の名前 */}
          <Label htmlFor="privacy-toggle" className="text-base">
            アカウントを公開する
          </Label>
          {/* 説明文: 現在の状態に応じて動的に変化 */}
          <p className="text-sm text-muted-foreground mt-1">
            {isPublic
              ? '誰でもあなたの投稿を閲覧できます'
              : 'フォロワーのみがあなたの投稿を閲覧できます'}
          </p>
        </div>
        {/* トグルスイッチ */}
        <Switch
          id="privacy-toggle"
          checked={isPublic}
          onCheckedChange={handleChange}
          disabled={loading}
        />
      </div>

      {/* エラーメッセージ（エラーがある場合のみ表示） */}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  )
}
