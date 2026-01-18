/**
 * コメント関連のServer Actions
 *
 * このファイルは、投稿へのコメント機能に関する
 * サーバーサイドの処理を提供します。
 *
 * ## 機能概要
 * - コメントの作成・削除
 * - コメント一覧の取得（親コメント・返信）
 * - コメント数の取得
 * - コメント用メディアのアップロード
 *
 * ## コメントの階層構造
 * このSNSでは、2階層のコメントをサポートしています：
 * ```
 * 投稿
 * └── 親コメント（parentId: null）
 *     └── 返信コメント（parentId: 親コメントのID）
 * ```
 *
 * ## スパム対策
 * - 1日あたり100件までのコメント制限
 * - 500文字以内の文字数制限
 * - メディア：画像2枚まで、動画1本まで
 *
 * ## セキュリティ
 * - XSS対策：sanitizePostContent でサニタイズ
 * - 認証必須：セッションチェック
 * - 所有者確認：削除時に権限チェック
 *
 * @module lib/actions/comment
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
 * データ更新後にページをリフレッシュするために使用
 */
import { revalidatePath } from 'next/cache'

/**
 * コンテンツサニタイズ関数
 * XSS攻撃を防ぐために、ユーザー入力をエスケープ
 */
import { sanitizePostContent } from '@/lib/sanitize'

/**
 * ロガー
 * エラーログの記録に使用
 */
import logger from '@/lib/logger'

/**
 * ブロック済みユーザーID取得関数
 * ブロックしているユーザーのコメントを除外するために使用
 */
import { getBlockedUserIds } from './filter-helper'

// ============================================================
// コメント作成
// ============================================================

/**
 * 新規コメントを作成
 *
 * ## 機能概要
 * 投稿に対するコメント、または既存コメントへの返信を作成します。
 *
 * ## 処理フロー
 * 1. 認証チェック
 * 2. フォームデータからコメント情報を取得
 * 3. コンテンツのサニタイズ（XSS対策）
 * 4. バリデーション（内容、文字数、メディア数）
 * 5. 1日のコメント数制限チェック（100件/日）
 * 6. コメントをデータベースに保存
 * 7. 適切な通知を作成（親コメント所有者または投稿者へ）
 * 8. キャッシュを再検証
 *
 * ## パラメータ（FormData内）
 * - postId: 投稿ID（必須）
 * - parentId: 親コメントID（返信の場合）
 * - content: コメント内容（500文字以内）
 * - mediaUrls[]: メディアURLの配列
 * - mediaTypes[]: メディアタイプの配列（'image' | 'video'）
 *
 * ## メディア制限
 * - 画像：最大2枚
 * - 動画：最大1本
 * - 画像と動画の混在：OK
 *
 * ## 通知の種類
 * - 返信の場合：親コメント投稿者へ 'reply' 通知
 * - 通常コメントの場合：投稿者へ 'comment' 通知
 *
 * @param formData - フォームデータ
 * @returns 成功時は { success: true, comment }、失敗時は { error: string }
 *
 * @example
 * ```typescript
 * // クライアント側での使用例
 * const formData = new FormData()
 * formData.append('postId', 'post-123')
 * formData.append('content', 'すばらしい盆栽ですね！')
 *
 * const result = await createComment(formData)
 * if (result.error) {
 *   toast.error(result.error)
 * } else {
 *   toast.success('コメントを投稿しました')
 * }
 * ```
 */
