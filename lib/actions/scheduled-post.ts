/**
 * 予約投稿機能のServer Actions
 *
 * このファイルは、投稿の予約投稿に関する
 * サーバーサイドの処理を提供します。
 *
 * ## 機能概要
 * - 予約投稿の作成
 * - 予約投稿一覧の取得
 * - 予約投稿の更新
 * - 予約投稿の削除・キャンセル
 * - 予約投稿の公開（バッチ処理）
 *
 * ## 有料会員限定機能
 * 予約投稿はプレミアム会員のみ利用可能です。
 *
 * ## 予約投稿のステータス
 * - pending: 予約中（公開待ち）
 * - published: 公開済み
 * - cancelled: キャンセル済み
 * - failed: 公開失敗
 *
 * ## 制限
 * - 最大30日後まで予約可能
 * - 最大10件まで予約可能
 *
 * @module lib/actions/scheduled-post
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
 * トランザクション用の型定義
 *
 * $transaction 内で使用する Prisma クライアントの型
 * 接続管理系のメソッドを除外
 */
type TransactionClient = Omit<typeof prisma, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

/**
 * 認証関数
 * NextAuth.jsのセッション取得に使用
 */
import { auth } from '@/lib/auth'

/**
 * プレミアム会員判定関数と制限取得関数
 */
import { isPremiumUser, getMembershipLimits } from '@/lib/premium'

/**
 * Next.jsのキャッシュ再検証関数
 */
import { revalidatePath } from 'next/cache'

/**
 * ロガー
 * エラーログの記録に使用
 */
import logger from '@/lib/logger'

// ============================================================
// 予約投稿作成
// ============================================================

/**
 * 予約投稿を作成
 *
 * ## 機能概要
 * 指定された日時に自動的に公開される予約投稿を作成します。
 *
 * ## 有料会員限定
 * プレミアム会員のみ利用可能
 *
 * ## バリデーション
 * - 予約日時: 未来の日時、最大30日後まで
 * - コンテンツ: テキストまたはメディアが必須
 * - 投稿文字数: 会員種別の上限内
 * - ジャンル: 最大3つ
 * - 画像・動画: 会員種別の上限内
 * - 予約件数: 最大10件
 *
 * @param formData - フォームデータ
 * @returns 成功時は { success: true, scheduledPostId }、失敗時は { error: string }
 *
 * @example
 * ```typescript
 * const formData = new FormData()
 * formData.set('content', '予約投稿の本文')
 * formData.set('scheduledAt', '2024-12-25T10:00:00')
 *
 * const result = await createScheduledPost(formData)
 * ```
 */
