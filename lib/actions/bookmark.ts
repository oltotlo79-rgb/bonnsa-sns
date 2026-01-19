/**
 * ブックマーク機能のServer Actions
 *
 * このファイルは、投稿のブックマーク（保存）機能に関する
 * サーバーサイドの処理を提供します。
 *
 * ## 機能概要
 * - ブックマークの追加・解除（トグル）
 * - ブックマーク状態の取得
 * - ブックマーク一覧の取得
 *
 * ## ブックマークとは
 * 気に入った投稿を「保存」して後から見返せる機能です。
 * いいねと異なり、他のユーザーには見えません。
 *
 * ## いいねとの違い
 * - いいね: 投稿者に通知される、いいね数として公開される
 * - ブックマーク: 非公開、自分だけが見られる
 *
 * @module lib/actions/bookmark
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
 * レート制限
 * スパム防止、クラウド課金対策
 */
import { checkUserRateLimit } from '@/lib/rate-limit'

// ============================================================
// ブックマークトグル
// ============================================================

/**
 * ブックマークをトグル（追加/解除）
 *
 * ## 機能概要
 * 投稿のブックマーク状態を切り替えます。
 * - ブックマーク済み → 解除
 * - 未ブックマーク → 追加
 *
 * ## いいねとの違い
 * - 通知を送らない（非公開機能のため）
 * - revalidatePath を呼ばない（ブックマークはサイドバーやボタン状態のみ）
 *
 * @param postId - ブックマーク対象の投稿ID
 * @returns 成功時は { success: true, bookmarked: boolean }、失敗時は { error: string }
 *
 * @example
 * ```typescript
 * // ブックマークボタンのクリックハンドラ
 * const handleBookmark = async () => {
 *   const result = await toggleBookmark(postId)
 *   if (result.success) {
 *     setIsBookmarked(result.bookmarked)
 *   }
 * }
 * ```
 */
export async function toggleBookmark(postId: string) {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // ------------------------------------------------------------
  // レート制限チェック
  // ------------------------------------------------------------
  const rateLimitResult = await checkUserRateLimit(session.user.id, 'engagement')
  if (!rateLimitResult.success) {
    return { error: '操作が多すぎます。しばらく待ってから再試行してください' }
  }

  // ------------------------------------------------------------
  // 現在のブックマーク状態を確認
  // ------------------------------------------------------------

  /**
   * 既存のブックマークを検索
   *
   * findFirst を使用して、postId + userId の組み合わせで検索
   */
  const existingBookmark = await prisma.bookmark.findFirst({
    where: {
      postId,
      userId: session.user.id,
    },
  })

  if (existingBookmark) {
    // ------------------------------------------------------------
    // ブックマーク解除
    // ------------------------------------------------------------

    /**
     * 既存のブックマークを削除
     */
    await prisma.bookmark.delete({
      where: { id: existingBookmark.id },
    })

    return { success: true, bookmarked: false }
  } else {
    // ------------------------------------------------------------
    // ブックマーク追加
    // ------------------------------------------------------------

    /**
     * 新しいブックマークを作成
     *
     * 通知は送らない（ブックマークは非公開機能）
     */
    await prisma.bookmark.create({
      data: {
        postId,
        userId: session.user.id,
      },
    })

    return { success: true, bookmarked: true }
  }
}

// ============================================================
// ブックマーク状態取得
// ============================================================

/**
 * 投稿のブックマーク状態を取得
 *
 * ## 機能概要
 * 現在のユーザーが指定された投稿をブックマークしているかどうかを返します。
 *
 * ## 用途
 * - 投稿カードの初期表示時にブックマーク状態を判定
 * - ブックマークボタンの見た目を決定
 *
 * ## 未ログイン時
 * セッションがない場合は常に { bookmarked: false } を返す
 *
 * @param postId - 確認対象の投稿ID
 * @returns { bookmarked: boolean }
 *
 * @example
 * ```typescript
 * const { bookmarked } = await getBookmarkStatus(postId)
 * ```
 */
export async function getBookmarkStatus(postId: string) {
  const session = await auth()

  /**
   * 未ログイン時は常に false を返す
   */
  if (!session?.user?.id) {
    return { bookmarked: false }
  }

  /**
   * ブックマークの存在を確認
   */
  const existingBookmark = await prisma.bookmark.findFirst({
    where: {
      postId,
      userId: session.user.id,
    },
  })

  return { bookmarked: !!existingBookmark }
}

