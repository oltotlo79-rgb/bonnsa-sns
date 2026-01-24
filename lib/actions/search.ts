/**
 * 検索機能のServer Actions
 *
 * このファイルは、投稿・ユーザーの検索に関する
 * サーバーサイドの処理を提供します。
 *
 * ## 機能概要
 * - 投稿検索（キーワード、ジャンルフィルタ）
 * - ユーザー検索（ニックネーム、自己紹介）
 * - ハッシュタグ検索
 * - 人気タグ取得
 * - ジャンル一覧取得
 *
 * ## 検索モード
 * 環境に応じて最適な検索方法を自動選択：
 * - bigm: PostgreSQL pg_bigm拡張（日本語N-gram対応）
 * - trgm: PostgreSQL pg_trgm拡張（トライグラム検索）
 * - like: 通常のLIKE検索（フォールバック）
 *
 * ## パフォーマンス最適化
 * - 全文検索インデックスの活用
 * - ブロック/ミュートユーザーの除外
 * - キャッシュの活用（人気タグ、ジャンル一覧）
 * - カーソルベースページネーション
 *
 * @module lib/actions/search
 */

'use server'

// ============================================================
// インポート
// ============================================================

/**
 * Prismaクライアント
 * データベース操作に使用
 */
import { prisma } from '@/lib/db'

/**
 * 認証関数
 * NextAuth.jsのセッション取得に使用
 */
import { auth } from '@/lib/auth'

/**
 * 全文検索関連関数
 *
 * - fulltextSearchPosts: 投稿の全文検索
 * - fulltextSearchUsers: ユーザーの全文検索
 * - getSearchMode: 現在の検索モードを取得
 */
import { fulltextSearchPosts, fulltextSearchUsers, getSearchMode } from '@/lib/search/fulltext'

/**
 * 除外ユーザーID取得関数
 * ブロック/ミュートしているユーザーを除外するために使用
 */
import { getExcludedUserIds } from './filter-helper'

/**
 * キャッシュ関数
 *
 * - getCachedGenres: キャッシュされたジャンル一覧
 * - getCachedPopularTags: キャッシュされた人気タグ
 */
import { getCachedGenres, getCachedPopularTags } from '@/lib/cache'

/**
 * レート制限関数
 *
 * 検索はDB負荷が高いため、レート制限を適用
 */
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { headers } from 'next/headers'

// ============================================================
// ヘルパー関数
// ============================================================

/**
 * Server ActionsでクライアントIPを取得
 *
 * headers()を使用してリクエストヘッダーからIPアドレスを取得
 */
async function getClientIpFromHeaders(): Promise<string> {
  const headersList = await headers()
  const cfIp = headersList.get('cf-connecting-ip')
  if (cfIp) return cfIp
  const xForwardedFor = headersList.get('x-forwarded-for')
  if (xForwardedFor) return xForwardedFor.split(',')[0].trim()
  const xRealIp = headersList.get('x-real-ip')
  if (xRealIp) return xRealIp
  return 'unknown'
}

// ============================================================
// 投稿検索
// ============================================================

/**
 * 投稿を検索
 *
 * ## 機能概要
 * キーワードとジャンルで投稿を検索します。
 * 検索モードに応じて全文検索またはLIKE検索を使用します。
 *
 * ## 検索対象
 * - 投稿の本文（content）
 *
 * ## フィルタリング
 * - 非表示投稿を除外
 * - ブロック/ミュートしているユーザーの投稿を除外
 * - ブロックされているユーザーの投稿を除外
 *
 * ## 検索モードによる処理の違い
 *
 * ### 全文検索モード（bigm/trgm）
 * 1. fulltextSearchPosts() でIDを取得
 * 2. IDで投稿を取得（検索順序を維持）
 *
 * ### LIKE検索モード
 * - Prisma の contains + mode: 'insensitive' を使用
 * - 大文字小文字を区別しない検索
 *
 * @param query - 検索キーワード
 * @param genreIds - ジャンルIDの配列（オプション）
 * @param cursor - ページネーション用カーソル
 * @param limit - 取得件数（デフォルト: 20）
 * @returns 検索結果の投稿一覧と次のカーソル
 *
 * @example
 * ```typescript
 * // キーワード検索
 * const { posts } = await searchPosts('松の盆栽')
 *
 * // キーワード + ジャンルフィルタ
 * const { posts } = await searchPosts('手入れ', ['genre-1', 'genre-2'])
 * ```
 */
