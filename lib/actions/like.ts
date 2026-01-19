/**
 * いいね機能のServer Actions
 *
 * このファイルは、投稿やコメントへの「いいね」機能に関する
 * サーバーサイドの処理を提供します。
 *
 * ## 機能概要
 * - 投稿へのいいね（トグル）
 * - コメントへのいいね（トグル）
 * - いいね状態の取得
 * - いいねした投稿一覧の取得
 *
 * ## いいねの特徴
 * - トグル方式：同じ操作で「いいね」と「いいね解除」を切り替え
 * - 通知連携：いいね時に投稿者/コメント者に通知を送信
 * - 分析連携：いいね受信数を分析データとして記録
 *
 * ## データ構造
 * Likeテーブルは投稿といいねの両方に対応：
 * - postId: 投稿へのいいね
 * - commentId: コメントへのいいね
 * （片方がnull、片方にIDが入る設計）
 *
 * @module lib/actions/like
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
 * Next.jsのキャッシュ再検証関数
 * いいね後にページを更新するために使用
 */
import { revalidatePath } from 'next/cache'

/**
 * いいね受信記録関数
 * 分析データとしていいね数を記録
 */
import { recordLikeReceived } from './analytics'

/**
 * ロガー
 * エラーログの記録に使用
 */
import logger from '@/lib/logger'

/**
 * レート制限
 * スパム防止、クラウド課金対策
 */
import { checkUserRateLimit } from '@/lib/rate-limit'

// ============================================================
// 投稿いいねトグル
// ============================================================

/**
 * 投稿へのいいねをトグル（追加/解除）
 *
 * ## 機能概要
 * 投稿に対する「いいね」の状態を切り替えます。
 * - いいね済み → いいね解除
 * - 未いいね → いいね追加
 *
 * ## 処理フロー
 * 1. 認証チェック
 * 2. 現在のいいね状態を確認
 * 3. 状態に応じて追加または削除
 * 4. いいね追加時は通知を作成
 * 5. 分析データを記録
 * 6. キャッシュを再検証
 *
 * ## 通知
 * いいね追加時に投稿者へ 'like' タイプの通知を送信
 * ただし、自分の投稿への自分自身のいいねは通知しない
 *
 * ## 分析
 * recordLikeReceived() でいいね受信数を記録
 * バッジ付与などの判定に使用
 *
 * @param postId - いいね対象の投稿ID
 * @returns 成功時は { success: true, liked: boolean }、失敗時は { error: string }
 *
 * @example
 * ```typescript
 * // いいねボタンのクリックハンドラ
 * const handleLike = async () => {
 *   const result = await togglePostLike(postId)
 *   if (result.success) {
 *     setIsLiked(result.liked)
 *   }
 * }
 * ```
 */
export async function togglePostLike(postId: string) {
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

  try {
    // ------------------------------------------------------------
    // 現在のいいね状態を確認
    // ------------------------------------------------------------

    /**
     * 既存のいいねを検索
     *
     * findFirst を使用する理由：
     * - postId + userId の組み合わせでユニークだが、
     *   commentId: null を明示的に指定して
     *   「投稿へのいいね」と「コメントへのいいね」を区別
     */
    const existingLike = await prisma.like.findFirst({
      where: {
        postId,
        userId: session.user.id,
        commentId: null, // 投稿へのいいねを明示
      },
    })

    if (existingLike) {
      // ------------------------------------------------------------
      // いいね解除
      // ------------------------------------------------------------

      /**
       * 既存のいいねを削除
       * IDで特定して削除
       */
      await prisma.like.delete({
        where: { id: existingLike.id },
      })

      /**
       * 関連ページのキャッシュを再検証
       * フィードと投稿詳細ページの両方を更新
       */
      revalidatePath('/feed')
      revalidatePath(`/posts/${postId}`)

      return { success: true, liked: false }
    } else {
      // ------------------------------------------------------------
      // いいね追加
      // ------------------------------------------------------------

      /**
       * 新しいいいねを作成
       */
      await prisma.like.create({
        data: {
          postId,
          userId: session.user.id,
        },
      })

      // ------------------------------------------------------------
      // 通知作成
      // ------------------------------------------------------------

      /**
       * 投稿者情報を取得
       * 通知の送信先を特定するため
       */
      const post = await prisma.post.findUnique({
        where: { id: postId },
        select: { userId: true },
      })

      /**
       * 投稿者への通知を作成
       *
       * 条件：
       * - 投稿が存在する（post !== null）
       * - 自分の投稿ではない（post.userId !== session.user.id）
       */
      if (post && post.userId !== session.user.id) {
        await prisma.notification.create({
          data: {
            userId: post.userId,      // 通知を受け取る人（投稿者）
            actorId: session.user.id, // 通知のトリガー（いいねした人）
            type: 'like',             // 通知タイプ
            postId,                   // 関連する投稿
          },
        })

        // ------------------------------------------------------------
        // 分析データ記録
        // ------------------------------------------------------------

        /**
         * いいね受信を記録
         *
         * catch(() => {}) で非同期処理のエラーを無視
         * 分析記録の失敗でいいね処理全体を失敗させないため
         */
        recordLikeReceived(post.userId).catch(() => {})
      }

      // ------------------------------------------------------------
      // キャッシュ再検証と結果返却
      // ------------------------------------------------------------

      revalidatePath('/feed')
      revalidatePath(`/posts/${postId}`)

      return { success: true, liked: true }
    }
  } catch (error) {
    logger.error('Toggle post like error:', error)
    return { error: 'いいねの処理に失敗しました' }
  }
}

