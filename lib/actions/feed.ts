/**
 * フィード関連のServer Actions
 *
 * このファイルは、タイムライン（フィード）表示に関する
 * サーバーサイドの処理を提供します。
 *
 * ## 機能概要
 * - タイムライン取得（フォロー中のユーザーの投稿）
 * - おすすめユーザーの取得
 * - トレンドジャンルの取得
 *
 * ## タイムラインのロジック
 * 1. フォロー中のユーザーの投稿を取得
 * 2. 自分自身の投稿も含める
 * 3. ブロック・ミュートしているユーザーの投稿を除外
 * 4. 新しい投稿から順に表示
 *
 * ## パフォーマンス最適化
 * - Promise.all による並列クエリ
 * - カーソルベースページネーション
 * - キャッシュの活用（トレンドジャンル）
 *
 * @module lib/actions/feed
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
 * 除外ユーザーID取得関数
 * ブロック・ミュートしているユーザーを除外するために使用
 */
import { getExcludedUserIds } from './filter-helper'

/**
 * トレンドジャンルキャッシュ取得関数
 * キャッシュされたトレンドジャンルを取得
 */
import { getCachedTrendingGenres } from '@/lib/cache'

// ============================================================
// タイムライン取得
// ============================================================

/**
 * タイムライン（フィード）を取得
 *
 * ## 機能概要
 * フォロー中のユーザーと自分自身の投稿を
 * 新しい順で取得します。
 *
 * ## 表示対象
 * - フォロー中のユーザーの投稿
 * - 自分自身の投稿
 *
 * ## 除外対象
 * - ブロックしているユーザーの投稿
 * - ミュートしているユーザーの投稿
 *
 * ## 取得内容
 * - 投稿情報（ID、内容、作成日時など）
 * - 投稿者情報（ID、ニックネーム、アバター）
 * - メディア（画像・動画）
 * - ジャンル
 * - 引用投稿・リポストの情報
 * - いいね数・コメント数
 * - 現在のユーザーのいいね/ブックマーク状態
 *
 * ## ページネーション
 * カーソルベースのページネーションを採用
 *
 * @param cursor - ページネーション用カーソル
 * @param limit - 取得件数（デフォルト: 20）
 * @returns タイムライン投稿一覧と次のカーソル
 *
 * @example
 * ```typescript
 * // フィードページ
 * const { posts, nextCursor } = await getTimeline()
 *
 * // 無限スクロールで追加読み込み
 * const more = await getTimeline(nextCursor)
 * ```
 */
