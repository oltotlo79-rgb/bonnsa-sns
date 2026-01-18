/**
 * ミュート機能のServer Actions
 *
 * このファイルは、ユーザーのミュート機能に関する
 * サーバーサイドの処理を提供します。
 *
 * ## 機能概要
 * - ユーザーをミュート
 * - ミュート解除
 * - ミュートしたユーザー一覧の取得
 * - ミュート状態の確認
 *
 * ## ミュートの効果
 * 1. 相手の投稿がタイムラインに表示されない
 * 2. 相手からの通知を受け取らない
 *
 * ## ブロックとの違い
 * - ミュート: 片方向、相手には影響なし、フォロー関係は維持
 * - ブロック: 双方向で関係を断つ、相手にも影響、フォロー解除
 *
 * ## ミュートのユースケース
 * - 興味のない話題の投稿を非表示にしたい
 * - フォローは維持したいが投稿を見たくない
 * - 相手に気づかれずに投稿を非表示にしたい
 *
 * @module lib/actions/mute
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
 * ミュート後にページを更新するために使用
 */
import { revalidatePath } from 'next/cache'

/**
 * ロガー
 * エラーログの記録に使用
 */
import logger from '@/lib/logger'

// ============================================================
// ミュート
// ============================================================

/**
 * ユーザーをミュート
 *
 * ## 機能概要
 * 指定されたユーザーをミュートします。
 *
 * ## 処理フロー
 * 1. 認証チェック
 * 2. 自分自身へのミュート防止
 * 3. ミュートレコードを作成
 * 4. キャッシュを再検証
 *
 * ## ブロックとの違い
 * - フォロー関係は解除されない
 * - 相手からは自分が見える（相手への影響なし）
 *
 * @param targetUserId - ミュート対象のユーザーID
 * @returns 成功時は { success: true }、失敗時は { error: string }
 *
 * @example
 * ```typescript
 * const result = await muteUser('user-123')
 * if (result.success) {
 *   toast.success('ユーザーをミュートしました')
 * }
 * ```
 */
export async function muteUser(targetUserId: string) {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // ------------------------------------------------------------
  // 自分自身へのミュート防止
  // ------------------------------------------------------------

  /**
   * 自分自身をミュートしようとした場合はエラー
   */
  if (session.user.id === targetUserId) {
    return { error: '自分自身をミュートできません' }
  }

  try {
    // ------------------------------------------------------------
    // ミュート作成
    // ------------------------------------------------------------

    /**
     * ミュートレコードを作成
     *
     * ブロックと異なり、フォロー関係は解除しない
     */
    await prisma.mute.create({
      data: {
        muterId: session.user.id,  // ミュートした人
        mutedId: targetUserId,     // ミュートされた人
      },
    })

    // ------------------------------------------------------------
    // キャッシュ再検証と結果返却
    // ------------------------------------------------------------

    /**
     * 関連ページのキャッシュを再検証
     */
    revalidatePath('/feed')
    revalidatePath(`/users/${targetUserId}`)

    return { success: true }
  } catch (error) {
    logger.error('Mute user error:', error)
    return { error: 'ミュートに失敗しました' }
  }
}

// ============================================================
// ミュート解除
// ============================================================

/**
 * ミュートを解除
 *
 * ## 機能概要
 * 指定されたユーザーのミュートを解除します。
 *
 * ## 複合ユニークキー
 * muterId_mutedId は Prisma スキーマで定義された
 * 複合ユニークキー
 *
 * @param targetUserId - ミュート解除対象のユーザーID
 * @returns 成功時は { success: true }、失敗時は { error: string }
 *
 * @example
 * ```typescript
 * const result = await unmuteUser('user-123')
 * if (result.success) {
 *   toast.success('ミュートを解除しました')
 * }
 * ```
 */
export async function unmuteUser(targetUserId: string) {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  try {
    // ------------------------------------------------------------
    // ミュート解除
    // ------------------------------------------------------------

    /**
     * ミュートレコードを削除
     *
     * where に複合ユニークキーを指定:
     * muterId_mutedId: { muterId, mutedId }
     */
    await prisma.mute.delete({
      where: {
        muterId_mutedId: {
          muterId: session.user.id,
          mutedId: targetUserId,
        },
      },
    })

    // ------------------------------------------------------------
    // キャッシュ再検証と結果返却
    // ------------------------------------------------------------

    revalidatePath('/feed')
    revalidatePath(`/users/${targetUserId}`)
    revalidatePath('/settings/muted') // ミュート一覧ページ

    return { success: true }
  } catch (error) {
    logger.error('Unmute user error:', error)
    return { error: 'ミュート解除に失敗しました' }
  }
}