// ============================================================
// コメントいいねトグル
// ============================================================

/**
 * コメントへのいいねをトグル（追加/解除）
 *
 * ## 機能概要
 * コメントに対する「いいね」の状態を切り替えます。
 *
 * ## togglePostLike との違い
 * - commentId を使用（postId ではなく）
 * - 通知タイプが 'comment_like'
 * - 分析記録は行わない（投稿へのいいねのみ記録）
 *
 * ## パラメータ
 * @param commentId - いいね対象のコメントID
 * @param postId - コメントが属する投稿ID（キャッシュ再検証用）
 *
 * @returns 成功時は { success: true, liked: boolean }、失敗時は { error: string }
 *
 * @example
 * ```typescript
 * // コメントのいいねボタン
 * const handleCommentLike = async () => {
 *   const result = await toggleCommentLike(commentId, postId)
 *   if (result.success) {
 *     setIsLiked(result.liked)
 *   }
 * }
 * ```
 */
export async function toggleCommentLike(commentId: string, postId: string) {
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

  try {
    // ------------------------------------------------------------
    // 現在のいいね状態を確認
    // ------------------------------------------------------------

    /**
     * 既存のコメントいいねを検索
     * commentId + userId の組み合わせで検索
     */
    const existingLike = await prisma.like.findFirst({
      where: {
        commentId,
        userId: session.user.id,
      },
    })

    if (existingLike) {
      // ------------------------------------------------------------
      // いいね解除
      // ------------------------------------------------------------

      await prisma.like.delete({
        where: { id: existingLike.id },
      })

      /**
       * 投稿詳細ページのキャッシュを再検証
       * コメントは投稿詳細ページで表示されるため
       */
      revalidatePath(`/posts/${postId}`)

      return { success: true, liked: false }
    } else {
      // ------------------------------------------------------------
      // いいね追加
      // ------------------------------------------------------------

      await prisma.like.create({
        data: {
          commentId,
          userId: session.user.id,
        },
      })

      // ------------------------------------------------------------
      // 通知作成
      // ------------------------------------------------------------

      /**
       * コメント投稿者情報を取得
       */
      const comment = await prisma.comment.findUnique({
        where: { id: commentId },
        select: { userId: true },
      })

      /**
       * コメント投稿者への通知を作成
       *
       * 通知タイプ: 'comment_like'
       * 投稿へのいいね（'like'）と区別
       */
      if (comment && comment.userId !== session.user.id) {
        await prisma.notification.create({
          data: {
            userId: comment.userId,
            actorId: session.user.id,
            type: 'comment_like', // コメントへのいいね
            postId,               // 元の投稿（通知からの遷移先）
            commentId,            // 対象コメント
          },
        })
      }

      // ------------------------------------------------------------
      // キャッシュ再検証と結果返却
      // ------------------------------------------------------------

      revalidatePath(`/posts/${postId}`)

      return { success: true, liked: true }
    }
  } catch (error) {
    logger.error('Toggle comment like error:', error)
    return { error: 'いいねの処理に失敗しました' }
  }
}

// ============================================================
// いいね状態取得
// ============================================================

/**
 * 投稿のいいね状態を取得
 *
 * ## 機能概要
 * 現在のユーザーが指定された投稿をいいねしているかどうかを返します。
 *
 * ## 用途
 * - 投稿カードの初期表示時にいいね状態を判定
 * - いいねボタンの見た目（塗りつぶし/アウトライン）を決定
 *
 * ## 未ログイン時
 * セッションがない場合は常に { liked: false } を返す
 *
 * @param postId - 確認対象の投稿ID
 * @returns { liked: boolean }
 *
 * @example
 * ```typescript
 * // 投稿カードコンポーネント
 * const PostCard = async ({ post }) => {
 *   const { liked } = await getPostLikeStatus(post.id)
 *   return (
 *     <div>
 *       <LikeButton postId={post.id} initialLiked={liked} />
 *     </div>
 *   )
 * }
 * ```
 */