export async function getTimeline(cursor?: string, limit = 20) {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です', posts: [], nextCursor: undefined }
  }

  const currentUserId = session.user.id

  // ------------------------------------------------------------
  // フォロー情報と除外ユーザーを並列取得
  // ------------------------------------------------------------

  /**
   * Promise.all で並列クエリ
   *
   * N+1問題を避け、パフォーマンスを向上させるため、
   * フォロー情報と除外ユーザー情報を同時に取得
   */
  const [following, excludeIds] = await Promise.all([
    /**
     * フォロー中のユーザーID一覧を取得
     */
    prisma.follow.findMany({
      where: { followerId: currentUserId },
      select: { followingId: true },
    }),
    /**
     * 除外対象のユーザーIDを取得
     *
     * getExcludedUserIds の第2引数で、
     * ブロック・ミュートのどちらを含めるか指定
     */
    getExcludedUserIds(currentUserId, { blocked: true, muted: true }),
  ])

  /**
   * フォロー中のユーザーID配列を作成
   */
  const followingIds = following.map((f: typeof following[number]) => f.followingId)

  /**
   * 自分の投稿もタイムラインに含める
   */
  followingIds.push(currentUserId)

  // ------------------------------------------------------------
  // タイムライン取得
  // ------------------------------------------------------------

  /**
   * 投稿を取得
   *
   * ## フィルタ条件
   * - userId in followingIds: フォロー中 + 自分
   * - userId notIn excludeIds: ブロック・ミュートを除外
   *
   * ## notIn の条件付き適用
   * excludeIds.length > 0 の場合のみ notIn を適用
   * 空配列だと全て除外されてしまうため
   */
  const posts = await prisma.post.findMany({
    where: {
      userId: {
        in: followingIds,
        notIn: excludeIds.length > 0 ? excludeIds : undefined,
      },
    },
    include: {
      /**
       * 投稿者情報
       */
      user: {
        select: { id: true, nickname: true, avatarUrl: true },
      },
      /**
       * 添付メディア（画像・動画）
       * sortOrder で並び順を維持
       */
      media: {
        orderBy: { sortOrder: 'asc' },
      },
      /**
       * ジャンル情報
       * PostGenre と Genre を結合
       */
      genres: {
        include: { genre: true },
      },
      /**
       * いいね数・コメント数
       */
      _count: {
        select: { likes: true, comments: true },
      },
      /**
       * 引用投稿の元投稿
       *
       * 引用投稿（quotePostId が設定されている）の場合、
       * 元の投稿情報を取得
       */
      quotePost: {
        include: {
          user: {
            select: { id: true, nickname: true, avatarUrl: true },
          },
          media: {
            orderBy: { sortOrder: 'asc' },
          },
        },
      },
      /**
       * リポストの元投稿
       *
       * リポスト（repostPostId が設定されている）の場合、
       * 元の投稿情報を取得
       */
      repostPost: {
        include: {
          user: {
            select: { id: true, nickname: true, avatarUrl: true },
          },
          media: {
            orderBy: { sortOrder: 'asc' },
          },
        },
      },
    },
    /**
     * 新しい投稿から順に表示
     */
    orderBy: { createdAt: 'desc' },
    take: limit,
    /**
     * カーソルベースページネーション
     */
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1,
    }),
  })

  // ------------------------------------------------------------
  // 現在のユーザーのいいね/ブックマーク状態を取得
  // ------------------------------------------------------------

  /**
   * いいね済み投稿IDのセット
   */
  let likedPostIds: Set<string> = new Set()

  /**
   * ブックマーク済み投稿IDのセット
   */
  let bookmarkedPostIds: Set<string> = new Set()

  if (posts.length > 0) {
    /**
     * 取得した投稿のIDリスト
     */
    const postIds = posts.map((p: typeof posts[number]) => p.id)

    /**
     * いいねとブックマークを並列取得
     * N+1問題を回避
     */
    const [userLikes, userBookmarks] = await Promise.all([
      /**
       * 現在のユーザーのいいね
       */
      prisma.like.findMany({
        where: {
          userId: currentUserId,
          postId: { in: postIds },
          commentId: null, // 投稿へのいいねのみ
        },
        select: { postId: true },
      }),
      /**
       * 現在のユーザーのブックマーク
       */
      prisma.bookmark.findMany({
        where: {
          userId: currentUserId,
          postId: { in: postIds },
        },
        select: { postId: true },
      }),
    ])

    /**
     * Set に変換して O(1) でアクセス可能に
     */
    likedPostIds = new Set(userLikes.map((l: { postId: string | null }) => l.postId).filter((id: string | null): id is string => id !== null))
    bookmarkedPostIds = new Set(userBookmarks.map((b: { postId: string }) => b.postId))
  }

  // ------------------------------------------------------------
  // 結果の整形と返却
  // ------------------------------------------------------------

  /**
   * 投稿配列を整形
   *
   * _count を展開し、いいね/ブックマーク状態を追加
   */
  const formattedPosts = posts.map((post: typeof posts[number]) => ({
    ...post,
    likeCount: post._count.likes,
    commentCount: post._count.comments,
    /**
     * ジャンルを展開
     * PostGenre の中から Genre オブジェクトを取り出す
     */
    genres: post.genres.map((pg: typeof post.genres[number]) => pg.genre),
    isLiked: likedPostIds.has(post.id),
    isBookmarked: bookmarkedPostIds.has(post.id),
  }))

  return {
    posts: formattedPosts,
    /**
     * 次のカーソル
     */
    nextCursor: posts.length === limit ? posts[posts.length - 1]?.id : undefined,
  }
}

// ============================================================
// おすすめユーザー取得
// ============================================================