export async function createScheduledPost(formData: FormData) {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // ------------------------------------------------------------
  // 有料会員チェック
  // ------------------------------------------------------------

  const isPremium = await isPremiumUser(session.user.id)
  if (!isPremium) {
    return { error: '予約投稿は有料会員限定の機能です' }
  }

  // ------------------------------------------------------------
  // フォームデータの取得
  // ------------------------------------------------------------

  const content = formData.get('content') as string
  const scheduledAtStr = formData.get('scheduledAt') as string
  const genreIds = formData.getAll('genreIds') as string[]
  const mediaUrls = formData.getAll('mediaUrls') as string[]
  const mediaTypes = formData.getAll('mediaTypes') as string[]

  // ------------------------------------------------------------
  // 予約日時のバリデーション
  // ------------------------------------------------------------

  if (!scheduledAtStr) {
    return { error: '予約日時を指定してください' }
  }

  const scheduledAt = new Date(scheduledAtStr)

  /**
   * 過去の日時はエラー
   */
  if (scheduledAt <= new Date()) {
    return { error: '予約日時は未来の日時を指定してください' }
  }

  /**
   * 最大30日後までに制限
   */
  const maxDate = new Date()
  maxDate.setDate(maxDate.getDate() + 30)
  if (scheduledAt > maxDate) {
    return { error: '予約日時は30日以内で指定してください' }
  }

  // ------------------------------------------------------------
  // コンテンツのバリデーション
  // ------------------------------------------------------------

  if (!content && mediaUrls.length === 0) {
    return { error: 'テキストまたはメディアを入力してください' }
  }

  // ------------------------------------------------------------
  // 会員種別の制限チェック
  // ------------------------------------------------------------

  const limits = await getMembershipLimits(session.user.id)

  /**
   * 投稿文字数チェック
   */
  if (content && content.length > limits.maxPostLength) {
    return { error: `投稿は${limits.maxPostLength}文字以内で入力してください` }
  }

  /**
   * ジャンル数チェック
   */
  if (genreIds.length > 3) {
    return { error: 'ジャンルは3つまで選択できます' }
  }

  /**
   * 画像枚数チェック
   */
  const imageCount = mediaTypes.filter((t: string) => t === 'image').length
  if (imageCount > limits.maxImages) {
    return { error: `画像は${limits.maxImages}枚までです` }
  }

  /**
   * 動画本数チェック
   */
  const videoCount = mediaTypes.filter((t: string) => t === 'video').length
  if (videoCount > limits.maxVideos) {
    return { error: `動画は${limits.maxVideos}本までです` }
  }

  // ------------------------------------------------------------
  // 予約投稿の上限チェック
  // ------------------------------------------------------------

  /**
   * 予約中の投稿数をカウント
   * 最大10件まで
   */
  const pendingCount = await prisma.scheduledPost.count({
    where: {
      userId: session.user.id,
      status: 'pending',
    },
  })

  if (pendingCount >= 10) {
    return { error: '予約投稿は10件までです。既存の予約を削除してください。' }
  }

  // ------------------------------------------------------------
  // 予約投稿作成
  // ------------------------------------------------------------

  const scheduledPost = await prisma.scheduledPost.create({
    data: {
      userId: session.user.id,
      content: content || null,
      scheduledAt,
      /**
       * メディアをネストで作成
       */
      media: mediaUrls.length > 0 ? {
        create: mediaUrls.map((url: string, index: number) => ({
          url,
          type: mediaTypes[index] || 'image',
          sortOrder: index,
        })),
      } : undefined,
      /**
       * ジャンルをネストで作成
       */
      genres: genreIds.length > 0 ? {
        create: genreIds.map((genreId: string) => ({
          genreId,
        })),
      } : undefined,
    },
  })

  // ------------------------------------------------------------
  // キャッシュ再検証と結果返却
  // ------------------------------------------------------------

  revalidatePath('/posts/scheduled')
  return { success: true, scheduledPostId: scheduledPost.id }
}

// ============================================================
// 予約投稿一覧取得
// ============================================================

/**
 * 予約投稿一覧を取得
 *
 * ## 機能概要
 * 現在のユーザーの予約投稿一覧を取得します。
 *
 * ## 有料会員限定
 * プレミアム会員のみ利用可能
 *
 * ## 並び順
 * 予約日時の早い順
 *
 * @returns 予約投稿一覧、または { error: string }
 *
 * @example
 * ```typescript
 * const { scheduledPosts } = await getScheduledPosts()
 *
 * return (
 *   <ul>
 *     {scheduledPosts.map(post => (
 *       <ScheduledPostCard key={post.id} post={post} />
 *     ))}
 *   </ul>
 * )
 * ```
 */
export async function getScheduledPosts() {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // ------------------------------------------------------------
  // 有料会員チェック
  // ------------------------------------------------------------

  const isPremium = await isPremiumUser(session.user.id)
  if (!isPremium) {
    return { error: '予約投稿は有料会員限定の機能です', scheduledPosts: [] }
  }

  // ------------------------------------------------------------
  // 予約投稿一覧を取得
  // ------------------------------------------------------------

  const scheduledPosts = await prisma.scheduledPost.findMany({
    where: {
      userId: session.user.id,
    },
    include: {
      /**
       * 添付メディア
       */
      media: {
        orderBy: { sortOrder: 'asc' },
      },
      /**
       * ジャンル
       */
      genres: {
        include: {
          genre: true,
        },
      },
    },
    /**
     * 予約日時の早い順
     */
    orderBy: { scheduledAt: 'asc' },
  })

  // ------------------------------------------------------------
  // 結果の整形と返却
  // ------------------------------------------------------------

  return {
    /**
     * ジャンルを展開して返す
     */
    scheduledPosts: scheduledPosts.map((sp: typeof scheduledPosts[number]) => ({
      ...sp,
      genres: sp.genres.map((g: { genre: typeof sp.genres[number]['genre'] }) => g.genre),
    })),
  }
}

// ============================================================
// 予約投稿詳細取得
// ============================================================

