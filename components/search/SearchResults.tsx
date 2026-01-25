/**
 * 検索結果コンポーネント群
 *
 * このファイルは、検索結果を表示するための複数のコンポーネントを提供します。
 * 投稿検索、ユーザー検索、タグ検索の結果をそれぞれ専用のコンポーネントで表示します。
 *
 * ## 機能概要
 * - 投稿検索結果（PostSearchResults）: テキストとジャンルで投稿を検索
 * - ユーザー検索結果（UserSearchResults）: ニックネームやプロフィールでユーザーを検索
 * - タグ検索結果（TagSearchResults）: ハッシュタグで投稿を検索
 * - 人気タグ一覧（PopularTags）: よく使われるタグを表示
 *
 * ## 共通機能
 * - React Queryによる無限スクロール対応
 * - Intersection Observerによる自動読み込み
 * - ローディングスケルトン表示
 * - 空の結果時のメッセージ表示
 *
 * @module components/search/SearchResults
 */

'use client'

// ============================================================
// インポート
// ============================================================

/**
 * React Query - 無限スクロール用フック
 *
 * useInfiniteQuery: ページネーション付きデータ取得を管理
 * 自動的に次ページの読み込みとキャッシュを処理
 */
import { useInfiniteQuery } from '@tanstack/react-query'

/**
 * react-intersection-observer
 *
 * useInView: 要素がビューポート内に入ったかを検出
 * 無限スクロールのトリガーに使用
 */
import { useInView } from 'react-intersection-observer'

/**
 * React Hooks
 *
 * useEffect: スクロール検出時の次ページ読み込みトリガー
 */
import { useEffect } from 'react'

/**
 * Next.js コンポーネント
 *
 * Link: ユーザープロフィールへのリンク
 * Image: ユーザーアバター画像の最適化表示
 */
import Link from 'next/link'
import Image from 'next/image'

/**
 * 内部コンポーネント
 *
 * PostCard: 投稿カードの表示
 */
import { PostCard } from '@/components/post/PostCard'

/**
 * 検索アクション（Server Actions）
 *
 * searchPosts: 投稿検索
 * searchUsers: ユーザー検索
 * searchByTag: タグ検索
 */
import { searchPosts, searchUsers, searchByTag } from '@/lib/actions/search'

// ============================================================
// 型定義
// ============================================================

/**
 * 投稿の型
 *
 * PostCardコンポーネントに渡す投稿データ
 * 詳細な型定義はPostCardコンポーネント側で行われている
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Post = any

/**
 * ユーザーの型定義
 *
 * @property id - ユーザーの一意識別子
 * @property nickname - 表示名
 * @property avatarUrl - プロフィール画像URL（nullの場合はデフォルト表示）
 * @property bio - 自己紹介文（nullの場合は非表示）
 * @property followersCount - フォロワー数
 * @property followingCount - フォロー中の数
 */
type User = {
  /** ユーザーID */
  id: string
  /** ニックネーム（表示名） */
  nickname: string
  /** アバター画像URL */
  avatarUrl: string | null
  /** 自己紹介文 */
  bio: string | null
  /** フォロワー数 */
  followersCount: number
  /** フォロー中の数 */
  followingCount: number
}

// ============================================================
// 投稿検索結果コンポーネント
// ============================================================

/**
 * PostSearchResultsコンポーネントのprops型
 *
 * @property query - 検索クエリ文字列
 * @property genreIds - 絞り込みジャンルIDの配列（オプション）
 * @property initialPosts - サーバーサイドで取得した初期投稿データ
 * @property currentUserId - 現在ログイン中のユーザーID（いいね状態表示用）
 */
type PostSearchResultsProps = {
  /** 検索キーワード */
  query: string
  /** 選択されたジャンルIDの配列 */
  genreIds?: string[]
  /** 初期表示用の投稿データ */
  initialPosts?: Post[]
  /** 現在のユーザーID（いいね・ブックマーク状態の表示用） */
  currentUserId?: string
}

