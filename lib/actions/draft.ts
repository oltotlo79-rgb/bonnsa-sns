/**
 * 下書き機能のServer Actions
 *
 * このファイルは、投稿の下書き保存に関する
 * サーバーサイドの処理を提供します。
 *
 * ## 機能概要
 * - 下書き一覧の取得
 * - 下書きの保存（新規・更新）
 * - 下書きから投稿を作成
 * - 下書きの削除
 * - 下書き詳細の取得
 *
 * ## 下書きとは
 * 投稿前の仮保存機能です。
 * 作成途中の投稿を保存しておき、
 * 後から編集・投稿できます。
 *
 * ## データ構造
 * - DraftPost: 下書き本体
 * - DraftPostMedia: 添付メディア
 * - DraftPostGenre: 関連ジャンル
 *
 * @module lib/actions/draft
 */

'use server'

// ============================================================
// インポート
// ============================================================

/**
 * 認証関数
 * NextAuth.jsのセッション取得に使用
 */
import { auth } from '@/lib/auth'

/**
 * Prismaクライアント
 * データベース操作に使用
 */
import { prisma } from '@/lib/db'

/**
 * Next.jsのキャッシュ再検証関数
 * 投稿作成後にフィードを更新するために使用
 */
import { revalidatePath } from 'next/cache'

/**
 * ロガー
 * エラーログの記録に使用
 */
import logger from '@/lib/logger'

// ============================================================
// 下書き一覧取得
// ============================================================

/**
 * 下書き一覧を取得
 *
 * ## 機能概要
 * 現在のユーザーの下書き一覧を取得します。
 *
 * ## 取得内容
 * - 下書き基本情報
 * - 添付メディア
 * - 関連ジャンル
 *
 * ## 並び順
 * 更新日時の新しい順（最近編集したものが先頭）
 *
 * @returns 下書き一覧、または { error: string }
 *
 * @example
 * ```typescript
 * const { drafts } = await getDrafts()
 *
 * return (
 *   <ul>
 *     {drafts.map(draft => (
 *       <DraftCard key={draft.id} draft={draft} />
 *     ))}
 *   </ul>
 * )
 * ```
 */
export async function getDrafts() {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  try {
    // ------------------------------------------------------------
    // 下書き一覧を取得
    // ------------------------------------------------------------

    const drafts = await prisma.draftPost.findMany({
      where: { userId: session.user.id },
      include: {
        /**
         * 添付メディア
         */
        media: { orderBy: { sortOrder: 'asc' } },
        /**
         * 関連ジャンル
         */
        genres: { include: { genre: true } },
      },
      /**
       * 更新日時の新しい順
       */
      orderBy: { updatedAt: 'desc' },
    })

    return { drafts }
  } catch (error) {
    logger.error('Get drafts error:', error)
    return { error: '下書きの取得に失敗しました' }
  }
}

/**
 * 下書きの件数を取得
 *
 * @returns 下書きの件数
 */
export async function getDraftCount(): Promise<number> {
  const session = await auth()
  if (!session?.user?.id) {
    return 0
  }

  try {
    const count = await prisma.draftPost.count({
      where: { userId: session.user.id },
    })
    return count
  } catch (error) {
    logger.error('Get draft count error:', error)
    return 0
  }
}

// ============================================================
// 下書き保存
// ============================================================

/**
 * 下書きを保存
 *
 * ## 機能概要
 * 下書きを新規作成または更新します。
 *
 * ## 新規作成 vs 更新
 * - id が指定されていない: 新規作成
 * - id が指定されている: 既存の下書きを更新
 *
 * ## 更新時の処理
 * メディアとジャンルは削除して再作成
 * （差分更新ではなく全置換）
 *
 * @param data - 下書きデータ
 * @returns 保存された下書き、または { error: string }
 *
 * @example
 * ```typescript
 * // 新規作成
 * const result = await saveDraft({
 *   content: '投稿の本文',
 *   mediaUrls: ['/uploads/image.jpg'],
 *   genreIds: ['genre-1', 'genre-2'],
 * })
 *
 * // 既存の更新
 * const result = await saveDraft({
 *   id: 'draft-123',
 *   content: '更新した本文',
 * })
 * ```
 */