export async function searchPosts(
  query: string,
  genreIds?: string[],
  cursor?: string,
  limit = 20
) {
  /**
   * レート制限チェック（IP単位）
   *
   * 検索はDB負荷が高いため、IP単位で制限
   */
  const clientIp = await getClientIpFromHeaders()
  const rateLimitResult = await rateLimit(`search:${clientIp}`, RATE_LIMITS.search)
  if (!rateLimitResult.success) {
    return { posts: [], nextCursor: undefined, error: '検索リクエストが多すぎます。しばらく待ってから再試行してください' }
  }

  const session = await auth()
  const currentUserId = session?.user?.id

  // ------------------------------------------------------------
  // 除外ユーザーの取得
  // ------------------------------------------------------------

  /**
   * ブロック/ミュートしているユーザーを除外
   *
   * - blocked: 自分がブロックしたユーザー
   * - blockedBy: 自分をブロックしたユーザー
   * - muted: 自分がミュートしたユーザー
   */
  const excludedUserIds = currentUserId
    ? await getExcludedUserIds(currentUserId, { blocked: true, blockedBy: true, muted: true })
    : []

  /**
   * 現在の検索モードを取得
   * 'bigm' | 'trgm' | 'like'
   */
  const searchMode = getSearchMode()

  // ------------------------------------------------------------
  // 共通のinclude設定
  // ------------------------------------------------------------

  /**
   * 投稿取得時の関連データ設定
   * as const で型を厳密に推論
   */
  const postInclude = {
    user: {
      select: { id: true, nickname: true, avatarUrl: true },
    },
    media: {
      orderBy: { sortOrder: 'asc' },
    },
    genres: {
      include: { genre: true },
    },
    _count: {
      select: { likes: true, comments: true },
    },
  } as const

  // ============================================================
  // 全文検索モード（bigm/trgm）
  // ============================================================

  if (query && (searchMode === 'bigm' || searchMode === 'trgm')) {
    // ------------------------------------------------------------
    // 全文検索でIDを取得
    // ------------------------------------------------------------

    /**
     * 全文検索を実行し、投稿IDの配列を取得
     *
     * 全文検索はスコアリングや関連度を考慮して結果を返すため、
     * IDのみを取得し、その後Prismaで詳細を取得する2段階方式
     */
    const postIds = await fulltextSearchPosts(query, {
      excludedUserIds,
      genreIds,
      cursor,
      limit,
    })

    /**
     * 結果がない場合は早期リターン
     */
    if (postIds.length === 0) {
      return { posts: [], nextCursor: undefined }
    }

    // ------------------------------------------------------------
    // IDで投稿を取得
    // ------------------------------------------------------------

    /**
     * 全文検索で取得したIDで投稿を取得
     */
    const fetchedPosts = await prisma.post.findMany({
      where: {
        id: { in: postIds },
      },
      include: postInclude,
    })

    /**
     * 元の順序を維持
     *
     * Prisma の findMany は IN 句の順序を保証しないため、
     * 全文検索の結果順（関連度順）を維持するために並べ替え
     */
    const posts = postIds
      .map((id: string) => fetchedPosts.find((p: typeof fetchedPosts[number]) => p.id === id))
      .filter((p: typeof fetchedPosts[number] | undefined): p is typeof fetchedPosts[number] => p !== undefined)

    // ------------------------------------------------------------
    // いいね/ブックマーク状態の取得
    // ------------------------------------------------------------

    /**
     * 現在のユーザーのいいね/ブックマーク状態
     */
    let likedPostIds: Set<string> = new Set()
    let bookmarkedPostIds: Set<string> = new Set()

    if (currentUserId && posts.length > 0) {
      const ids = posts.map((p: typeof posts[number]) => p.id)

      /**
       * 並列で取得（N+1問題回避）
       */
      const [userLikes, userBookmarks] = await Promise.all([
        prisma.like.findMany({
          where: {
            userId: currentUserId,
            postId: { in: ids },
            commentId: null,
          },
          select: { postId: true },
        }),
        prisma.bookmark.findMany({
          where: {
            userId: currentUserId,
            postId: { in: ids },
          },
          select: { postId: true },
        }),
      ])

      likedPostIds = new Set(userLikes.map((l: { postId: string | null }) => l.postId).filter((id: string | null): id is string => id !== null))
      bookmarkedPostIds = new Set(userBookmarks.map((b: { postId: string }) => b.postId))
    }

    // ------------------------------------------------------------
    // 結果の整形と返却
    // ------------------------------------------------------------

    const formattedPosts = posts.map((post: typeof posts[number]) => ({
      ...post,
      likeCount: post._count.likes,
      commentCount: post._count.comments,
      genres: post.genres.map((pg: typeof post.genres[number]) => pg.genre),
      isLiked: likedPostIds.has(post.id),
      isBookmarked: bookmarkedPostIds.has(post.id),
    }))

    return {
      posts: formattedPosts,
      nextCursor: posts.length === limit ? posts[posts.length - 1]?.id : undefined,
    }
  }

  // ============================================================
  // 従来のLIKE検索
  // ============================================================

  /**
   * LIKE検索を実行
   *
   * mode: 'insensitive' で大文字小文字を区別しない検索
   * AND条件で複数のフィルタを組み合わせ
   */
  const posts = await prisma.post.findMany({
    where: {
      isHidden: false, // 非表示投稿を除外
      AND: [
        /**
         * キーワード検索条件
         * query がある場合のみ適用
         */
        query
          ? {
              content: {
                contains: query,
                mode: 'insensitive' as const,
              },
            }
          : {},
        /**
         * ジャンルフィルタ条件
         * genreIds がある場合のみ適用
         *
         * some: 「いずれかのジャンルに該当」という条件
         */
        genreIds && genreIds.length > 0
          ? {
              genres: {
                some: {
                  genreId: { in: genreIds },
                },
              },
            }
          : {},
        /**
         * 除外ユーザー条件
         */
        excludedUserIds.length > 0
          ? {
              userId: {
                notIn: excludedUserIds,
              },
            }
          : {},
      ],
    },
    include: postInclude,
    orderBy: { createdAt: 'desc' },
    take: limit,
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1,
    }),
  })

  // ------------------------------------------------------------
  // いいね/ブックマーク状態の取得
  // ------------------------------------------------------------

  let likedPostIds: Set<string> = new Set()
  let bookmarkedPostIds: Set<string> = new Set()

  if (currentUserId && posts.length > 0) {
    const postIds = posts.map((p: typeof posts[number]) => p.id)

    const [userLikes, userBookmarks] = await Promise.all([
      prisma.like.findMany({
        where: {
          userId: currentUserId,
          postId: { in: postIds },
          commentId: null,
        },
        select: { postId: true },
      }),
      prisma.bookmark.findMany({
        where: {
          userId: currentUserId,
          postId: { in: postIds },
        },
        select: { postId: true },
      }),
    ])

    likedPostIds = new Set(userLikes.map((l: { postId: string | null }) => l.postId).filter((id: string | null): id is string => id !== null))
    bookmarkedPostIds = new Set(userBookmarks.map((b: { postId: string }) => b.postId))
  }

  // ------------------------------------------------------------
  // 結果の整形と返却
  // ------------------------------------------------------------

  const formattedPosts = posts.map((post: typeof posts[number]) => ({
    ...post,
    likeCount: post._count.likes,
    commentCount: post._count.comments,
    genres: post.genres.map((pg: typeof post.genres[number]) => pg.genre),
    isLiked: likedPostIds.has(post.id),
    isBookmarked: bookmarkedPostIds.has(post.id),
  }))

  return {
    posts: formattedPosts,
    nextCursor: posts.length === limit ? posts[posts.length - 1]?.id : undefined,
  }
}