/**
 * 予約投稿を取得
 *
 * ## 機能概要
 * 指定された予約投稿の詳細を取得します。
 *
 * ## 権限チェック
 * 自分の予約投稿のみ取得可能
 *
 * @param id - 予約投稿ID
 * @returns 予約投稿詳細、または { error: string }
 *
 * @example
 * ```typescript
 * const { scheduledPost } = await getScheduledPost('scheduled-123')
 *
 * if (scheduledPost) {
 *   console.log(`予約日時: ${scheduledPost.scheduledAt}`)
 * }
 * ```
 */
export async function getScheduledPost(id: string) {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // ------------------------------------------------------------
  // 予約投稿を取得
  // ------------------------------------------------------------

  const scheduledPost = await prisma.scheduledPost.findUnique({
    where: { id },
    include: {
      media: {
        orderBy: { sortOrder: 'asc' },
      },
      genres: {
        include: {
          genre: true,
        },
      },
    },
  })

  // ------------------------------------------------------------
  // バリデーション
  // ------------------------------------------------------------

  if (!scheduledPost) {
    return { error: '予約投稿が見つかりません' }
  }

  /**
   * 権限チェック: 自分の予約投稿のみ
   */
  if (scheduledPost.userId !== session.user.id) {
    return { error: 'アクセス権限がありません' }
  }

  // ------------------------------------------------------------
  // 結果の整形と返却
  // ------------------------------------------------------------

  return {
    scheduledPost: {
      ...scheduledPost,
      genres: scheduledPost.genres.map((g: { genre: typeof scheduledPost.genres[number]['genre'] }) => g.genre),
    },
  }
}

// ============================================================
// 予約投稿更新
// ============================================================

/**
 * 予約投稿を更新
 *
 * ## 機能概要
 * 既存の予約投稿の内容を更新します。
 *
 * ## 制限
 * - 予約中（pending）の投稿のみ更新可能
 * - 公開済み・キャンセル済みは更新不可
 *
 * @param id - 予約投稿ID
 * @param formData - フォームデータ
 * @returns 成功時は { success: true }、失敗時は { error: string }
 *
 * @example
 * ```typescript
 * const formData = new FormData()
 * formData.set('content', '更新した本文')
 * formData.set('scheduledAt', '2024-12-26T10:00:00')
 *
 * const result = await updateScheduledPost('scheduled-123', formData)
 * ```
 */
export async function updateScheduledPost(id: string, formData: FormData) {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // ------------------------------------------------------------
  // 予約投稿の存在と権限チェック
  // ------------------------------------------------------------

  const existing = await prisma.scheduledPost.findUnique({
    where: { id },
    select: { userId: true, status: true },
  })

  if (!existing) {
    return { error: '予約投稿が見つかりません' }
  }

  if (existing.userId !== session.user.id) {
    return { error: '更新権限がありません' }
  }

  /**
   * 予約中の投稿のみ更新可能
   */
  if (existing.status !== 'pending') {
    return { error: '公開済みまたはキャンセル済みの予約投稿は編集できません' }
  }

  // ------------------------------------------------------------
  // フォームデータの取得とバリデーション
  // ------------------------------------------------------------

  const content = formData.get('content') as string
  const scheduledAtStr = formData.get('scheduledAt') as string
  const genreIds = formData.getAll('genreIds') as string[]
  const mediaUrls = formData.getAll('mediaUrls') as string[]
  const mediaTypes = formData.getAll('mediaTypes') as string[]

  if (!scheduledAtStr) {
    return { error: '予約日時を指定してください' }
  }

  const scheduledAt = new Date(scheduledAtStr)

  if (scheduledAt <= new Date()) {
    return { error: '予約日時は未来の日時を指定してください' }
  }

  const maxDate = new Date()
  maxDate.setDate(maxDate.getDate() + 30)
  if (scheduledAt > maxDate) {
    return { error: '予約日時は30日以内で指定してください' }
  }

  if (!content && mediaUrls.length === 0) {
    return { error: 'テキストまたはメディアを入力してください' }
  }

  const limits = await getMembershipLimits(session.user.id)

  if (content && content.length > limits.maxPostLength) {
    return { error: `投稿は${limits.maxPostLength}文字以内で入力してください` }
  }

  if (genreIds.length > 3) {
    return { error: 'ジャンルは3つまで選択できます' }
  }

  const imageCount = mediaTypes.filter((t: string) => t === 'image').length
  if (imageCount > limits.maxImages) {
    return { error: `画像は${limits.maxImages}枚までです` }
  }

  const videoCount = mediaTypes.filter((t: string) => t === 'video').length
  if (videoCount > limits.maxVideos) {
    return { error: `動画は${limits.maxVideos}本までです` }
  }

  // ------------------------------------------------------------
  // トランザクションで更新
  // ------------------------------------------------------------

  /**
   * $transaction で複数の操作をアトミックに実行
   *
   * 1. 既存のメディアを削除
   * 2. 既存のジャンルを削除
   * 3. 予約投稿を更新（新しいメディア・ジャンルを作成）
   */
  await prisma.$transaction(async (tx: TransactionClient) => {
    await tx.scheduledPostMedia.deleteMany({ where: { scheduledPostId: id } })
    await tx.scheduledPostGenre.deleteMany({ where: { scheduledPostId: id } })

    await tx.scheduledPost.update({
      where: { id },
      data: {
        content: content || null,
        scheduledAt,
        media: mediaUrls.length > 0 ? {
          create: mediaUrls.map((url: string, index: number) => ({
            url,
            type: mediaTypes[index] || 'image',
            sortOrder: index,
          })),
        } : undefined,
        genres: genreIds.length > 0 ? {
          create: genreIds.map((genreId: string) => ({
            genreId,
          })),
        } : undefined,
      },
    })
  })

  // ------------------------------------------------------------
  // キャッシュ再検証と結果返却
  // ------------------------------------------------------------

  revalidatePath('/posts/scheduled')
  return { success: true }
}