/**
 * 投稿検索結果コンポーネント
 *
 * テキスト検索とジャンルフィルタによる投稿の検索結果を表示。
 * 無限スクロールに対応し、スクロールに応じて自動的に次のページを読み込む。
 *
 * ## 機能
 * - キーワードによる投稿検索
 * - ジャンルによる絞り込み
 * - カーソルベースの無限スクロール
 * - 初期データのSSR対応
 *
 * @param query - 検索クエリ
 * @param genreIds - ジャンルフィルタ
 * @param initialPosts - 初期投稿データ
 * @param currentUserId - 現在のユーザーID
 *
 * @example
 * ```tsx
 * <PostSearchResults
 *   query="松"
 *   genreIds={['genre1', 'genre2']}
 *   initialPosts={posts}
 *   currentUserId={userId}
 * />
 * ```
 */
export function PostSearchResults({
  query,
  genreIds,
  initialPosts = [],
  currentUserId,
}: PostSearchResultsProps) {
  // ------------------------------------------------------------
  // Hooks
  // ------------------------------------------------------------

  /**
   * Intersection Observer
   *
   * ref: 監視対象要素に付与するref
   * inView: 要素がビューポート内に入ったらtrue
   */
  const { ref, inView } = useInView()

  /**
   * 無限クエリ（React Query）
   *
   * data: ページごとの検索結果
   * fetchNextPage: 次ページを取得する関数
   * hasNextPage: 次ページが存在するか
   * isFetchingNextPage: 次ページ取得中か
   * isLoading: 初回読み込み中か
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
     * query と genreIds が変わると再フェッチされる
     */
    queryKey: ['search-posts', query, genreIds],

    /**
     * データ取得関数
     * カーソル（pageParam）を使用してページネーション
     */
    queryFn: async ({ pageParam }) => {
      return await searchPosts(query, genreIds, pageParam)
    },

    /**
     * 初期ページパラメータ
     * 最初のページはカーソルなし（undefined）
     */
    initialPageParam: undefined as string | undefined,

    /**
     * 初期データ（SSR用）
     * サーバーサイドで取得したデータがあれば設定
     */
    initialData: initialPosts.length > 0 ? {
      pages: [{
        posts: initialPosts,
        /**
         * 次ページのカーソル
         * 20件以上あれば最後の投稿IDをカーソルに
         */
        nextCursor: initialPosts.length >= 20 ? initialPosts[initialPosts.length - 1]?.id : undefined,
      }],
      pageParams: [undefined],
    } : undefined,

    /**
     * 次ページのパラメータを取得
     * lastPageのnextCursorがあれば継続、なければ終了
     */
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  })

  /**
   * 自動ページ読み込み
   *
   * 監視要素がビューポートに入り、次ページがあり、
   * 現在取得中でない場合に次ページを取得
   */
  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage])

  // ------------------------------------------------------------
  // レンダリング
  // ------------------------------------------------------------

  /**
   * ローディング中の表示
   */
  if (isLoading) {
    return <SearchResultsSkeleton />
  }

  /**
   * 全ページの投稿を結合
   */
  const allPosts = data?.pages.flatMap((page) => page.posts) || []

  /**
   * 検索結果が空の場合
   */
  if (allPosts.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {query ? `「${query}」に一致する投稿はありません` : '投稿が見つかりません'}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 投稿カード一覧 */}
      {allPosts.map((post) => (
        <PostCard key={post.id} post={post} currentUserId={currentUserId} />
      ))}

      {/* 無限スクロールのトリガー要素 */}
      <div ref={ref} className="py-4 flex justify-center">
        {/* 次ページ読み込み中のインジケーター */}
        {isFetchingNextPage && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
            <span className="text-sm">読み込み中...</span>
          </div>
        )}

        {/* 全ページ読み込み完了メッセージ */}
        {!hasNextPage && allPosts.length > 0 && (
          <p className="text-sm text-muted-foreground">これ以上投稿はありません</p>
        )}
      </div>
    </div>
  )
}

// ============================================================
// ユーザー検索結果コンポーネント
// ============================================================

