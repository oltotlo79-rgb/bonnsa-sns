/**
 * メッセージバッジコンポーネント
 *
 * このファイルは、未読メッセージ数を表示するバッジを提供します。
 * ナビゲーションバーのメッセージアイコン横に表示されます。
 *
 * ## 機能概要
 * - 未読メッセージ数のリアルタイム表示
 * - 30秒ごとの自動更新（ポーリング）
 * - 99+表示（100件以上の場合）
 * - 未読0件の場合は非表示
 *
 * @module components/message/MessageBadge
 */

'use client'

// ============================================================
// インポート
// ============================================================

/**
 * React Query のフック
 * データフェッチングとキャッシュ管理
 */
import { useQuery } from '@tanstack/react-query'

/**
 * 未読メッセージ数取得用Server Action
 */
import { getUnreadMessageCount } from '@/lib/actions/message'

// ============================================================
// 型定義
// ============================================================

/**
 * MessageBadgeコンポーネントのprops型
 *
 * @property className - 追加のCSSクラス
 */
type MessageBadgeProps = {
  className?: string
}

// ============================================================
// メインコンポーネント
// ============================================================

/**
 * メッセージバッジコンポーネント
 *
 * ## 機能
 * - React Queryで未読メッセージ数を取得
 * - 30秒ごとに自動更新
 * - 未読が0件の場合は何も表示しない
 *
 * @param className - 追加のCSSクラス
 *
 * @example
 * ```tsx
 * <MessageBadge className="absolute -top-1 -right-1" />
 * ```
 */
export function MessageBadge({ className }: MessageBadgeProps) {
  /**
   * React Queryで未読メッセージ数を取得
   *
   * queryKey: キャッシュのキー
   * queryFn: データ取得関数
   * refetchInterval: 30秒ごとにバックグラウンドで再取得
   */
  const { data } = useQuery({
    queryKey: ['unreadMessageCount'],
    queryFn: async () => {
      return await getUnreadMessageCount()
    },
    refetchInterval: 30000, // 30秒ごとに更新
  })

  /**
   * 未読数（取得失敗時は0）
   */
  const count = data?.count || 0

  /**
   * 未読が0件の場合は何も表示しない
   */
  if (count === 0) {
    return null
  }

  return (
    <span
      className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-xs font-medium bg-red-500 text-white rounded-full ${className}`}
    >
      {/* 100件以上は「99+」と表示 */}
      {count > 99 ? '99+' : count}
    </span>
  )
}