export async function createComment(formData: FormData) {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // ------------------------------------------------------------
  // フォームデータの取得とサニタイズ
  // ------------------------------------------------------------

  /**
   * 投稿ID
   * コメント対象の投稿を識別
   */
  const postId = formData.get('postId') as string

  /**
   * 親コメントID
   * 返信の場合は親コメントのIDが設定される
   * 通常のコメントの場合は null
   */
  const parentId = formData.get('parentId') as string | null

  /**
   * コメント内容（サニタイズ前）
   */
  const rawContent = formData.get('content') as string

  /**
   * コメント内容（サニタイズ後）
   * XSS攻撃を防ぐために、HTMLタグをエスケープ
   */
  const content = sanitizePostContent(rawContent)

  /**
   * メディアURL配列
   * FormData.getAll() で同名の複数値を配列として取得
   */
  const mediaUrls = formData.getAll('mediaUrls') as string[]

  /**
   * メディアタイプ配列
   * mediaUrls と同じインデックスで対応
   */
  const mediaTypes = formData.getAll('mediaTypes') as string[]

  // ------------------------------------------------------------
  // バリデーション
  // ------------------------------------------------------------

  /**
   * コンテンツ存在チェック
   * テキストまたはメディアのいずれかが必須
   */
  if ((!content || content.length === 0) && mediaUrls.length === 0) {
    return { error: 'コメント内容またはメディアを入力してください' }
  }

  /**
   * 文字数チェック
   * コメントは投稿より短い500文字以内
   */
  if (content && content.length > 500) {
    return { error: 'コメントは500文字以内で入力してください' }
  }

  /**
   * メディアバリデーション
   *
   * コメントのメディア制限：
   * - 画像：最大2枚（投稿の4枚より少ない）
   * - 動画：最大1本
   * - 画像と動画の混在：OK
   */
  const imageCount = mediaTypes.filter((t: string) => t === 'image').length
  const videoCount = mediaTypes.filter((t: string) => t === 'video').length
  if (imageCount > 2) {
    return { error: '画像は2枚までです' }
  }
  if (videoCount > 1) {
    return { error: '動画は1本までです' }
  }

  try {
    // ------------------------------------------------------------
    // コメント制限チェック（1日100件）
    // ------------------------------------------------------------

    /**
     * 今日の0時0分0秒を取得
     *
     * setHours(0, 0, 0, 0) で時・分・秒・ミリ秒を0にリセット
     * これにより、「今日」の範囲を正確に判定できる
     */
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    /**
     * 今日のコメント数をカウント
     *
     * createdAt: { gte: today } は「today以上」を意味し、
     * 今日の0時以降に作成されたコメントを対象とする
     */
    const count = await prisma.comment.count({
      where: {
        userId: session.user.id,
        createdAt: { gte: today },
      },
    })

    /**
     * コメント上限チェック
     * スパム対策として1日100件まで
     */
    if (count >= 100) {
      return { error: '1日のコメント上限（100件）に達しました' }
    }

    // ------------------------------------------------------------
    // コメント作成
    // ------------------------------------------------------------

    /**
     * コメントをデータベースに保存
     *
     * media: { create: [...] } はPrismaのネスト作成機能
     * コメントと同時にメディアレコードも作成する
     */
    const comment = await prisma.comment.create({
      data: {
        postId,
        userId: session.user.id,
        parentId: parentId || null,
        content: content?.trim() || '',
        /**
         * メディアの条件付き作成
         *
         * mediaUrls.length > 0 の場合のみ media を設定
         * そうでなければ undefined（メディアなし）
         */
        media: mediaUrls.length > 0 ? {
          create: mediaUrls.map((url: string, index: number) => ({
            url,
            type: mediaTypes[index] || 'image',
            sortOrder: index, // 表示順序
          })),
        } : undefined,
      },
    })

    // ------------------------------------------------------------
    // 通知作成
    // ------------------------------------------------------------

    if (parentId) {
      /**
       * 返信の場合：親コメントの投稿者へ通知
       *
       * 親コメントに返信した場合、親コメントの作成者に
       * 「返信がありました」という通知を送る
       */
      const parentComment = await prisma.comment.findUnique({
        where: { id: parentId },
        select: { userId: true },
      })

      /**
       * 自分自身への返信は通知しない
       * parentComment.userId !== session.user.id で判定
       */
      if (parentComment && parentComment.userId !== session.user.id) {
        await prisma.notification.create({
          data: {
            userId: parentComment.userId, // 通知を受け取るユーザー
            actorId: session.user.id,     // 通知のトリガーとなったユーザー
            type: 'reply',                // 通知タイプ
            postId,                       // 関連する投稿
            commentId: comment.id,        // 作成されたコメント
          },
        })
      }
    } else {
      /**
       * 通常コメントの場合：投稿者へ通知
       *
       * 投稿にコメントした場合、投稿の作成者に
       * 「コメントがありました」という通知を送る
       */
      const post = await prisma.post.findUnique({
        where: { id: postId },
        select: { userId: true },
      })

      /**
       * 自分の投稿へのコメントは通知しない
       */
      if (post && post.userId !== session.user.id) {
        await prisma.notification.create({
          data: {
            userId: post.userId,
            actorId: session.user.id,
            type: 'comment',
            postId,
            commentId: comment.id,
          },
        })
      }
    }

    // ------------------------------------------------------------
    // キャッシュ再検証と結果返却
    // ------------------------------------------------------------

    /**
     * 投稿詳細ページのキャッシュを再検証
     * これにより、新しいコメントが即座に表示される
     */
    revalidatePath(`/posts/${postId}`)

    return { success: true, comment }
  } catch (error) {
    logger.error('Create comment error:', error)
    return { error: 'コメントの作成に失敗しました' }
  }
}