/**
 * UserSearchResultsコンポーネントのprops型
 *
 * @property query - 検索クエリ文字列
 * @property initialUsers - サーバーサイドで取得した初期ユーザーデータ
 */
type UserSearchResultsProps = {
  /** 検索キーワード（ニックネーム、bio等で検索） */
  query: string
  /** 初期表示用のユーザーデータ */
  initialUsers?: User[]
}

/**
 * ユーザー検索結果コンポーネント
 *
 * ニックネームや自己紹介文でユーザーを検索し、結果を一覧表示。
 * 無限スクロールに対応し、ユーザーカードをクリックするとプロフィールページに遷移。
 *
 * ## 機能
 * - ニックネーム、bioによるユーザー検索
 * - アバター画像の表示
 * - フォロワー数の表示
 * - プロフィールページへのリンク
 *
 * @param query - 検索クエリ
 * @param initialUsers - 初期ユーザーデータ
 *
 * @example
 * ```tsx
 * <UserSearchResults query="盆栽" initialUsers={users} />
 * ```
 */
export function UserSearchResults({ query, initialUsers = [] }: UserSearchResultsProps) {
  // ------------------------------------------------------------
  // Hooks
  // ------------------------------------------------------------

  /**
   * Intersection Observer
   */
  const { ref, inView } = useInView()

  /**
   * searchUsersの戻り値型
   * エラーオブジェクトを含む可能性があるため型を定義
   */
  type SearchUsersResult = Awaited<ReturnType<typeof searchUsers>>

  /**
   * 無限クエリ（React Query）
   *
   * ユーザー検索用の設定
   */
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
  } = useInfiniteQuery({
    /**
     * クエリキー
     * queryが変わると再フェッチ
     */
    queryKey: ['search-users', query],

    /**
     * データ取得関数
     * エラー時はReact Queryのエラーハンドリングに委譲
     */
    queryFn: async ({ pageParam }) => {
      const result = await searchUsers(query, pageParam)
      /**
       * Server Actionからのエラーをthrowして
       * React Queryのエラー状態として扱う
       */
      if ('error' in result && result.error) {
        throw new Error(result.error)
      }
      return result
    },

    /**
     * 初期ページパラメータ
     */
    initialPageParam: undefined as string | undefined,

    /**
     * 初期データ（SSR用）
     */
    initialData: initialUsers.length > 0 ? {
      pages: [{
        users: initialUsers,
        nextCursor: initialUsers.length >= 20 ? initialUsers[initialUsers.length - 1]?.id : undefined,
      } as SearchUsersResult],
      pageParams: [undefined],
    } : undefined,

    /**
     * 次ページのパラメータを取得
     */
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  })

  /**
   * 自動ページ読み込み
   */
  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage])

  // ------------------------------------------------------------
  // レンダリング
  // ------------------------------------------------------------

  /**
   * ローディング中の表示
   */
  if (isLoading) {
    return <SearchResultsSkeleton />
  }

  /**
   * エラー時の表示
   */
  if (error) {
    return (
      <div className="text-center py-8 text-destructive">
        {error.message || '検索中にエラーが発生しました'}
      </div>
    )
  }

  /**
   * 全ページのユーザーを結合
   */
  const allUsers = data?.pages.flatMap((page) => page.users) || []

  /**
   * 検索結果が空の場合
   */
  if (allUsers.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {query ? `「${query}」に一致するユーザーはいません` : 'ユーザーが見つかりません'}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* ユーザーカード一覧 */}
      {allUsers.map((user) => (
        <Link
          key={user.id}
          href={`/users/${user.id}`}
          className="flex items-center gap-3 p-3 bg-card rounded-lg border hover:bg-muted/50 transition-colors"
        >
          {/* アバター画像 */}
          {user.avatarUrl ? (
            <Image
              src={user.avatarUrl}
              alt={user.nickname}
              width={48}
              height={48}
              className="rounded-full object-cover"
            />
          ) : (
            /**
             * アバター画像がない場合のプレースホルダー
             * ニックネームの頭文字を表示
             */
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <span className="text-muted-foreground text-lg">
                {user.nickname.charAt(0)}
              </span>
            </div>
          )}

          {/* ユーザー情報 */}
          <div className="flex-1 min-w-0">
            {/* ニックネーム */}
            <p className="font-medium truncate">{user.nickname}</p>

            {/* 自己紹介（ある場合のみ） */}
            {user.bio && (
              <p className="text-sm text-muted-foreground line-clamp-1">{user.bio}</p>
            )}

            {/* フォロワー数 */}
            <p className="text-xs text-muted-foreground mt-1">
              {user.followersCount}フォロワー
            </p>
          </div>
        </Link>
      ))}

      {/* 無限スクロールのトリガー要素 */}
      <div ref={ref} className="py-4 flex justify-center">
        {/* 次ページ読み込み中のインジケーター */}
        {isFetchingNextPage && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
            <span className="text-sm">読み込み中...</span>
          </div>
        )}

        {/* 全ページ読み込み完了メッセージ */}
        {!hasNextPage && allUsers.length > 0 && (
          <p className="text-sm text-muted-foreground">これ以上ユーザーはいません</p>
        )}
      </div>
    </div>
  )
}

