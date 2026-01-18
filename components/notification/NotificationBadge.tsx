/**
 * 通知バッジコンポーネント
 *
 * このファイルは、未読通知数を表示するバッジを提供します。
 * ナビゲーションバーの通知アイコン横に表示されます。
 *
 * ## 機能概要
 * - 未読通知数のリアルタイム表示
 * - 30秒ごとの自動更新（ポーリング）
 * - 99+表示（100件以上の場合）
 * - 未読0件の場合は非表示
 *
 * ## コンポーネント
 * - NotificationBadge: クライアントコンポーネント（React Query使用）
 * - NotificationBadgeServer: サーバーコンポーネント版
 *
 * @module components/notification/NotificationBadge
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
 * 未読通知数取得用Server Action
 */
import { getUnreadCount } from '@/lib/actions/notification'

// ============================================================
// 型定義
// ============================================================

/**
 * NotificationBadgeコンポーネントのprops型
 *
 * @property className - 追加のCSSクラス
 */
type NotificationBadgeProps = {
  className?: string
}

// ============================================================
// クライアントコンポーネント
// ============================================================

/**
 * 通知バッジコンポーネント（クライアント版）
 *
 * ## 機能
 * - React Queryで未読通知数を取得
 * - 30秒ごとに自動更新
 * - 未読が0件の場合は何も表示しない
 *
 * @param className - 追加のCSSクラス
 *
 * @example
 * ```tsx
 * <NotificationBadge className="absolute -top-1 -right-1" />
 * ```
 */
export function NotificationBadge({ className }: NotificationBadgeProps) {
  /**
   * React Queryで未読通知数を取得
   *
   * queryKey: キャッシュのキー
   * queryFn: データ取得関数
   * refetchInterval: 30秒ごとにバックグラウンドで再取得
   */
  const { data } = useQuery({
    queryKey: ['unreadCount'],
    queryFn: async () => {
      return await getUnreadCount()
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

// ============================================================
// サーバーコンポーネント
// ============================================================

/**
 * 通知バッジコンポーネント（サーバー版）
 *
 * ## 用途
 * - サーバーコンポーネントから直接呼び出す場合に使用
 * - 初期表示時にSSRで未読数を表示
 *
 * ## 注意
 * - リアルタイム更新はされない
 * - 動的な更新が必要な場合はクライアント版を使用
 */
export async function NotificationBadgeServer() {
  const { count } = await getUnreadCount()

  if (count === 0) {
    return null
  }

  return (
    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-xs font-medium bg-red-500 text-white rounded-full">
      {count > 99 ? '99+' : count}
    </span>
  )
}