// ============================================================
// コメント削除
// ============================================================

/**
 * コメントを削除
 *
 * ## 機能概要
 * 指定されたコメントを削除します。
 * 子コメント（返信）がある場合は、Prismaのカスケード削除で自動的に削除されます。
 *
 * ## 処理フロー
 * 1. 認証チェック
 * 2. コメントの存在確認
 * 3. 所有者確認（自分のコメントのみ削除可能）
 * 4. コメント削除
 * 5. キャッシュ再検証
 *
 * ## カスケード削除
 * Prismaスキーマで設定されたカスケード削除により、
 * 親コメントを削除すると、そのコメントへの返信も自動的に削除されます。
 *
 * @param commentId - 削除するコメントのID
 * @returns 成功時は { success: true }、失敗時は { error: string }
 *
 * @example
 * ```typescript
 * const result = await deleteComment('comment-123')
 * if (result.error) {
 *   toast.error(result.error)
 * } else {
 *   toast.success('コメントを削除しました')
 * }
 * ```
 */
export async function deleteComment(commentId: string) {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  try {
    // ------------------------------------------------------------
    // コメント取得と所有者確認
    // ------------------------------------------------------------

    /**
     * 削除対象のコメントを取得
     * userId: 所有者確認用
     * postId: キャッシュ再検証用
     */
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { userId: true, postId: true },
    })

    /**
     * 存在チェック
     */
    if (!comment) {
      return { error: 'コメントが見つかりません' }
    }

    /**
     * 所有者確認
     * 自分のコメントのみ削除可能
     * ※管理者による削除は別のAdmin機能で行う
     */
    if (comment.userId !== session.user.id) {
      return { error: '削除権限がありません' }
    }

    // ------------------------------------------------------------
    // コメント削除
    // ------------------------------------------------------------

    /**
     * コメントを削除
     *
     * Prismaスキーマでカスケード削除が設定されているため、
     * このコメントへの返信（子コメント）も自動的に削除される
     *
     * ```prisma
     * model Comment {
     *   replies Comment[] @relation("CommentReplies")
     *   parent  Comment?  @relation("CommentReplies", ...)
     *   onDelete: Cascade
     * }
     * ```
     */
    await prisma.comment.delete({
      where: { id: commentId },
    })

    // ------------------------------------------------------------
    // キャッシュ再検証と結果返却
    // ------------------------------------------------------------

    /**
     * 投稿詳細ページのキャッシュを再検証
     */
    revalidatePath(`/posts/${comment.postId}`)

    return { success: true }
  } catch (error) {
    logger.error('Delete comment error:', error)
    return { error: 'コメントの削除に失敗しました' }
  }
}

// ============================================================
// コメント一覧取得
// ============================================================

