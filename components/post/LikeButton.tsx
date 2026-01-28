/**
 * いいねボタンコンポーネント
 *
 * このファイルは、投稿へのいいね機能を提供するボタンコンポーネントです。
 * ハートアイコンとカウントを表示し、クリックでいいねをトグルします。
 *
 * ## 機能概要
 * - いいね状態の表示（ハートアイコン）
 * - いいね数の表示
 * - クリックでいいねのON/OFF切り替え
 * - Optimistic UI（即時レスポンス）
 *
 * ## Optimistic UI パターン
 * ユーザー体験を向上させるため、サーバーレスポンスを待たずに
 * UIを即座に更新します。エラー時はロールバックします。
 *
 * @module components/post/LikeButton
 */

'use client'

// ============================================================
// インポート
// ============================================================

/**
 * React Hooks
 *
 * useState: いいね状態とカウントの管理
 * useTransition: 非同期処理中のペンディング状態管理
 * useEffect: propsの変更を監視して状態を同期
 */
import { useState, useTransition, useEffect } from 'react'

/**
 * ハートアイコン
 * lucide-reactライブラリから使用
 */
import { Heart } from 'lucide-react'

/**
 * React Query クライアント
 * いいね成功時にタイムラインキャッシュを無効化
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
 * いいねトグル用Server Action
 */
import { togglePostLike } from '@/lib/actions/like'

// ============================================================
// 型定義
// ============================================================

/**
 * LikeButtonコンポーネントのprops型
 *
 * @property postId - いいね対象の投稿ID
 * @property initialLiked - 初期のいいね状態（true=いいね済み）
 * @property initialCount - 初期のいいね数
 */
type LikeButtonProps = {
  postId: string
  initialLiked: boolean
  initialCount: number
}

// ============================================================
// メインコンポーネント
// ============================================================

/**
 * いいねボタンコンポーネント
 *
 * ## 機能
 * - ハートアイコンでいいね状態を視覚的に表示
 * - いいね済みの場合は赤く塗りつぶし
 * - クリックでいいねをトグル
 * - Optimistic UIで即時フィードバック
 *
 * ## スタイリング
 * - いいね済み: 赤色、塗りつぶし、拡大
 * - 未いいね: グレー、枠線のみ
 *
 * @param postId - 投稿ID
 * @param initialLiked - 初期いいね状態
 * @param initialCount - 初期いいね数
 *
 * @example
 * ```tsx
 * <LikeButton
 *   postId="post123"
 *   initialLiked={false}
 *   initialCount={42}
 * />
 * ```
 */
export function LikeButton({
  postId,
  initialLiked,
  initialCount,
}: LikeButtonProps) {
  // ------------------------------------------------------------
  // 状態管理
  // ------------------------------------------------------------

  /**
   * いいね状態
   * true: いいね済み, false: 未いいね
   */
  const [liked, setLiked] = useState(initialLiked)

  /**
   * いいね数
   */
  const [count, setCount] = useState(initialCount)

  /**
   * 非同期処理中のペンディング状態
   * useTransitionを使用してUIをブロックしない
   */
  const [isPending, startTransition] = useTransition()

  /**
   * React Queryクライアント
   * タイムラインのキャッシュ無効化に使用
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
   * propsが更新されたら状態を同期（値が変わった場合のみ）
   *
   * 親コンポーネントからの新しい値で状態を更新
   * タイムラインの再取得時などに発生
   *
   * 関数型更新を使用してカスケードレンダリングを回避
   */
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- props同期のための必要な処理
    setLiked((prev) => (prev !== initialLiked ? initialLiked : prev))
    setCount((prev) => (prev !== initialCount ? initialCount : prev))
  }, [initialLiked, initialCount])

  // ------------------------------------------------------------
  // イベントハンドラ
  // ------------------------------------------------------------

  /**
   * いいねトグルハンドラ
   *
   * ## Optimistic UI パターン
   * 1. UIを即座に更新（ユーザー体験向上）
   * 2. バックグラウンドでサーバーに送信
   * 3. エラー時はロールバック
   */
  async function handleToggle() {
    /**
     * Optimistic UI: 即座にUIを更新
     * サーバーレスポンスを待たずに状態を変更
     */
    const newLiked = !liked
    setLiked(newLiked)
    setCount(prev => newLiked ? prev + 1 : prev - 1)

    /**
     * useTransitionでラップしてペンディング状態を管理
     * UIをブロックせずに非同期処理を実行
     */
    startTransition(async () => {
      const result = await togglePostLike(postId)

      if (result.error) {
        /**
         * エラー時: 元の状態にロールバック
         */
        setLiked(liked)
        setCount(initialCount)
        toast({
          title: 'エラー',
          description: 'いいねに失敗しました。再度お試しください',
          variant: 'destructive',
        })
      } else {
        /**
         * 成功時: タイムラインキャッシュを無効化
         * 他の投稿のいいね数も最新化
         */
        queryClient.invalidateQueries({ queryKey: ['timeline'] })
        toast({
          description: newLiked ? 'いいねしました' : 'いいねを取り消しました',
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
      className={`flex items-center gap-1 ${
        liked
          ? 'text-red-500 hover:text-red-600'
          : 'text-muted-foreground hover:text-red-500'
      }`}
      onClick={handleToggle}
      disabled={isPending}
      aria-label={liked ? 'いいねを取り消す' : 'いいねする'}
      aria-pressed={liked}
    >
      <Heart
        className={`w-5 h-5 transition-all ${
          liked ? 'fill-current scale-110' : ''
        }`}
        aria-hidden="true"
      />
      <span className="text-sm">{count}</span>
    </Button>
  )
}