// ============================================================
// タグ検索結果コンポーネント
// ============================================================

/**
 * TagSearchResultsコンポーネントのprops型
 *
 * @property tag - 検索するタグ（#なし）
 * @property initialPosts - サーバーサイドで取得した初期投稿データ
 * @property currentUserId - 現在ログイン中のユーザーID
 */
type TagSearchResultsProps = {
  /** 検索するハッシュタグ（#記号なし） */
  tag: string
  /** 初期表示用の投稿データ */
  initialPosts?: Post[]
  /** 現在のユーザーID */
  currentUserId?: string
}

/**
 * タグ検索結果コンポーネント
 *
 * 特定のハッシュタグを含む投稿を検索し、一覧表示。
 * タグ名と投稿数をヘッダーに表示する。
 *
 * ## 機能
 * - ハッシュタグによる投稿検索
 * - タグ名と投稿件数のヘッダー表示
 * - 無限スクロール対応
 *
 * @param tag - 検索するタグ
 * @param initialPosts - 初期投稿データ
 * @param currentUserId - 現在のユーザーID
 *
 * @example
 * ```tsx
 * <TagSearchResults tag="松柏類" initialPosts={posts} currentUserId={userId} />
 * ```
 */
export function TagSearchResults({ tag, initialPosts = [], currentUserId }: TagSearchResultsProps) {
  // ------------------------------------------------------------
  // Hooks
  // ------------------------------------------------------------

  /**
   * Intersection Observer
   */
  const { ref, inView } = useInView()

  /**
   * 無限クエリ（React Query）
   *
   * タグ検索用の設定
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
     * tagが変わると再フェッチ
     */
    queryKey: ['search-tag', tag],

    /**
     * データ取得関数
     */
    queryFn: async ({ pageParam }) => {
      return await searchByTag(tag, pageParam)
    },

    /**
     * 初期ページパラメータ
     */
    initialPageParam: undefined as string | undefined,

    /**
     * 初期データ（SSR用）
     */
    initialData: initialPosts.length > 0 ? {
      pages: [{
        posts: initialPosts,
        nextCursor: initialPosts.length >= 20 ? initialPosts[initialPosts.length - 1]?.id : undefined,
      }],
      pageParams: [undefined],
    } : undefined,

    /**
     * 次ページのパラメータを取得
     */
    getNextPageParam: (lastPage) => lastPage.nextCursor,

    /**
     * タグが指定されている場合のみクエリを有効化
     */
    enabled: !!tag,
  })

  /**
   * 自動ページ読み込み
   */
  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage])

  // ------------------------------------------------------------
  // レンダリング
  // ------------------------------------------------------------

  /**
   * ローディング中の表示
   */
  if (isLoading) {
    return <SearchResultsSkeleton />
  }

  /**
   * 全ページの投稿を結合
   */
  const allPosts = data?.pages.flatMap((page) => page.posts) || []

  /**
   * 検索結果が空の場合
   */
  if (allPosts.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {tag ? `#${tag} を含む投稿はありません` : 'タグを入力してください'}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* タグ情報ヘッダー */}
      <div className="bg-muted/50 rounded-lg p-4">
        <h2 className="text-lg font-semibold">#{tag}</h2>
        <p className="text-sm text-muted-foreground">{allPosts.length}件の投稿</p>
      </div>

      {/* 投稿カード一覧 */}
      {allPosts.map((post) => (
        <PostCard key={post.id} post={post} currentUserId={currentUserId} />
      ))}

      {/* 無限スクロールのトリガー要素 */}
      <div ref={ref} className="py-4 flex justify-center">
        {/* 次ページ読み込み中のインジケーター */}
        {isFetchingNextPage && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
            <span className="text-sm">読み込み中...</span>
          </div>
        )}

        {/* 全ページ読み込み完了メッセージ */}
        {!hasNextPage && allPosts.length > 0 && (
          <p className="text-sm text-muted-foreground">これ以上投稿はありません</p>
        )}
      </div>
    </div>
  )
}