/**
 * 投稿のコメント一覧を取得（親コメントのみ）
 *
 * ## 機能概要
 * 指定された投稿の親コメント（parentId: null）を取得します。
 * 返信は別途 getReplies() で取得します。
 *
 * ## 取得内容
 * - コメント情報（ID、内容、作成日時など）
 * - 投稿者情報（ID、ニックネーム、アバター）
 * - メディア（画像・動画）
 * - いいね数・返信数
 * - 現在のユーザーのいいね状態
 *
 * ## フィルタリング
 * - 非表示コメント（isHidden: true）を除外
 * - ブロックしているユーザーのコメントを除外
 *
 * ## ページネーション
 * カーソルベースのページネーションを採用
 *
 * @param postId - 投稿ID
 * @param cursor - ページネーション用カーソル（前回の最後のコメントID）
 * @param limit - 取得件数（デフォルト: 20）
 * @returns コメント一覧と次のカーソル
 *
 * @example
 * ```typescript
 * // 初回読み込み
 * const { comments, nextCursor } = await getComments('post-123')
 *
 * // 追加読み込み（無限スクロール）
 * const moreComments = await getComments('post-123', nextCursor)
 * ```
 */
export async function getComments(postId: string, cursor?: string, limit = 20) {
  const session = await auth()
  const currentUserId = session?.user?.id

  try {
    // ------------------------------------------------------------
    // ブロックユーザーの取得
    // ------------------------------------------------------------

    /**
     * ブロックしているユーザーのIDリストを取得
     * 未ログインの場合は空配列
     */
    const blockedUserIds = currentUserId
      ? await getBlockedUserIds(currentUserId)
      : []

    // ------------------------------------------------------------
    // コメント取得
    // ------------------------------------------------------------

    /**
     * 親コメントを取得
     *
     * ## フィルタ条件
     * - postId: 指定された投稿のコメント
     * - parentId: null（親コメントのみ、返信は除外）
     * - isHidden: false（非表示でないもの）
     * - userId: not in blockedUserIds（ブロックユーザー除外）
     *
     * ## 並び順
     * 新しいコメントが上に表示される（createdAt: 'desc'）
     */
    const comments = await prisma.comment.findMany({
      where: {
        postId,
        parentId: null, // 親コメントのみ
        isHidden: false, // 非表示コメントを除外
        // ブロックしているユーザーのコメントを除外
        ...(blockedUserIds.length > 0 && {
          userId: { notIn: blockedUserIds },
        }),
      },
      include: {
        /**
         * コメント投稿者の情報
         * 表示に必要な最小限のフィールドのみ取得
         */
        user: {
          select: { id: true, nickname: true, avatarUrl: true },
        },
        /**
         * 添付メディア
         * sortOrder でソートして表示順を維持
         */
        media: {
          orderBy: { sortOrder: 'asc' },
        },
        /**
         * 関連カウント
         * _count はPrismaの集計機能
         */
        _count: {
          select: { likes: true, replies: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      /**
       * カーソルベースページネーション
       * cursor が指定された場合、そのIDの次から取得
       */
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1, // カーソル自体をスキップ
      }),
    })

    // ------------------------------------------------------------
    // いいね状態の確認
    // ------------------------------------------------------------

    /**
     * 現在のユーザーがいいねしているコメントIDのセット
     */
    let likedCommentIds: Set<string> = new Set()

    if (currentUserId && comments.length > 0) {
      /**
       * 取得したコメントに対するユーザーのいいねを一括取得
       * N+1問題を避けるため、コメントごとではなく一括で取得
       */
      const userLikes = await prisma.like.findMany({
        where: {
          userId: currentUserId,
          commentId: { in: comments.map((c: typeof comments[number]) => c.id) },
        },
        select: { commentId: true },
      })

      /**
       * いいね済みコメントIDをSetに変換
       * Set を使うことで O(1) でいいね状態を判定可能
       */
      likedCommentIds = new Set(userLikes.map((l: { commentId: string | null }) => l.commentId).filter((id: string | null): id is string => id !== null))
    }

    // ------------------------------------------------------------
    // 結果の整形と返却
    // ------------------------------------------------------------

    /**
     * 追加データがあるかどうかの判定
     * 取得件数がlimitと同じ場合、次のページが存在する可能性がある
     */
    const hasMore = comments.length === limit

    return {
      /**
       * コメント配列を整形
       * _count を likeCount, replyCount に展開
       * いいね状態を追加
       */
      comments: comments.map((comment: typeof comments[number]) => ({
        ...comment,
        likeCount: comment._count.likes,
        replyCount: comment._count.replies,
        isLiked: likedCommentIds.has(comment.id),
      })),
      /**
       * 次のカーソル
       * hasMore が true の場合は最後のコメントのIDを返す
       */
      nextCursor: hasMore ? comments[comments.length - 1]?.id : undefined,
    }
  } catch (error) {
    logger.error('Get comments error:', error)
    return { comments: [], nextCursor: undefined }
  }
}

// ============================================================
// 返信取得
// ============================================================

/**
 * コメントへの返信一覧を取得
 *
 * ## 機能概要
 * 指定されたコメント（親コメント）への返信を取得します。
 *
 * ## getComments との違い
 * - getComments: parentId: null（親コメント）を取得
 * - getReplies: parentId: commentId（特定コメントへの返信）を取得
 *
 * ## 並び順
 * 返信は古い順（createdAt: 'asc'）で表示
 * これにより、会話の流れが自然に追える
 *
 * @param commentId - 親コメントのID
 * @param cursor - ページネーション用カーソル
 * @param limit - 取得件数（デフォルト: 10）
 * @returns 返信一覧と次のカーソル
 *
 * @example
 * ```typescript
 * // 「返信を表示」ボタンをクリックした時
 * const { replies, nextCursor } = await getReplies('comment-123')
 * ```
 */
export async function getReplies(commentId: string, cursor?: string, limit = 10) {
  const session = await auth()
  const currentUserId = session?.user?.id

  try {
    // ------------------------------------------------------------
    // ブロックユーザーの取得
    // ------------------------------------------------------------

    /**
     * ブロックしているユーザーのIDリストを取得
     */
    const blockedUserIds = currentUserId
      ? await getBlockedUserIds(currentUserId)
      : []

    // ------------------------------------------------------------
    // 返信取得
    // ------------------------------------------------------------

    /**
     * 返信を取得
     *
     * parentId: commentId で、指定されたコメントへの返信のみを取得
     * 並び順は古い順（会話の流れを追いやすくするため）
     */
    const replies = await prisma.comment.findMany({
      where: {
        parentId: commentId,
        isHidden: false, // 非表示コメントを除外
        // ブロックしているユーザーの返信を除外
        ...(blockedUserIds.length > 0 && {
          userId: { notIn: blockedUserIds },
        }),
      },
      include: {
        user: {
          select: { id: true, nickname: true, avatarUrl: true },
        },
        media: {
          orderBy: { sortOrder: 'asc' },
        },
        _count: {
          select: { likes: true, replies: true },
        },
      },
      /**
       * 返信は古い順（asc）
       * 会話の流れを自然に追えるようにする
       */
      orderBy: { createdAt: 'asc' },
      take: limit,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
    })

    // ------------------------------------------------------------
    // いいね状態の確認
    // ------------------------------------------------------------

    /**
     * 現在のユーザーがいいねしている返信IDのセット
     */
    let likedReplyIds: Set<string> = new Set()

    if (currentUserId && replies.length > 0) {
      const userLikes = await prisma.like.findMany({
        where: {
          userId: currentUserId,
          commentId: { in: replies.map((r: typeof replies[number]) => r.id) },
        },
        select: { commentId: true },
      })
      likedReplyIds = new Set(userLikes.map((l: { commentId: string | null }) => l.commentId).filter((id: string | null): id is string => id !== null))
    }

    // ------------------------------------------------------------
    // 結果の整形と返却
    // ------------------------------------------------------------

    const hasMore = replies.length === limit

    return {
      replies: replies.map((reply: typeof replies[number]) => ({
        ...reply,
        likeCount: reply._count.likes,
        replyCount: reply._count.replies,
        isLiked: likedReplyIds.has(reply.id),
      })),
      nextCursor: hasMore ? replies[replies.length - 1]?.id : undefined,
    }
  } catch (error) {
    logger.error('Get replies error:', error)
    return { replies: [], nextCursor: undefined }
  }
}

// ============================================================
// コメント数取得
// ============================================================

/**
 * 投稿のコメント数を取得
 *
 * ## 機能概要
 * 指定された投稿の総コメント数を取得します。
 * 非表示コメント（isHidden: true）は除外されます。
 *
 * ## 用途
 * - 投稿カードでのコメント数表示
 * - 「○件のコメント」というラベル
 *
 * @param postId - 投稿ID
 * @returns コメント数
 *
 * @example
 * ```typescript
 * const { count } = await getCommentCount('post-123')
 * // 表示: "15件のコメント"
 * ```
 */
export async function getCommentCount(postId: string) {
  try {
    /**
     * コメント数をカウント
     * 親コメント・返信を含む全コメント数
     * 非表示コメントは除外
     */
    const count = await prisma.comment.count({
      where: { postId, isHidden: false },
    })

    return { count }
  } catch (error) {
    logger.error('Get comment count error:', error)
    return { count: 0 }
  }
}

// ============================================================
// コメント用メディアアップロード
// ============================================================

/**
 * コメント用メディアファイルをアップロード
 *
 * ## 機能概要
 * コメントに添付する画像または動画をストレージにアップロードします。
 *
 * ## 投稿用メディアとの違い
 * - ファイルサイズ制限が小さい（画像5MB、動画100MB）
 * - 保存フォルダが異なる（comment-images, comment-videos）
 *
 * ## サポートするファイル形式
 * - 画像: JPEG, PNG, GIF, WebP など（image/*）
 * - 動画: MP4, WebM, MOV など（video/*）
 *
 * @param formData - ファイルを含むFormData
 * @returns 成功時は { success: true, url, type }、失敗時は { error: string }
 *
 * @example
 * ```typescript
 * const formData = new FormData()
 * formData.append('file', imageFile)
 *
 * const result = await uploadCommentMedia(formData)
 * if (result.error) {
 *   toast.error(result.error)
 * } else {
 *   setMediaUrl(result.url)
 *   setMediaType(result.type)
 * }
 * ```
 */
export async function uploadCommentMedia(formData: FormData) {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // ------------------------------------------------------------
  // ファイル検証
  // ------------------------------------------------------------

  /**
   * FormDataからファイルを取得
   */
  const file = formData.get('file') as File
  if (!file) {
    return { error: 'ファイルが選択されていません' }
  }

  /**
   * ファイルタイプの判定
   * MIMEタイプのプレフィックスで判断
   */
  const isVideo = file.type.startsWith('video/')
  const isImage = file.type.startsWith('image/')

  if (!isVideo && !isImage) {
    return { error: '画像または動画ファイルを選択してください' }
  }

  /**
   * ファイルサイズチェック
   *
   * コメント用の制限（投稿用より小さめ）：
   * - 動画: 100MB（投稿は200MB）
   * - 画像: 5MB（投稿は10MB）
   */
  const maxSize = isVideo ? 100 * 1024 * 1024 : 5 * 1024 * 1024
  if (file.size > maxSize) {
    return { error: isVideo ? '動画は100MB以下にしてください' : '画像は5MB以下にしてください' }
  }

  try {
    // ------------------------------------------------------------
    // ストレージにアップロード
    // ------------------------------------------------------------

    /**
     * ストレージモジュールを動的インポート
     * コード分割のため、必要な時のみロード
     */
    const { uploadFile } = await import('@/lib/storage')

    /**
     * FileオブジェクトをBufferに変換
     * ストレージAPIはBufferを受け付ける
     */
    const buffer = Buffer.from(await file.arrayBuffer())

    /**
     * 保存先フォルダを決定
     * 投稿用メディアと区別するため、別フォルダに保存
     */
    const folder = isVideo ? 'comment-videos' : 'comment-images'

    /**
     * ストレージにアップロード
     */
    const result = await uploadFile(buffer, file.name, file.type, folder)

    if (!result.success || !result.url) {
      return { error: result.error || 'アップロードに失敗しました' }
    }

    // ------------------------------------------------------------
    // 結果返却
    // ------------------------------------------------------------

    return {
      success: true,
      url: result.url,                       // アップロードされたファイルのURL
      type: isVideo ? 'video' : 'image',     // メディアタイプ
    }
  } catch (error) {
    logger.error('Upload comment media error:', error)
    return { error: 'メディアのアップロードに失敗しました' }
  }
}
