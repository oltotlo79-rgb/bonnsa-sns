/**
 * タイムラインコンポーネント
 *
 * このファイルは、投稿のタイムライン表示と無限スクロール機能を提供します。
 * フィードページのメインコンテンツとして使用されます。
 *
 * ## 機能概要
 * - 投稿一覧の表示
 * - 無限スクロール（Intersection Observer使用）
 * - ローディング状態の表示
 * - 空状態の表示
 *
 * ## 技術的特徴
 * - React Query (useInfiniteQuery) によるデータ管理
 * - カーソルベースのページネーション
 * - 初期データのSSR対応
 *
 * @module components/feed/Timeline
 */

'use client'

// ============================================================
// インポート
// ============================================================

/**
 * React Query の無限スクロール用Hook
 * ページネーション付きのデータフェッチを管理
 */
import { useInfiniteQuery } from '@tanstack/react-query'

/**
 * Intersection Observer Hook
 * 要素がビューポートに入ったかを検知
 * 無限スクロールのトリガーに使用
 */
import { useInView } from 'react-intersection-observer'

/**
 * React useEffect Hook
 * スクロール検知時のデータフェッチに使用
 */
import { useEffect } from 'react'

/**
 * 投稿カードコンポーネント
 * 個別の投稿を表示
 */
import { PostCard } from '@/components/post/PostCard'

/**
 * フィード内広告コンポーネント
 */
import { InFeedAd } from '@/components/ads'

/**
 * タイムライン取得用Server Action
 */
import { getTimeline } from '@/lib/actions/feed'

/**
 * ローディング中のスケルトン表示
 */
import { TimelineSkeleton } from './TimelineSkeleton'

/**
 * 投稿がない場合の空状態表示
 */
import { EmptyTimeline } from './EmptyTimeline'

// ============================================================
// 型定義
// ============================================================

/**
 * 投稿の型
 *
 * 注意: 現在は any を使用していますが、
 * 厳密な型定義はlib/types配下に定義することを推奨
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Post = any

/**
 * Timelineコンポーネントのprops型
 *
 * @property initialPosts - SSRで取得した初期投稿データ
 * @property currentUserId - 現在のユーザーID（いいね状態の判定に使用）
 */
type TimelineProps = {
  initialPosts: Post[]
  currentUserId?: string
}

// ============================================================
// メインコンポーネント
// ============================================================

/**
 * タイムラインコンポーネント
 *
 * ## 機能
 * - 投稿一覧の無限スクロール表示
 * - SSRデータとクライアントデータの統合
 * - ローディングと空状態の処理
 *
 * ## 無限スクロールの仕組み
 * 1. 画面下部の監視要素（ref）がビューポートに入る
 * 2. inViewがtrueになる
 * 3. useEffectが発火してfetchNextPage()を呼び出し
 * 4. 次のページのデータが取得されてUIに追加
 *
 * @param initialPosts - 初期投稿データ
 * @param currentUserId - 現在のユーザーID
 *
 * @example
 * ```tsx
 * const posts = await getTimeline()
 *
 * <Timeline
 *   initialPosts={posts}
 *   currentUserId={session?.user?.id}
 * />
 * ```
 */
export function Timeline({ initialPosts, currentUserId }: TimelineProps) {
  // ------------------------------------------------------------
  // Hooks
  // ------------------------------------------------------------

  /**
   * Intersection Observer
   *
   * ref: 監視対象の要素に設定するref
   * inView: 要素がビューポート内にあるかどうか
   */
  const { ref, inView } = useInView()

  /**
   * React Query の無限クエリ
   *
   * - data: ページ分割されたデータ
   * - fetchNextPage: 次のページを取得する関数
   * - hasNextPage: 次のページがあるかどうか
   * - isFetchingNextPage: 次ページ取得中かどうか
   * - isLoading: 初回ローディング中かどうか
   */
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    /**
     * クエリキー
     * このキーでキャッシュを識別・無効化
     */
    queryKey: ['timeline'],

    /**
     * データ取得関数
     * pageParamにはカーソル（投稿ID）が渡される
     */
    queryFn: async ({ pageParam }) => {
      const result = await getTimeline(pageParam)
      return result
    },

    /**
     * 初期ページパラメータ
     * 最初のページはundefined（最新から取得）
     */
    initialPageParam: undefined as string | undefined,

    /**
     * SSRで取得した初期データ
     * ハイドレーション時に使用
     */
    initialData: {
      pages: [{
        posts: initialPosts,
        nextCursor: initialPosts.length >= 20 ? initialPosts[initialPosts.length - 1]?.id : undefined,
      }],
      pageParams: [undefined],
    },

    /**
     * 次のページのパラメータを取得
     * nextCursorがあれば次ページあり、なければ終端
     */
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  })

  // ------------------------------------------------------------
  // Effects
  // ------------------------------------------------------------

  /**
   * 無限スクロールの自動フェッチ
   *
   * 監視要素がビューポートに入り、
   * 次ページがあり、取得中でない場合に次ページを取得
   */
  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage])

  // ------------------------------------------------------------
  // 条件付きレンダリング
  // ------------------------------------------------------------

  /**
   * 初回ローディング中はスケルトンを表示
   */
  if (isLoading) {
    return <TimelineSkeleton />
  }

  /**
   * 全ページの投稿を1次元配列にフラット化
   */
  const allPosts = data?.pages.flatMap((page) => page.posts) || []

  /**
   * 投稿がない場合は空状態を表示
   */
  if (allPosts.length === 0) {
    return <EmptyTimeline />
  }

  // ------------------------------------------------------------
  // レンダリング
  // ------------------------------------------------------------

  // 広告を挿入する間隔（N投稿ごとに1つ）
  const AD_INTERVAL = 5

  return (
    <div className="space-y-4">
      {allPosts.map((post, index) => (
        <div key={post.id}>
          <PostCard post={post} currentUserId={currentUserId} />
          {/* N投稿ごとに広告を表示 */}
          {(index + 1) % AD_INTERVAL === 0 && (
            <InFeedAd
              adSlot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_INFEED}
              className="my-4"
            />
          )}
        </div>
      ))}

      {/* 無限スクロール検知 */}
      <div
        ref={ref}
        className="py-4 flex flex-col items-center gap-2"
        role="status"
        aria-live="polite"
      >
        {isFetchingNextPage && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <div
              className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"
              aria-hidden="true"
            />
            <span className="text-sm">投稿を読み込んでいます...</span>
          </div>
        )}
        {!isFetchingNextPage && hasNextPage && (
          <p className="text-xs text-muted-foreground">
            {allPosts.length}件の投稿を表示中
          </p>
        )}
        {!hasNextPage && allPosts.length > 0 && (
          <p className="text-sm text-muted-foreground">
            すべての投稿を表示しました（{allPosts.length}件）
          </p>
        )}
      </div>
    </div>
  )
}