export async function saveDraft(data: {
  id?: string
  content?: string
  mediaUrls?: string[]
  genreIds?: string[]
}) {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  try {
    // ------------------------------------------------------------
    // 既存の下書きを更新
    // ------------------------------------------------------------

    if (data.id) {
      /**
       * 自分の下書きかどうか確認
       */
      const existing = await prisma.draftPost.findFirst({
        where: { id: data.id, userId: session.user.id },
      })

      if (!existing) {
        return { error: '下書きが見つかりません' }
      }

      /**
       * メディアとジャンルを削除して再作成
       *
       * $transaction で2つの削除操作をアトミックに実行
       */
      await prisma.$transaction([
        prisma.draftPostMedia.deleteMany({ where: { draftPostId: data.id } }),
        prisma.draftPostGenre.deleteMany({ where: { draftPostId: data.id } }),
      ])

      /**
       * 下書きを更新
       */
      const draft = await prisma.draftPost.update({
        where: { id: data.id },
        data: {
          content: data.content,
          /**
           * ネストした create でメディアを作成
           */
          media: data.mediaUrls?.length
            ? {
                create: data.mediaUrls.map((url: string, index: number) => ({
                  url,
                  type: 'image',
                  sortOrder: index,
                })),
              }
            : undefined,
          /**
           * ネストした create でジャンルを作成
           */
          genres: data.genreIds?.length
            ? {
                create: data.genreIds.map((genreId: string) => ({ genreId })),
              }
            : undefined,
        },
        include: {
          media: true,
          genres: { include: { genre: true } },
        },
      })

      return { draft }
    }

    // ------------------------------------------------------------
    // 新規下書き作成
    // ------------------------------------------------------------

    const draft = await prisma.draftPost.create({
      data: {
        userId: session.user.id,
        content: data.content,
        /**
         * ネストした create でメディアを同時作成
         */
        media: data.mediaUrls?.length
          ? {
              create: data.mediaUrls.map((url: string, index: number) => ({
                url,
                type: 'image',
                sortOrder: index,
              })),
            }
          : undefined,
        /**
         * ネストした create でジャンルを同時作成
         */
        genres: data.genreIds?.length
          ? {
              create: data.genreIds.map((genreId: string) => ({ genreId })),
            }
          : undefined,
      },
      include: {
        media: true,
        genres: { include: { genre: true } },
      },
    })

    return { draft }
  } catch (error) {
    logger.error('Save draft error:', error)
    return { error: '下書きの保存に失敗しました' }
  }
}

// ============================================================
// 下書きから投稿を作成
// ============================================================

/**
 * 下書きから投稿を作成
 *
 * ## 機能概要
 * 下書きを正式な投稿として公開します。
 *
 * ## 処理フロー
 * 1. 下書きを取得
 * 2. 投稿を作成（下書きの内容をコピー）
 * 3. 下書きを削除
 * 4. フィードを再検証
 *
 * @param draftId - 下書きID
 * @returns 作成された投稿のID、または { error: string }
 *
 * @example
 * ```typescript
 * const result = await publishDraft('draft-123')
 *
 * if (result.postId) {
 *   router.push(`/posts/${result.postId}`)
 * }
 * ```
 */
