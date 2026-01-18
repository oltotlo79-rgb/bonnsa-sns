/**
 * ブロック機能のServer Actions
 *
 * このファイルは、ユーザーのブロック機能に関する
 * サーバーサイドの処理を提供します。
 *
 * ## 機能概要
 * - ユーザーをブロック
 * - ブロック解除
 * - ブロックしたユーザー一覧の取得
 * - ブロック状態の確認
 *
 * ## ブロックの効果
 * 1. 相互フォローが解除される
 * 2. 相手の投稿がタイムラインに表示されない
 * 3. 相手の検索結果に表示されない
 * 4. 相手からの通知を受け取らない
 * 5. 相手があなたのプロフィールを見られなくなる
 *
 * ## ブロックとミュートの違い
 * - ブロック: 双方向で関係を断つ、相手にも影響
 * - ミュート: 片方向、相手には影響なし
 *
 * @module lib/actions/block
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
 * ブロック後にページを更新するために使用
 */
import { revalidatePath } from 'next/cache'

/**
 * ロガー
 * エラーログの記録に使用
 */
import logger from '@/lib/logger'

// ============================================================
// ブロック
// ============================================================

/**
 * ユーザーをブロック
 *
 * ## 機能概要
 * 指定されたユーザーをブロックします。
 *
 * ## 処理フロー
 * 1. 認証チェック
 * 2. 自分自身へのブロック防止
 * 3. トランザクションで以下を実行:
 *    - 相互フォローを解除
 *    - ブロックレコードを作成
 * 4. キャッシュを再検証
 *
 * ## トランザクションの使用
 * フォロー解除とブロック作成を原子的に実行
 * どちらかが失敗した場合、両方ロールバック
 *
 * ## 相互フォロー解除
 * - 自分 → 相手 のフォロー
 * - 相手 → 自分 のフォロー
 * 両方を削除
 *
 * @param targetUserId - ブロック対象のユーザーID
 * @returns 成功時は { success: true }、失敗時は { error: string }
 *
 * @example
 * ```typescript
 * const result = await blockUser('user-123')
 * if (result.success) {
 *   toast.success('ユーザーをブロックしました')
 * }
 * ```
 */
export async function blockUser(targetUserId: string) {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // ------------------------------------------------------------
  // 自分自身へのブロック防止
  // ------------------------------------------------------------

  /**
   * 自分自身をブロックしようとした場合はエラー
   */
  if (session.user.id === targetUserId) {
    return { error: '自分自身をブロックできません' }
  }

  try {
    // ------------------------------------------------------------
    // トランザクションで相互フォロー解除とブロック作成
    // ------------------------------------------------------------

    /**
     * $transaction で複数操作をアトミックに実行
     *
     * 配列形式のトランザクション:
     * - 全ての操作が成功するか、全てロールバック
     * - 順序は保証されない（並列実行される可能性あり）
     */
    await prisma.$transaction([
      /**
       * 相互フォロー解除
       *
       * OR条件で双方向のフォローを一括削除:
       * - followerId: session.user.id, followingId: targetUserId
       *   → 自分が相手をフォロー
       * - followerId: targetUserId, followingId: session.user.id
       *   → 相手が自分をフォロー
       */
      prisma.follow.deleteMany({
        where: {
          OR: [
            { followerId: session.user.id, followingId: targetUserId },
            { followerId: targetUserId, followingId: session.user.id },
          ],
        },
      }),
      /**
       * ブロックレコード作成
       */
      prisma.block.create({
        data: {
          blockerId: session.user.id,  // ブロックした人
          blockedId: targetUserId,     // ブロックされた人
        },
      }),
    ])

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
    logger.error('Block user error:', error)
    return { error: 'ブロックに失敗しました' }
  }
}

// ============================================================
// ブロック解除
// ============================================================

/**
 * ブロックを解除
 *
 * ## 機能概要
 * 指定されたユーザーのブロックを解除します。
 *
 * ## 注意点
 * - ブロック解除してもフォロー関係は復活しない
 * - ブロック解除後、相手を再度フォローすることは可能
 *
 * ## 複合ユニークキー
 * blockerId_blockedId は Prisma スキーマで定義された
 * 複合ユニークキー（2つのフィールドの組み合わせでユニーク）
 *
 * @param targetUserId - ブロック解除対象のユーザーID
 * @returns 成功時は { success: true }、失敗時は { error: string }
 *
 * @example
 * ```typescript
 * const result = await unblockUser('user-123')
 * if (result.success) {
 *   toast.success('ブロックを解除しました')
 * }
 * ```
 */