// ============================================================
// ブックマーク一覧取得
// ============================================================

/**
 * ブックマークした投稿一覧を取得
 *
 * ## 機能概要
 * 現在のユーザーがブックマークした投稿を新しい順で取得します。
 *
 * ## 用途
 * - ブックマークページ
 * - 保存した投稿の一覧表示
 *
 * ## 取得内容
 * - ブックマークした投稿の情報
 * - 投稿者情報（ID、ニックネーム、アバター）
 * - メディア、ジャンル
 * - いいね数、コメント数
 * - 現在のユーザーのいいね状態
 * - isBookmarked は常に true（ブックマーク一覧なので）
 *
 * ## ページネーション
 * カーソルベースのページネーションを採用
 * カーソルは Bookmark テーブルの ID
 *
 * @param cursor - ページネーション用カーソル
 * @param limit - 取得件数（デフォルト: 20）
 * @returns ブックマークした投稿一覧と次のカーソル
 *
 * @example
 * ```typescript
 * // ブックマークページ
 * const { posts, nextCursor } = await getBookmarkedPosts()
 *
 * // 無限スクロールで追加読み込み
 * const morePosts = await getBookmarkedPosts(nextCursor)
 * ```
 */
export async function getBookmarkedPosts(cursor?: string, limit = 20) {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です', posts: [] }
  }

  const currentUserId = session.user.id

  // ------------------------------------------------------------
  // ブックマーク一覧を取得
  // ------------------------------------------------------------

  /**
   * ブックマークを取得
   *
   * post を include して、ブックマークと投稿を結合
   */
  const bookmarks = await prisma.bookmark.findMany({
    where: { userId: currentUserId },
    include: {
      /**
       * ブックマークした投稿の詳細
       */
      post: {
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
      },
    },
    /**
     * ブックマークした日時の新しい順
     */
    orderBy: { createdAt: 'desc' },
    take: limit,
    /**
     * カーソルベースページネーション
     * Bookmark テーブルの ID をカーソルとして使用
     */
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1,
    }),
  })

  // ------------------------------------------------------------
  // 有効なブックマークをフィルタリング
  // ------------------------------------------------------------

  /**
   * 型定義
   */
  type BookmarkType = typeof bookmarks[number]
  type ValidBookmarkType = BookmarkType & { post: NonNullable<BookmarkType['post']> }

  /**
   * post が存在するブックマークのみを抽出
   *
   * 投稿が削除されている場合があるため
   */
  const validBookmarks = bookmarks.filter((bookmark: BookmarkType): bookmark is ValidBookmarkType => Boolean(bookmark.post))
  const postIds = validBookmarks.map((b: ValidBookmarkType) => b.post.id)

  // ------------------------------------------------------------
  // いいね状態の取得
  // ------------------------------------------------------------

  /**
   * 現在のユーザーがいいねしている投稿IDのセット
   */
  let likedPostIds: Set<string> = new Set()

  if (postIds.length > 0) {
    const userLikes = await prisma.like.findMany({
      where: {
        userId: currentUserId,
        postId: { in: postIds },
        commentId: null,
      },
      select: { postId: true },
    })
    likedPostIds = new Set(userLikes.map((l: { postId: string | null }) => l.postId).filter((id: string | null): id is string => id !== null))
  }

  // ------------------------------------------------------------
  // 結果の整形と返却
  // ------------------------------------------------------------

  /**
   * 投稿配列を整形
   *
   * isBookmarked は常に true（ブックマーク一覧なので）
   */
  const posts = validBookmarks.map((bookmark: ValidBookmarkType) => ({
    ...bookmark.post,
    likeCount: bookmark.post._count.likes,
    commentCount: bookmark.post._count.comments,
    genres: bookmark.post.genres.map((pg: typeof bookmark.post.genres[number]) => pg.genre),
    isLiked: likedPostIds.has(bookmark.post.id),
    isBookmarked: true, // ブックマーク一覧なので必ずtrue
  }))

  const hasMore = bookmarks.length === limit

  return {
    posts,
    /**
     * 次のカーソル
     * Bookmark テーブルの ID を使用
     */
    nextCursor: hasMore ? bookmarks[bookmarks.length - 1]?.id : undefined,
  }
}