// ============================================================
// 人気タグ一覧コンポーネント
// ============================================================

/**
 * PopularTagsコンポーネントのprops型
 *
 * @property tags - タグと投稿数のオブジェクト配列
 */
type PopularTagsProps = {
  /** タグ情報の配列 */
  tags: {
    /** タグ名（#なし） */
    tag: string
    /** そのタグを使用している投稿数 */
    count: number
  }[]
}

/**
 * 人気タグ一覧コンポーネント
 *
 * よく使われているタグを一覧表示し、クリックでタグ検索に遷移。
 *
 * ## 機能
 * - 人気タグのバッジ表示
 * - 投稿数の表示
 * - タグ検索へのリンク
 *
 * @param tags - タグ情報の配列
 *
 * @example
 * ```tsx
 * <PopularTags tags={[
 *   { tag: '松柏類', count: 100 },
 *   { tag: '雑木類', count: 50 }
 * ]} />
 * ```
 */
export function PopularTags({ tags }: PopularTagsProps) {
  /**
   * タグが空の場合は何も表示しない
   */
  if (tags.length === 0) {
    return null
  }

  return (
    <div className="bg-card rounded-lg border p-4">
      {/* ヘッダー */}
      <h3 className="font-semibold mb-3">人気のタグ</h3>

      {/* タグバッジ一覧 */}
      <div className="flex flex-wrap gap-2">
        {tags.map(({ tag, count }) => (
          <Link
            key={tag}
            href={`/search?tab=tags&q=${encodeURIComponent(tag)}`}
            className="px-3 py-1.5 bg-muted rounded-full text-sm hover:bg-muted/80 transition-colors"
          >
            {/* タグ名 */}
            #{tag}

            {/* 投稿数 */}
            <span className="ml-1 text-muted-foreground text-xs">{count}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}

// ============================================================
// スケルトンコンポーネント
// ============================================================

/**
 * 検索結果スケルトンコンポーネント
 *
 * データ読み込み中に表示するプレースホルダー。
 * アニメーション付きのグレーブロックで構成。
 *
 * @example
 * ```tsx
 * {isLoading && <SearchResultsSkeleton />}
 * ```
 */
function SearchResultsSkeleton() {
  return (
    <div className="space-y-4">
      {/* 3件分のスケルトンカードを表示 */}
      {[...Array(3)].map((_, i) => (
        <div key={i} className="bg-card rounded-lg border p-4 animate-pulse">
          {/* ユーザー情報部分のスケルトン */}
          <div className="flex items-center gap-3 mb-3">
            {/* アバター */}
            <div className="w-10 h-10 rounded-full bg-muted" />

            {/* ユーザー名・日時 */}
            <div className="space-y-2">
              <div className="h-4 w-24 bg-muted rounded" />
              <div className="h-3 w-16 bg-muted rounded" />
            </div>
          </div>

          {/* コンテンツ部分のスケルトン */}
          <div className="space-y-2">
            <div className="h-4 w-full bg-muted rounded" />
            <div className="h-4 w-3/4 bg-muted rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}
