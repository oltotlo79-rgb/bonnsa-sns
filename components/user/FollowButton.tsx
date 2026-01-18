/**
 * フォローボタンコンポーネント
 *
 * このファイルは、ユーザーをフォロー/フォロー解除するボタンを提供します。
 * プロフィールページやユーザーカードで使用されます。
 *
 * ## 機能概要
 * - フォロー/フォロー解除のトグル
 * - Optimistic UI（即時レスポンス）
 * - ホバー時のUI変化（フォロー中→フォロー解除に変化）
 *
 * ## スタイリング
 * - 未フォロー: 緑色の背景
 * - フォロー中: アウトラインスタイル
 * - ホバー時（フォロー中）: 赤色に変化
 *
 * @module components/user/FollowButton
 */

'use client'

// ============================================================
// インポート
// ============================================================

/**
 * React useState Hook
 * フォロー状態、ローディング状態、ホバー状態の管理
 */
import { useState } from 'react'

/**
 * shadcn/uiのButtonコンポーネント
 */
import { Button } from '@/components/ui/button'

/**
 * フォロートグル用Server Action
 */
import { toggleFollow } from '@/lib/actions/follow'

/**
 * Next.jsルーター
 * ページリフレッシュと認証エラー時のリダイレクトに使用
 */
import { useRouter } from 'next/navigation'

// ============================================================
// 型定義
// ============================================================

/**
 * FollowButtonコンポーネントのprops型
 *
 * @property userId - フォロー対象のユーザーID
 * @property initialIsFollowing - 初期のフォロー状態（true=フォロー中）
 */
type FollowButtonProps = {
  userId: string
  initialIsFollowing: boolean
}

// ============================================================
// メインコンポーネント
// ============================================================

/**
 * フォローボタンコンポーネント
 *
 * ## 機能
 * - クリックでフォロー/フォロー解除をトグル
 * - Optimistic UIで即時フィードバック
 * - ホバー時に「フォロー解除」表示
 *
 * ## ユーザー体験
 * - フォロー中にホバーすると赤色の「フォロー解除」に変化
 * - これにより、ユーザーは解除操作を認識しやすい
 *
 * @param userId - フォロー対象のユーザーID
 * @param initialIsFollowing - 初期フォロー状態
 *
 * @example
 * ```tsx
 * <FollowButton
 *   userId="user123"
 *   initialIsFollowing={false}
 * />
 * ```
 */
export function FollowButton({ userId, initialIsFollowing }: FollowButtonProps) {
  // ------------------------------------------------------------
  // 状態管理
  // ------------------------------------------------------------

  /**
   * フォロー状態
   * true: フォロー中, false: 未フォロー
   */
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing)

  /**
   * ローディング状態
   * API呼び出し中はtrueになる
   */
  const [loading, setLoading] = useState(false)

  /**
   * ホバー状態
   * マウスがボタン上にある場合はtrue
   */
  const [isHovered, setIsHovered] = useState(false)

  /**
   * Next.jsルーター
   * ページリフレッシュとリダイレクトに使用
   */
  const router = useRouter()

  // ------------------------------------------------------------
  // イベントハンドラ
  // ------------------------------------------------------------

  /**
   * フォローボタンクリックハンドラ
   *
   * ## 処理フロー
   * 1. Optimistic UIで即座に状態を更新
   * 2. Server Actionでフォロー/解除を実行
   * 3. エラー時はロールバック
   * 4. 認証エラー時はログインページへリダイレクト
   */
  async function handleClick() {
    setLoading(true)

    /**
     * Optimistic UI: 即座にUIを更新
     * サーバーレスポンスを待たずに状態を変更
     */
    setIsFollowing(!isFollowing)

    const result = await toggleFollow(userId)

    if (result.error) {
      /**
       * エラー時: 元の状態にロールバック
       */
      setIsFollowing(isFollowing)

      /**
       * 認証エラーの場合はログインページへリダイレクト
       */
      if (result.error === '認証が必要です') {
        router.push('/login')
      }
    }

    setLoading(false)
    /**
     * ページをリフレッシュしてフォロー数などを更新
     */
    router.refresh()
  }

  // ------------------------------------------------------------
  // ヘルパー関数
  // ------------------------------------------------------------

  /**
   * ボタンテキストを取得
   *
   * 状態に応じてテキストを切り替え:
   * - ローディング中: '...'
   * - 未フォロー: 'フォローする'
   * - フォロー中（ホバー）: 'フォロー解除'
   * - フォロー中: 'フォロー中'
   */
  const getButtonText = () => {
    if (loading) return '...'
    if (!isFollowing) return 'フォローする'
    if (isHovered) return 'フォロー解除'
    return 'フォロー中'
  }

  /**
   * ボタンのCSSクラスを取得
   *
   * 状態に応じてスタイルを切り替え:
   * - 未フォロー: 緑色の背景
   * - フォロー中（ホバー）: 赤色のボーダーとテキスト
   * - フォロー中: デフォルトスタイル
   */
  const getButtonClass = () => {
    if (!isFollowing) return 'bg-bonsai-green hover:bg-bonsai-green/90'
    if (isHovered) return 'border-red-500 text-red-500 hover:bg-red-50'
    return ''
  }

  // ------------------------------------------------------------
  // レンダリング
  // ------------------------------------------------------------

  return (
    <Button
      onClick={handleClick}
      disabled={loading}
      variant={isFollowing ? 'outline' : 'default'}
      className={getButtonClass()}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {getButtonText()}
    </Button>
  )
}