export async function getPostLikeStatus(postId: string) {
  const session = await auth()

  /**
   * 未ログイン時は常に false を返す
   */
  if (!session?.user?.id) {
    return { liked: false }
  }

  try {
    /**
     * いいねの存在を確認
     *
     * findFirst + !!existingLike で boolean に変換
     */
    const existingLike = await prisma.like.findFirst({
      where: {
        postId,
        userId: session.user.id,
        commentId: null, // 投稿へのいいねを明示
      },
    })

    return { liked: !!existingLike }
  } catch (error) {
    logger.error('Get post like status error:', error)
    return { liked: false }
  }
}

// ============================================================
// いいねした投稿一覧
// ============================================================

/**
 * ユーザーがいいねした投稿一覧を取得
 *
 * ## 機能概要
 * 指定されたユーザーがいいねした投稿を新しい順で取得します。
 *
 * ## 用途
 * - ユーザープロフィールの「いいね」タブ
 * - いいねした投稿の一覧表示
 *
 * ## 取得内容
 * - いいねした投稿の情報
 * - 投稿者情報（ID、ニックネーム、アバター）
 * - メディア、ジャンル
 * - いいね数、コメント数
 * - 現在のユーザーのいいね/ブックマーク状態
 *
 * ## ページネーション
 * カーソルベースのページネーションを採用
 * カーソルは Like テーブルの ID
 *
 * @param userId - 対象ユーザーのID
 * @param cursor - ページネーション用カーソル
 * @param limit - 取得件数（デフォルト: 20）
 * @returns いいねした投稿一覧と次のカーソル
 *
 * @example
 * ```typescript
 * // プロフィールページの「いいね」タブ
 * const { posts, nextCursor } = await getLikedPosts(userId)
 *
 * // 無限スクロールで追加読み込み
 * const morePosts = await getLikedPosts(userId, nextCursor)
 * ```
 */
export async function getLikedPosts(userId: string, cursor?: string, limit = 20) {
  const session = await auth()
  const currentUserId = session?.user?.id

  try {
    // ------------------------------------------------------------
    // いいね一覧を取得
    // ------------------------------------------------------------

    /**
     * ユーザーがいいねしたレコードを取得
     *
     * ## フィルタ条件
     * - userId: 指定されたユーザーのいいね
     * - postId: { not: null } - 投稿へのいいね
     * - commentId: null - コメントへのいいねは除外
     *
     * ## include
     * post を include して、いいねと投稿を結合
     */
    const likes = await prisma.like.findMany({
      where: {
        userId,
        postId: { not: null },
        commentId: null,
      },
      include: {
        /**
         * いいねした投稿の詳細
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
       * いいねした日時の新しい順
       */
      orderBy: { createdAt: 'desc' },
      take: limit,
      /**
       * カーソルベースページネーション
       * Like テーブルの ID をカーソルとして使用
       */
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
    })

    // ------------------------------------------------------------
    // 有効ないいねをフィルタリング
    // ------------------------------------------------------------

    /**
     * 型定義
     * likes 配列の要素の型を取得
     */
    type LikeType = typeof likes[number]

    /**
     * post が null でない Like の型
     */
    type ValidLikeType = LikeType & { post: NonNullable<LikeType['post']> }

    /**
     * 有効ないいねをフィルタ
     *
     * post が削除されている場合があるため、
     * post が存在するいいねのみを抽出
     */
    const validLikes = likes.filter((like: LikeType): like is ValidLikeType => Boolean(like.post))

    /**
     * 投稿IDのリストを抽出
     * 現在のユーザーのいいね/ブックマーク状態確認用
     */
    const postIds = validLikes.map((like: ValidLikeType) => like.post.id)

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

    if (currentUserId && postIds.length > 0) {
      /**
       * Promise.all で並列取得
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
            commentId: null,
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
     * Like オブジェクトから post を取り出し、
     * 追加情報を付与
     */
    const posts = validLikes.map((like: ValidLikeType) => ({
      ...like.post,
      likeCount: like.post._count.likes,
      commentCount: like.post._count.comments,
      /**
       * ジャンルを展開
       * PostGenre の中から Genre オブジェクトを取り出す
       */
      genres: like.post.genres.map((pg: typeof like.post.genres[number]) => pg.genre),
      isLiked: likedPostIds.has(like.post.id),
      isBookmarked: bookmarkedPostIds.has(like.post.id),
    }))

    const hasMore = likes.length === limit

    return {
      posts,
      /**
       * 次のカーソル
       * Like テーブルの ID を使用（投稿ID ではない）
       */
      nextCursor: hasMore ? likes[likes.length - 1]?.id : undefined,
    }
  } catch (error) {
    logger.error('Get liked posts error:', error)
    return { posts: [], nextCursor: undefined }
  }
}