export async function unblockUser(targetUserId: string) {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  try {
    // ------------------------------------------------------------
    // ブロック解除
    // ------------------------------------------------------------

    /**
     * ブロックレコードを削除
     *
     * where に複合ユニークキーを指定:
     * blockerId_blockedId: { blockerId, blockedId }
     */
    await prisma.block.delete({
      where: {
        blockerId_blockedId: {
          blockerId: session.user.id,
          blockedId: targetUserId,
        },
      },
    })

    // ------------------------------------------------------------
    // キャッシュ再検証と結果返却
    // ------------------------------------------------------------

    revalidatePath('/feed')
    revalidatePath(`/users/${targetUserId}`)
    revalidatePath('/settings/blocked') // ブロック一覧ページ

    return { success: true }
  } catch (error) {
    logger.error('Unblock user error:', error)
    return { error: 'ブロック解除に失敗しました' }
  }
}

// ============================================================
// ブロックユーザー一覧取得
// ============================================================

/**
 * ブロックしたユーザー一覧を取得
 *
 * ## 機能概要
 * 現在のユーザーがブロックしているユーザーの一覧を取得します。
 *
 * ## 用途
 * - 設定画面の「ブロックしたユーザー」ページ
 * - ブロック解除のためのUI
 *
 * ## ページネーション
 * カーソルベースのページネーションを採用
 * カーソルは blockedId を使用
 *
 * @param cursor - ページネーション用カーソル
 * @param limit - 取得件数（デフォルト: 20）
 * @returns ブロックしたユーザー一覧と次のカーソル
 *
 * @example
 * ```typescript
 * const { users, nextCursor } = await getBlockedUsers()
 * ```
 */
export async function getBlockedUsers(cursor?: string, limit = 20) {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です', users: [] }
  }

  try {
    // ------------------------------------------------------------
    // ブロック一覧を取得
    // ------------------------------------------------------------

    /**
     * ブロックレコードを取得
     *
     * blocked を include してブロックされたユーザーの情報を取得
     */
    const blocks = await prisma.block.findMany({
      where: { blockerId: session.user.id },
      include: {
        /**
         * ブロックされたユーザーの情報
         */
        blocked: {
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
        cursor: { blockerId_blockedId: { blockerId: session.user.id, blockedId: cursor } },
        skip: 1,
      }),
    })

    // ------------------------------------------------------------
    // 結果の整形と返却
    // ------------------------------------------------------------

    return {
      /**
       * ブロックされたユーザーの配列を抽出
       */
      users: blocks.map((b: typeof blocks[number]) => b.blocked),
      /**
       * 次のカーソル（blockedId）
       */
      nextCursor: blocks.length === limit ? blocks[blocks.length - 1]?.blockedId : undefined,
    }
  } catch (error) {
    logger.error('Get blocked users error:', error)
    return { error: 'ブロックユーザーの取得に失敗しました', users: [] }
  }
}

// ============================================================
// ブロック状態確認
// ============================================================

/**
 * ブロック状態を確認
 *
 * ## 機能概要
 * 自分と相手の間のブロック関係を確認します。
 *
 * ## 確認内容
 * - blocked: 自分が相手をブロックしているか
 * - blockedBy: 相手から自分がブロックされているか
 *
 * ## 用途
 * - ユーザープロフィール画面でブロックボタンの状態を決定
 * - ブロックされている場合のアクセス制限
 *
 * @param targetUserId - 確認対象のユーザーID
 * @returns { blocked: boolean, blockedBy: boolean }
 *
 * @example
 * ```typescript
 * const { blocked, blockedBy } = await isBlocked('user-123')
 *
 * if (blockedBy) {
 *   // このユーザーのプロフィールにアクセスできない
 *   return <BlockedMessage />
 * }
 *
 * if (blocked) {
 *   // 「ブロック解除」ボタンを表示
 * } else {
 *   // 「ブロック」ボタンを表示
 * }
 * ```
 */
export async function isBlocked(targetUserId: string) {
  const session = await auth()

  /**
   * 未ログイン時はどちらも false
   */
  if (!session?.user?.id) {
    return { blocked: false, blockedBy: false }
  }

  try {
    // ------------------------------------------------------------
    // 双方向のブロック状態を並列取得
    // ------------------------------------------------------------

    /**
     * Promise.all で並列クエリ
     *
     * 1. 自分が相手をブロックしているか
     * 2. 相手から自分がブロックされているか
     */
    const [block, blockedBy] = await Promise.all([
      /**
       * 自分が相手をブロックしているか
       */
      prisma.block.findUnique({
        where: {
          blockerId_blockedId: {
            blockerId: session.user.id,
            blockedId: targetUserId,
          },
        },
      }),
      /**
       * 相手から自分がブロックされているか
       */
      prisma.block.findUnique({
        where: {
          blockerId_blockedId: {
            blockerId: targetUserId,
            blockedId: session.user.id,
          },
        },
      }),
    ])

    // ------------------------------------------------------------
    // 結果返却
    // ------------------------------------------------------------

    return {
      blocked: !!block,      // 自分が相手をブロック
      blockedBy: !!blockedBy, // 相手から自分がブロックされている
    }
  } catch (error) {
    logger.error('Check block status error:', error)
    return { blocked: false, blockedBy: false }
  }
}