/**
 * おすすめユーザーを取得
 *
 * ## 機能概要
 * まだフォローしていないユーザーの中から、
 * フォロワー数の多い順におすすめユーザーを取得します。
 *
 * ## 除外対象
 * - 既にフォロー中のユーザー
 * - 自分自身
 * - ブロック関係にあるユーザー（双方向）
 * - 非公開アカウント
 *
 * ## ランキングロジック
 * フォロワー数の多いユーザーを優先的に表示
 * これにより、アクティブで影響力のあるユーザーが上位に
 *
 * @param limit - 取得件数（デフォルト: 5）
 * @returns おすすめユーザー一覧
 *
 * @example
 * ```typescript
 * // サイドバーの「おすすめユーザー」セクション
 * const { users } = await getRecommendedUsers(5)
 *
 * return (
 *   <div>
 *     <h3>おすすめユーザー</h3>
 *     {users.map(user => (
 *       <UserCard key={user.id} user={user} />
 *     ))}
 *   </div>
 * )
 * ```
 */
export async function getRecommendedUsers(limit = 5) {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------
  const session = await auth()
  if (!session?.user?.id) {
    return { users: [] }
  }

  const currentUserId = session.user.id

  // ------------------------------------------------------------
  // 除外ユーザーを取得
  // ------------------------------------------------------------

  /**
   * 既にフォロー中のユーザーとブロック関係のユーザーを並列取得
   */
  const [following, blockedIds] = await Promise.all([
    /**
     * フォロー中のユーザーID
     */
    prisma.follow.findMany({
      where: { followerId: currentUserId },
      select: { followingId: true },
    }),
    /**
     * ブロック関係のユーザーID（双方向）
     *
     * blocked: true → 自分がブロックしたユーザー
     * blockedBy: true → 自分をブロックしたユーザー
     */
    getExcludedUserIds(currentUserId, { blocked: true, blockedBy: true }),
  ])

  /**
   * フォロー中のユーザーID配列
   */
  const followingIds = following.map((f: typeof following[number]) => f.followingId)

  /**
   * 自分自身も除外リストに追加
   */
  followingIds.push(currentUserId)

  // ------------------------------------------------------------
  // おすすめユーザーを取得
  // ------------------------------------------------------------

  /**
   * ユーザーを取得
   *
   * ## フィルタ条件
   * - id notIn: フォロー中 + 自分 + ブロック関係を除外
   * - isPublic: true: 公開アカウントのみ
   *
   * ## 並び順
   * フォロワー数の多い順
   */
  const users = await prisma.user.findMany({
    where: {
      id: {
        notIn: [...followingIds, ...blockedIds],
      },
      isPublic: true, // 公開アカウントのみ
    },
    select: {
      id: true,
      nickname: true,
      avatarUrl: true,
      bio: true,
      /**
       * フォロワー数
       */
      _count: {
        select: { followers: true },
      },
    },
    /**
     * フォロワー数の多い順
     */
    orderBy: {
      followers: { _count: 'desc' },
    },
    take: limit,
  })

  // ------------------------------------------------------------
  // 結果の整形と返却
  // ------------------------------------------------------------

  return {
    /**
     * _count.followers を followersCount に展開
     */
    users: users.map((user: typeof users[number]) => ({
      ...user,
      followersCount: user._count.followers,
    })),
  }
}

// ============================================================
// トレンドジャンル取得
// ============================================================

/**
 * トレンドジャンルを取得
 *
 * ## 機能概要
 * 現在人気のあるジャンルを取得します。
 *
 * ## キャッシュ
 * getCachedTrendingGenres() を使用してキャッシュされた結果を返す
 *
 * キャッシュを使用する理由：
 * - トレンド計算は複雑なクエリが必要
 * - 頻繁に変わるものではない
 * - 同じ結果を全ユーザーに表示できる
 *
 * ## キャッシュの更新
 * lib/cache.ts の getCachedTrendingGenres() で設定された
 * 有効期限（revalidate）に従って自動更新
 *
 * @param limit - 取得件数（デフォルト: 5）
 * @returns トレンドジャンル一覧
 *
 * @example
 * ```typescript
 * // サイドバーの「トレンド」セクション
 * const trendingGenres = await getTrendingGenres(5)
 *
 * return (
 *   <div>
 *     <h3>トレンド</h3>
 *     {trendingGenres.map(genre => (
 *       <GenreTag key={genre.id} genre={genre} />
 *     ))}
 *   </div>
 * )
 * ```
 */
export async function getTrendingGenres(limit = 5) {
  /**
   * キャッシュされたトレンドジャンルを取得
   *
   * lib/cache.ts で定義された getCachedTrendingGenres() を使用
   * unstable_cache でキャッシュされており、
   * 設定された時間（例: 1時間）ごとに自動更新
   */
  return getCachedTrendingGenres(limit)
}