// ============================================================
// 予約投稿削除
// ============================================================

/**
 * 予約投稿を削除
 *
 * ## 機能概要
 * 予約投稿を完全に削除します。
 *
 * ## 制限
 * - 公開済みの投稿は削除不可
 * - 予約中・キャンセル済みは削除可能
 *
 * @param id - 予約投稿ID
 * @returns 成功時は { success: true }、失敗時は { error: string }
 *
 * @example
 * ```typescript
 * const result = await deleteScheduledPost('scheduled-123')
 *
 * if (result.success) {
 *   toast.success('予約投稿を削除しました')
 * }
 * ```
 */
export async function deleteScheduledPost(id: string) {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // ------------------------------------------------------------
  // 予約投稿の存在と権限チェック
  // ------------------------------------------------------------

  const scheduledPost = await prisma.scheduledPost.findUnique({
    where: { id },
    select: { userId: true, status: true },
  })

  if (!scheduledPost) {
    return { error: '予約投稿が見つかりません' }
  }

  if (scheduledPost.userId !== session.user.id) {
    return { error: '削除権限がありません' }
  }

  /**
   * 公開済みの投稿は削除不可
   */
  if (scheduledPost.status === 'published') {
    return { error: '公開済みの予約投稿は削除できません' }
  }

  // ------------------------------------------------------------
  // 予約投稿を削除
  // ------------------------------------------------------------

  await prisma.scheduledPost.delete({ where: { id } })

  // ------------------------------------------------------------
  // キャッシュ再検証と結果返却
  // ------------------------------------------------------------

  revalidatePath('/posts/scheduled')
  return { success: true }
}

// ============================================================
// 予約投稿キャンセル
// ============================================================

/**
 * 予約投稿をキャンセル
 *
 * ## 機能概要
 * 予約投稿をキャンセルします（削除はしない）。
 *
 * ## 削除との違い
 * - キャンセル: ステータスを 'cancelled' に変更（履歴として残る）
 * - 削除: データを完全に削除
 *
 * ## 制限
 * - 予約中（pending）の投稿のみキャンセル可能
 *
 * @param id - 予約投稿ID
 * @returns 成功時は { success: true }、失敗時は { error: string }
 *
 * @example
 * ```typescript
 * const result = await cancelScheduledPost('scheduled-123')
 *
 * if (result.success) {
 *   toast.success('予約をキャンセルしました')
 * }
 * ```
 */