// ============================================================
// ミュートユーザー一覧取得
// ============================================================

/**
 * ミュートしたユーザー一覧を取得
 *
 * ## 機能概要
 * 現在のユーザーがミュートしているユーザーの一覧を取得します。
 *
 * ## 用途
 * - 設定画面の「ミュートしたユーザー」ページ
 * - ミュート解除のためのUI
 *
 * ## ページネーション
 * カーソルベースのページネーションを採用
 * カーソルは mutedId を使用
 *
 * @param cursor - ページネーション用カーソル
 * @param limit - 取得件数（デフォルト: 20）
 * @returns ミュートしたユーザー一覧と次のカーソル
 *
 * @example
 * ```typescript
 * const { users, nextCursor } = await getMutedUsers()
 * ```
 */
export async function getMutedUsers(cursor?: string, limit = 20) {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です', users: [] }
  }

  try {
    // ------------------------------------------------------------
    // ミュート一覧を取得
    // ------------------------------------------------------------

    /**
     * ミュートレコードを取得
     *
     * muted を include してミュートされたユーザーの情報を取得
     */
    const mutes = await prisma.mute.findMany({
      where: { muterId: session.user.id },
      include: {
        /**
         * ミュートされたユーザーの情報
         */
        muted: {
          select: {
            id: true,
            nickname: true,
            avatarUrl: true,
            bio: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      /**
       * カーソルベースページネーション
       *
       * 複合ユニークキーをカーソルとして使用
       */
      ...(cursor && {
        cursor: { muterId_mutedId: { muterId: session.user.id, mutedId: cursor } },
        skip: 1,
      }),
    })

    // ------------------------------------------------------------
    // 結果の整形と返却
    // ------------------------------------------------------------

    return {
      /**
       * ミュートされたユーザーの配列を抽出
       */
      users: mutes.map((m: typeof mutes[number]) => m.muted),
      /**
       * 次のカーソル（mutedId）
       */
      nextCursor: mutes.length === limit ? mutes[mutes.length - 1]?.mutedId : undefined,
    }
  } catch (error) {
    logger.error('Get muted users error:', error)
    return { error: 'ミュートユーザーの取得に失敗しました', users: [] }
  }
}

// ============================================================
// ミュート状態確認
// ============================================================

/**
 * ミュート状態を確認
 *
 * ## 機能概要
 * 自分が相手をミュートしているかを確認します。
 *
 * ## ブロックとの違い
 * - ミュートは片方向のみ確認
 * - 相手から自分がミュートされているかは確認しない
 *   （ミュートは非公開機能のため）
 *
 * ## 用途
 * - ユーザープロフィール画面でミュートボタンの状態を決定
 *
 * @param targetUserId - 確認対象のユーザーID
 * @returns { muted: boolean }
 *
 * @example
 * ```typescript
 * const { muted } = await isMuted('user-123')
 *
 * if (muted) {
 *   // 「ミュート解除」ボタンを表示
 * } else {
 *   // 「ミュート」ボタンを表示
 * }
 * ```
 */
export async function isMuted(targetUserId: string) {
  const session = await auth()

  /**
   * 未ログイン時は false
   */
  if (!session?.user?.id) {
    return { muted: false }
  }

  try {
    // ------------------------------------------------------------
    // ミュート状態を確認
    // ------------------------------------------------------------

    /**
     * 自分が相手をミュートしているか確認
     *
     * findUnique を使用（複合ユニークキー）
     */
    const mute = await prisma.mute.findUnique({
      where: {
        muterId_mutedId: {
          muterId: session.user.id,
          mutedId: targetUserId,
        },
      },
    })

    // ------------------------------------------------------------
    // 結果返却
    // ------------------------------------------------------------

    return { muted: !!mute }
  } catch (error) {
    logger.error('Check mute status error:', error)
    return { muted: false }
  }
}