// ============================================================
// ユーザー検索
// ============================================================

/**
 * ユーザーを検索
 *
 * ## 機能概要
 * キーワードでユーザーを検索します。
 *
 * ## 検索対象
 * - ニックネーム（nickname）
 * - 自己紹介（bio）
 *
 * ## フィルタリング
 * - ブロック関係にあるユーザーを除外
 * - 自分自身を除外
 *
 * @param query - 検索キーワード
 * @param cursor - ページネーション用カーソル
 * @param limit - 取得件数（デフォルト: 20）
 * @returns 検索結果のユーザー一覧と次のカーソル
 *
 * @example
 * ```typescript
 * const { users } = await searchUsers('盆栽愛好家')
 * ```
 */
export async function searchUsers(query: string, cursor?: string, limit = 20) {
  /**
   * レート制限チェック（IP単位）
   */
  const clientIp = await getClientIpFromHeaders()
  const rateLimitResult = await rateLimit(`search:${clientIp}`, RATE_LIMITS.search)
  if (!rateLimitResult.success) {
    return { users: [], nextCursor: undefined, error: '検索リクエストが多すぎます。しばらく待ってから再試行してください' }
  }

  const session = await auth()
  const currentUserId = session?.user?.id

  // ------------------------------------------------------------
  // 除外ユーザーの取得
  // ------------------------------------------------------------

  /**
   * ブロック関係のユーザーを除外
   *
   * - blocked: 自分がブロックしたユーザー
   * - blockedBy: 自分をブロックしたユーザー
   *
   * ※ミュートは検索結果から除外しない（フォロー状態は維持されるため）
   */
  const excludedUserIds = currentUserId
    ? await getExcludedUserIds(currentUserId, { blocked: true, blockedBy: true })
    : []

  const searchMode = getSearchMode()

  // ------------------------------------------------------------
  // 共通のselect設定
  // ------------------------------------------------------------

  /**
   * ユーザー取得時の選択フィールド
   */
  const userSelect = {
    id: true,
    nickname: true,
    avatarUrl: true,
    bio: true,
    _count: {
      select: { followers: true, following: true },
    },
  } as const

  // ============================================================
  // 全文検索モード
  // ============================================================

  if (query && (searchMode === 'bigm' || searchMode === 'trgm')) {
    /**
     * 全文検索でIDを取得
     */
    const userIds = await fulltextSearchUsers(query, {
      excludedUserIds,
      currentUserId,
      cursor,
      limit,
    })

    if (userIds.length === 0) {
      return { users: [], nextCursor: undefined }
    }

    /**
     * IDでユーザーを取得
     */
    const fetchedUsers = await prisma.user.findMany({
      where: {
        id: { in: userIds },
      },
      select: userSelect,
    })

    /**
     * 元の順序を維持
     */
    const users = userIds
      .map((id: string) => fetchedUsers.find((u: typeof fetchedUsers[number]) => u.id === id))
      .filter((u: typeof fetchedUsers[number] | undefined): u is typeof fetchedUsers[number] => u !== undefined)

    return {
      users: users.map((user: typeof users[number]) => ({
        ...user,
        followersCount: user._count.followers,
        followingCount: user._count.following,
      })),
      nextCursor: users.length === limit ? users[users.length - 1]?.id : undefined,
    }
  }

  // ============================================================
  // 従来のLIKE検索
  // ============================================================

  /**
   * LIKE検索を実行
   *
   * OR条件でニックネームと自己紹介を検索
   */
  const users = await prisma.user.findMany({
    where: {
      AND: [
        /**
         * キーワード検索条件
         *
         * OR: ニックネーム または 自己紹介 にマッチ
         */
        query
          ? {
              OR: [
                {
                  nickname: {
                    contains: query,
                    mode: 'insensitive' as const,
                  },
                },
                {
                  bio: {
                    contains: query,
                    mode: 'insensitive' as const,
                  },
                },
              ],
            }
          : {},
        /**
         * 除外ユーザー条件
         */
        excludedUserIds.length > 0
          ? {
              id: {
                notIn: excludedUserIds,
              },
            }
          : {},
        /**
         * 自分自身を除外
         */
        currentUserId
          ? {
              id: {
                not: currentUserId,
              },
            }
          : {},
      ],
    },
    select: userSelect,
    take: limit,
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1,
    }),
  })

  return {
    users: users.map((user: typeof users[number]) => ({
      ...user,
      followersCount: user._count.followers,
      followingCount: user._count.following,
    })),
    nextCursor: users.length === limit ? users[users.length - 1]?.id : undefined,
  }
}