export async function cancelScheduledPost(id: string) {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // ------------------------------------------------------------
  // 予約投稿の存在と権限チェック
  // ------------------------------------------------------------

  const scheduledPost = await prisma.scheduledPost.findUnique({
    where: { id },
    select: { userId: true, status: true },
  })

  if (!scheduledPost) {
    return { error: '予約投稿が見つかりません' }
  }

  if (scheduledPost.userId !== session.user.id) {
    return { error: 'キャンセル権限がありません' }
  }

  /**
   * 予約中の投稿のみキャンセル可能
   */
  if (scheduledPost.status !== 'pending') {
    return { error: '予約中の投稿のみキャンセルできます' }
  }

  // ------------------------------------------------------------
  // ステータスを更新
  // ------------------------------------------------------------

  await prisma.scheduledPost.update({
    where: { id },
    data: { status: 'cancelled' },
  })

  // ------------------------------------------------------------
  // キャッシュ再検証と結果返却
  // ------------------------------------------------------------

  revalidatePath('/posts/scheduled')
  return { success: true }
}

// ============================================================
// 予約投稿の公開（バッチ処理）
// ============================================================

/**
 * 予約投稿を公開（バッチ処理用）
 *
 * ## 機能概要
 * 公開時刻を過ぎた予約投稿を自動的に公開します。
 *
 * ## 用途
 * - cronジョブ等で定期的に実行
 * - 管理者が手動で実行
 *
 * ## 処理フロー
 * 1. 予約日時を過ぎた pending 状態の投稿を取得
 * 2. 各投稿について:
 *    - Post テーブルに投稿を作成
 *    - ScheduledPost のステータスを published に更新
 *    - エラー時はステータスを failed に更新
 *
 * @returns { published: number, failed: number }
 *
 * @example
 * ```typescript
 * // cronジョブで毎分実行
 * const result = await publishScheduledPosts()
 *
 * console.log(`公開: ${result.published}件, 失敗: ${result.failed}件`)
 * ```
 */
export async function publishScheduledPosts() {
  const now = new Date()

  // ------------------------------------------------------------
  // 公開対象の予約投稿を取得
  // ------------------------------------------------------------

  /**
   * 公開時刻を過ぎた予約投稿を取得
   *
   * - status: 'pending': 予約中のもののみ
   * - scheduledAt: { lte: now }: 現在時刻以前
   */
  const scheduledPosts = await prisma.scheduledPost.findMany({
    where: {
      status: 'pending',
      scheduledAt: { lte: now },
    },
    include: {
      media: { orderBy: { sortOrder: 'asc' } },
      genres: true,
    },
  })

  let publishedCount = 0
  let failedCount = 0

  // ------------------------------------------------------------
  // 各予約投稿を公開
  // ------------------------------------------------------------

  for (const scheduled of scheduledPosts) {
    try {
      // ------------------------------------------------------------
      // 投稿を作成
      // ------------------------------------------------------------

      /**
       * Post テーブルに新規投稿を作成
       *
       * 予約投稿の内容をコピー
       */
      const post = await prisma.post.create({
        data: {
          userId: scheduled.userId,
          content: scheduled.content,
          /**
           * メディアをコピー
           */
          media: scheduled.media.length > 0 ? {
            create: scheduled.media.map((m: typeof scheduled.media[number]) => ({
              url: m.url,
              type: m.type,
              sortOrder: m.sortOrder,
            })),
          } : undefined,
          /**
           * ジャンルをコピー
           */
          genres: scheduled.genres.length > 0 ? {
            create: scheduled.genres.map((g: typeof scheduled.genres[number]) => ({
              genreId: g.genreId,
            })),
          } : undefined,
        },
      })

      // ------------------------------------------------------------
      // 予約投稿のステータスを更新
      // ------------------------------------------------------------

      /**
       * ステータスを published に更新
       * publishedPostId に作成された投稿のIDを記録
       */
      await prisma.scheduledPost.update({
        where: { id: scheduled.id },
        data: {
          status: 'published',
          publishedPostId: post.id,
        },
      })

      publishedCount++
    } catch (error) {
      // ------------------------------------------------------------
      // エラー処理
      // ------------------------------------------------------------

      logger.error(`Failed to publish scheduled post ${scheduled.id}:`, error)

      /**
       * エラー時はステータスを failed に更新
       */
      await prisma.scheduledPost.update({
        where: { id: scheduled.id },
        data: { status: 'failed' },
      })

      failedCount++
    }
  }

  // ------------------------------------------------------------
  // 結果を返却
  // ------------------------------------------------------------

  return { published: publishedCount, failed: failedCount }
}