export async function publishDraft(draftId: string) {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  try {
    // ------------------------------------------------------------
    // 下書きを取得
    // ------------------------------------------------------------

    const draft = await prisma.draftPost.findFirst({
      where: { id: draftId, userId: session.user.id },
      include: {
        media: { orderBy: { sortOrder: 'asc' } },
        genres: true,
      },
    })

    if (!draft) {
      return { error: '下書きが見つかりません' }
    }

    // ------------------------------------------------------------
    // 投稿を作成
    // ------------------------------------------------------------

    /**
     * 下書きの内容を投稿テーブルにコピー
     */
    const post = await prisma.post.create({
      data: {
        userId: session.user.id,
        content: draft.content,
        /**
         * メディアをコピー
         */
        media: draft.media.length
          ? {
              create: draft.media.map((m: typeof draft.media[number]) => ({
                url: m.url,
                type: m.type,
                sortOrder: m.sortOrder,
              })),
            }
          : undefined,
        /**
         * ジャンルをコピー
         */
        genres: draft.genres.length
          ? {
              create: draft.genres.map((g: typeof draft.genres[number]) => ({ genreId: g.genreId })),
            }
          : undefined,
      },
    })

    // ------------------------------------------------------------
    // 下書きを削除
    // ------------------------------------------------------------

    /**
     * 投稿が作成されたら下書きは不要
     *
     * カスケード削除で関連する media, genres も削除
     */
    await prisma.draftPost.delete({ where: { id: draftId } })

    // ------------------------------------------------------------
    // キャッシュ再検証と結果返却
    // ------------------------------------------------------------

    revalidatePath('/feed')
    return { postId: post.id }
  } catch (error) {
    logger.error('Publish draft error:', error)
    return { error: '投稿の作成に失敗しました' }
  }
}

// ============================================================
// 下書き削除
// ============================================================

/**
 * 下書きを削除
 *
 * ## 機能概要
 * 下書きを削除します。
 *
 * ## カスケード削除
 * 関連するメディア・ジャンルも自動削除
 *
 * @param draftId - 下書きID
 * @returns 成功時は { success: true }、失敗時は { error: string }
 *
 * @example
 * ```typescript
 * const result = await deleteDraft('draft-123')
 *
 * if (result.success) {
 *   toast.success('下書きを削除しました')
 * }
 * ```
 */
export async function deleteDraft(draftId: string) {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  try {
    // ------------------------------------------------------------
    // 下書きの所有者確認
    // ------------------------------------------------------------

    const draft = await prisma.draftPost.findFirst({
      where: { id: draftId, userId: session.user.id },
    })

    if (!draft) {
      return { error: '下書きが見つかりません' }
    }

    // ------------------------------------------------------------
    // 下書きを削除
    // ------------------------------------------------------------

    /**
     * カスケード削除で関連データも自動削除
     */
    await prisma.draftPost.delete({ where: { id: draftId } })

    return { success: true }
  } catch (error) {
    logger.error('Delete draft error:', error)
    return { error: '下書きの削除に失敗しました' }
  }
}

// ============================================================
// 下書き詳細取得
// ============================================================

/**
 * 下書き詳細を取得
 *
 * ## 機能概要
 * 指定された下書きの詳細を取得します。
 *
 * ## 用途
 * - 下書きの編集画面
 * - 下書きのプレビュー
 *
 * @param draftId - 下書きID
 * @returns 下書き詳細、または { error: string }
 *
 * @example
 * ```typescript
 * const { draft } = await getDraft('draft-123')
 *
 * // 編集フォームに初期値を設定
 * setContent(draft.content)
 * setMediaUrls(draft.media.map(m => m.url))
 * setGenreIds(draft.genres.map(g => g.genreId))
 * ```
 */
export async function getDraft(draftId: string) {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  try {
    // ------------------------------------------------------------
    // 下書きを取得
    // ------------------------------------------------------------

    const draft = await prisma.draftPost.findFirst({
      where: { id: draftId, userId: session.user.id },
      include: {
        /**
         * 添付メディア
         */
        media: { orderBy: { sortOrder: 'asc' } },
        /**
         * 関連ジャンル
         */
        genres: { include: { genre: true } },
      },
    })

    if (!draft) {
      return { error: '下書きが見つかりません' }
    }

    return { draft }
  } catch (error) {
    logger.error('Get draft error:', error)
    return { error: '下書きの取得に失敗しました' }
  }
}