// ============================================================
// ハッシュタグ検索
// ============================================================

/**
 * ハッシュタグで投稿を検索
 *
 * ## 機能概要
 * 特定のハッシュタグを含む投稿を検索します。
 *
 * ## 検索方法
 * content フィールドに `#${tag}` を含む投稿を検索
 * LIKE検索を使用（全文検索は使用しない）
 *
 * ## フィルタリング
 * - 非表示投稿を除外
 * - ブロック/ミュートしているユーザーの投稿を除外
 *
 * @param tag - ハッシュタグ（#は含まない）
 * @param cursor - ページネーション用カーソル
 * @param limit - 取得件数（デフォルト: 20）
 * @returns 検索結果の投稿一覧と次のカーソル
 *
 * @example
 * ```typescript
 * // #盆栽 を含む投稿を検索
 * const { posts } = await searchByTag('盆栽')
 * ```
 */
export async function searchByTag(tag: string, cursor?: string, limit = 20) {
  /**
   * レート制限チェック（IP単位）
   */
  const clientIp = await getClientIpFromHeaders()
  const rateLimitResult = await rateLimit(`search:${clientIp}`, RATE_LIMITS.search)
  if (!rateLimitResult.success) {
    return { posts: [], nextCursor: undefined, error: '検索リクエストが多すぎます。しばらく待ってから再試行してください' }
  }

  const session = await auth()
  const currentUserId = session?.user?.id

  // ------------------------------------------------------------
  // 除外ユーザーの取得
  // ------------------------------------------------------------

  const excludedUserIds = currentUserId
    ? await getExcludedUserIds(currentUserId, { blocked: true, blockedBy: true, muted: true })
    : []

  // ------------------------------------------------------------
  // ハッシュタグを含む投稿を検索
  // ------------------------------------------------------------

  /**
   * contains: `#${tag}` でハッシュタグを検索
   *
   * 例: tag = '盆栽' の場合、`#盆栽` を含む投稿を検索
   */
  const posts = await prisma.post.findMany({
    where: {
      isHidden: false, // 非表示投稿を除外
      AND: [
        {
          content: {
            contains: `#${tag}`,
          },
        },
        excludedUserIds.length > 0
          ? {
              userId: {
                notIn: excludedUserIds,
              },
            }
          : {},
      ],
    },
    include: {
      user: {
        select: { id: true, nickname: true, avatarUrl: true },
      },
      media: {
        orderBy: { sortOrder: 'asc' },
      },
      genres: {
        include: { genre: true },
      },
      _count: {
        select: { likes: true, comments: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1,
    }),
  })

  // ------------------------------------------------------------
  // いいね/ブックマーク状態の取得
  // ------------------------------------------------------------

  let likedPostIds: Set<string> = new Set()
  let bookmarkedPostIds: Set<string> = new Set()

  if (currentUserId && posts.length > 0) {
    const postIds = posts.map((p: typeof posts[number]) => p.id)

    const [userLikes, userBookmarks] = await Promise.all([
      prisma.like.findMany({
        where: {
          userId: currentUserId,
          postId: { in: postIds },
          commentId: null,
        },
        select: { postId: true },
      }),
      prisma.bookmark.findMany({
        where: {
          userId: currentUserId,
          postId: { in: postIds },
        },
        select: { postId: true },
      }),
    ])

    likedPostIds = new Set(userLikes.map((l: { postId: string | null }) => l.postId).filter((id: string | null): id is string => id !== null))
    bookmarkedPostIds = new Set(userBookmarks.map((b: { postId: string }) => b.postId))
  }

  // ------------------------------------------------------------
  // 結果の整形と返却
  // ------------------------------------------------------------

  return {
    posts: posts.map((post: typeof posts[number]) => ({
      ...post,
      likeCount: post._count.likes,
      commentCount: post._count.comments,
      genres: post.genres.map((pg: typeof post.genres[number]) => pg.genre),
      isLiked: likedPostIds.has(post.id),
      isBookmarked: bookmarkedPostIds.has(post.id),
    })),
    nextCursor: posts.length === limit ? posts[posts.length - 1]?.id : undefined,
  }
}

// ============================================================
// 人気タグ取得
// ============================================================

/**
 * 人気のハッシュタグを取得
 *
 * ## 機能概要
 * 投稿で多く使われているハッシュタグを取得します。
 *
 * ## キャッシュ
 * getCachedPopularTags() を使用してキャッシュされた結果を返す
 *
 * @param limit - 取得件数（デフォルト: 10）
 * @returns 人気タグ一覧
 *
 * @example
 * ```typescript
 * const popularTags = await getPopularTags(5)
 * // [{ tag: '盆栽', count: 150 }, { tag: '松', count: 120 }, ...]
 * ```
 */
export async function getPopularTags(limit = 10) {
  /**
   * キャッシュされた人気タグを取得
   */
  return getCachedPopularTags(limit)
}

// ============================================================
// ジャンル一覧取得
// ============================================================

/**
 * 全てのジャンルを取得
 *
 * ## 機能概要
 * 投稿に設定可能なジャンルの一覧を取得します。
 *
 * ## キャッシュ
 * getCachedGenres() を使用してキャッシュされた結果を返す
 *
 * ## 用途
 * - 投稿時のジャンル選択
 * - 検索時のジャンルフィルタ
 *
 * @returns ジャンル一覧
 *
 * @example
 * ```typescript
 * const { genres } = await getAllGenres()
 * // [{ id: '...', name: '松柏類', slug: 'shouhaku' }, ...]
 * ```
 */
export async function getAllGenres() {
  /**
   * キャッシュされたジャンル一覧を取得
   */
  const result = await getCachedGenres()
  return { genres: result.genres }
}
