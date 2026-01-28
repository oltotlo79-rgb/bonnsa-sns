/**
 * ブックマークボタンコンポーネント
 *
 * このファイルは、投稿をブックマーク/解除するボタンを提供します。
 * PostCardやPostDetailで使用されます。
 *
 * ## 機能概要
 * - ブックマーク状態の表示（しおりアイコン）
 * - クリックでブックマークのON/OFF切り替え
 * - Optimistic UI（即時レスポンス）
 *
 * ## スタイリング
 * - ブックマーク済み: 黄色、塗りつぶし
 * - 未ブックマーク: グレー、枠線のみ
 *
 * @module components/post/BookmarkButton
 */

'use client'

// ============================================================
// インポート
// ============================================================

/**
 * React Hooks
 *
 * useState: ブックマーク状態の管理
 * useTransition: 非同期処理中のペンディング状態管理
 * useEffect: propsの変更を監視して状態を同期
 */
import { useState, useTransition, useEffect } from 'react'

/**
 * ブックマークアイコン
 * lucide-reactライブラリから使用
 */
import { Bookmark } from 'lucide-react'

/**
 * React Query クライアント
 * ブックマーク成功時にタイムラインキャッシュを無効化
 */
import { useQueryClient } from '@tanstack/react-query'

/**
 * トースト通知
 * 操作結果のフィードバックに使用
 */
import { useToast } from '@/hooks/use-toast'

/**
 * shadcn/uiのButtonコンポーネント
 */
import { Button } from '@/components/ui/button'

/**
 * ブックマークトグル用Server Action
 */
import { toggleBookmark } from '@/lib/actions/bookmark'

// ============================================================
// 型定義
// ============================================================

/**
 * BookmarkButtonコンポーネントのprops型
 *
 * @property postId - ブックマーク対象の投稿ID
 * @property initialBookmarked - 初期のブックマーク状態
 */
type BookmarkButtonProps = {
  postId: string
  initialBookmarked: boolean
}

// ============================================================
// メインコンポーネント
// ============================================================

/**
 * ブックマークボタンコンポーネント
 *
 * ## 機能
 * - しおりアイコンでブックマーク状態を表示
 * - ブックマーク済みの場合は黄色で塗りつぶし
 * - クリックでブックマークをトグル
 * - Optimistic UIで即時フィードバック
 *
 * @param postId - 投稿ID
 * @param initialBookmarked - 初期ブックマーク状態
 *
 * @example
 * ```tsx
 * <BookmarkButton
 *   postId="post123"
 *   initialBookmarked={false}
 * />
 * ```
 */
export function BookmarkButton({
  postId,
  initialBookmarked,
}: BookmarkButtonProps) {
  // ------------------------------------------------------------
  // 状態管理
  // ------------------------------------------------------------

  /**
   * ブックマーク状態
   * true: ブックマーク済み, false: 未ブックマーク
   */
  const [bookmarked, setBookmarked] = useState(initialBookmarked)

  /**
   * 非同期処理中のペンディング状態
   */
  const [isPending, startTransition] = useTransition()

  /**
   * React Queryクライアント
   */
  const queryClient = useQueryClient()

  /**
   * トースト通知
   */
  const { toast } = useToast()

  // ------------------------------------------------------------
  // Effects
  // ------------------------------------------------------------

  /**
   * propsが更新されたら状態を同期
   */
  useEffect(() => {
    setBookmarked(initialBookmarked)
  }, [initialBookmarked])

  // ------------------------------------------------------------
  // イベントハンドラ
  // ------------------------------------------------------------

  /**
   * ブックマークトグルハンドラ
   *
   * Optimistic UIパターンを使用:
   * 1. UIを即座に更新
   * 2. バックグラウンドでサーバーに送信
   * 3. エラー時はロールバック
   */
  async function handleToggle() {
    /**
     * Optimistic UI: 即座にUIを更新
     */
    const newBookmarked = !bookmarked
    setBookmarked(newBookmarked)

    startTransition(async () => {
      const result = await toggleBookmark(postId)

      if (result.error) {
        /**
         * エラー時: 元の状態にロールバック
         */
        setBookmarked(bookmarked)
        toast({
          title: 'エラー',
          description: 'ブックマークに失敗しました。再度お試しください',
          variant: 'destructive',
        })
      } else {
        /**
         * 成功時: タイムラインキャッシュを無効化
         */
        queryClient.invalidateQueries({ queryKey: ['timeline'] })
        toast({
          description: newBookmarked ? 'ブックマークに追加しました' : 'ブックマークを解除しました',
        })
      }
    })
  }

  // ------------------------------------------------------------
  // レンダリング
  // ------------------------------------------------------------

  return (
    <Button
      variant="ghost"
      size="sm"
      className={`${
        bookmarked
          ? 'text-yellow-500 hover:text-yellow-600'
          : 'text-muted-foreground hover:text-yellow-500'
      }`}
      onClick={handleToggle}
      disabled={isPending}
      aria-label={bookmarked ? 'ブックマークを解除' : 'ブックマークに追加'}
      aria-pressed={bookmarked}
    >
      <Bookmark
        className={`w-5 h-5 transition-all ${
          bookmarked ? 'fill-current scale-110' : ''
        }`}
        aria-hidden="true"
      />
    </Button>
  )
}
