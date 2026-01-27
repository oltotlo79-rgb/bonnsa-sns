/**
 * メンション機能のServer Actions
 *
 * このファイルは、投稿内のメンション（<@userId>形式）に関する
 * サーバーサイドの処理を提供します。
 *
 * ## 機能概要
 * - メンション候補ユーザーの検索（オートコンプリート）
 * - メンションされたユーザーへの通知送信
 * - 最近メンションしたユーザーの取得
 * - メンションユーザー情報の解決
 *
 * ## メンション形式
 * - 保存形式: `<@userId>` （例: `<@clxxxxxxxxxx>`）
 * - 表示形式: `@nickname` （リンク付き）
 *
 * ## メンションとは
 * 投稿内で <@userId> の形式で他のユーザーを言及する機能です。
 * メンションされたユーザーには通知が送信されます。
 *
 * @module lib/actions/mention
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
 * ロガー
 * エラーログの記録に使用
 */
import logger from '@/lib/logger'

/**
 * メンションユーティリティ
 * ユーザーID形式のメンション抽出に使用
 */
import { extractMentionIds } from '@/lib/mention-utils'

// ============================================================
// メンション候補検索
// ============================================================

/**
 * メンション候補ユーザーを検索（オートコンプリート用）
 *
 * ## 機能概要
 * 入力中のテキストに部分一致するユーザーを取得します。
 * フォローしているユーザーを優先して表示します。
 *
 * ## 用途
 * - 投稿フォームで @ を入力した際のサジェスト
 * - メンション入力の補完
 *
 * ## 優先順位
 * 1. フォローしているユーザー
 * 2. その他のユーザー
 *
 * @param query - 検索クエリ
 * @param limit - 取得件数（デフォルト: 10）
 * @returns ユーザー配列（isFollowing フラグ付き）
 *
 * @example
 * ```typescript
 * const users = await searchMentionUsers('bon')
 *
 * return (
 *   <ul>
 *     {users.map(user => (
 *       <li key={user.id} onClick={() => insertMention(user.nickname)}>
 *         @{user.nickname}
 *         {user.isFollowing && <Badge>フォロー中</Badge>}
 *       </li>
 *     ))}
 *   </ul>
 * )
 * ```
 */
export async function searchMentionUsers(query: string, limit: number = 10) {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------

  const session = await auth()
  if (!session?.user?.id) {
    return []
  }

  // ------------------------------------------------------------
  // クエリのバリデーション
  // ------------------------------------------------------------

  if (!query || query.length < 1) return []

  // ------------------------------------------------------------
  // フォロー中のユーザーIDを取得
  // ------------------------------------------------------------

  /**
   * フォローしているユーザーのIDを取得
   * 優先表示に使用
   */
  const followingIds = await prisma.follow.findMany({
    where: { followerId: session.user.id },
    select: { followingId: true },
  })

  /**
   * Set に変換して高速な検索を可能に
   */
  const followingIdSet = new Set(followingIds.map((f: typeof followingIds[number]) => f.followingId))

  // ------------------------------------------------------------
  // ユーザーを検索
  // ------------------------------------------------------------

  /**
   * ニックネームまたはメールアドレスで検索
   *
   * - OR: いずれかの条件にマッチ
   * - mode: 'insensitive': 大文字小文字を区別しない
   * - isSuspended: false: 停止中のユーザーを除外
   * - id: { not: ... }: 自分を除外
   */
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { nickname: { contains: query, mode: 'insensitive' } },
        { email: { startsWith: query, mode: 'insensitive' } },
      ],
      isSuspended: false,
      id: { not: session.user.id },
    },
    select: {
      id: true,
      nickname: true,
      avatarUrl: true,
    },
    take: limit * 2,  // フィルタ後にlimit数確保するため多めに取得
  })

  // ------------------------------------------------------------
  // フォロー中ユーザーを優先してソート
  // ------------------------------------------------------------

  /**
   * isFollowing フラグを追加してソート
   *
   * フォロー中のユーザーが先に来るようにソート
   */
  const sortedUsers = users
    .map((user: typeof users[number]) => ({
      ...user,
      isFollowing: followingIdSet.has(user.id),
    }))
    .sort((a: { isFollowing: boolean }, b: { isFollowing: boolean }) => {
      // フォロー中を優先
      if (a.isFollowing && !b.isFollowing) return -1
      if (!a.isFollowing && b.isFollowing) return 1
      return 0
    })
    .slice(0, limit)

  return sortedUsers
}

// ============================================================
// メンション通知送信
// ============================================================

/**
 * メンションされたユーザーに通知を送信
 *
 * ## 機能概要
 * 投稿の本文から <@userId> 形式のメンションを抽出し、
 * 該当するユーザーに通知を送信します。
 *
 * ## 処理フロー
 * 1. テキストから <@userId> 形式でユーザーIDを抽出
 * 2. ユーザーIDで直接ユーザーを検索
 * 3. 各ユーザーに通知を作成
 *
 * ## 呼び出しタイミング
 * 投稿作成時に自動的に呼び出される
 *
 * ## メンション形式
 * - 保存形式: `<@userId>` （例: `<@clxxxxxxxxxx>`）
 * - ユーザーIDで直接特定するため、同名ユーザーへの重複通知は発生しない
 *
 * @param postId - 投稿ID
 * @param content - 投稿の本文
 * @param authorId - 投稿者のユーザーID
 *
 * @example
 * ```typescript
 * // 投稿作成後に呼び出し
 * await notifyMentionedUsers(post.id, post.content, session.user.id)
 * ```
 */
export async function notifyMentionedUsers(
  postId: string,
  content: string | null,
  authorId: string
) {
  // ------------------------------------------------------------
  // コンテンツがない場合は終了
  // ------------------------------------------------------------

  if (!content) return

  // ------------------------------------------------------------
  // メンションを抽出（<@userId> 形式）
  // ------------------------------------------------------------

  const mentionedUserIds = extractMentionIds(content)
  if (mentionedUserIds.length === 0) return

  try {
    // ------------------------------------------------------------
    // メンションされたユーザーを検索
    // ------------------------------------------------------------

    /**
     * ユーザーIDで直接検索
     *
     * ユーザーIDは一意なので、確実に正しいユーザーに通知が送られる
     */
    const users = await prisma.user.findMany({
      where: {
        id: { in: mentionedUserIds },
        isSuspended: false,
        NOT: { id: authorId },  // 自分を除外
      },
      select: { id: true },
    })

    // ------------------------------------------------------------
    // 通知を作成
    // ------------------------------------------------------------

    if (users.length > 0) {
      /**
       * createMany で一括作成
       *
       * skipDuplicates: 重複は無視（同じユーザーへの重複通知を防止）
       */
      await prisma.notification.createMany({
        data: users.map((user: typeof users[number]) => ({
          userId: user.id,           // 通知を受け取るユーザー
          actorId: authorId,         // メンションした人（投稿者）
          type: 'mention',
          postId,
        })),
        skipDuplicates: true,
      })
    }
  } catch (error) {
    /**
     * メンション通知の失敗は投稿作成をブロックしない
     */
    logger.error('Notify mentioned users error:', error)
  }
}

// ============================================================
// メンションユーザー情報の解決
// ============================================================

/**
 * メンションされたユーザーの情報を取得
 *
 * ## 機能概要
 * ユーザーIDの配列から、表示に必要なユーザー情報を取得します。
 * 投稿表示時にメンションをニックネーム表示に変換するために使用。
 *
 * @param userIds - ユーザーIDの配列
 * @returns ユーザー情報のMap（キー: ユーザーID）
 *
 * @example
 * ```typescript
 * const userIds = extractMentionIds(post.content)
 * const users = await resolveMentionUsers(userIds)
 * // users.get('cl123') → { id: 'cl123', nickname: 'john', avatarUrl: '...' }
 * ```
 */
export async function resolveMentionUsers(userIds: string[]): Promise<Map<string, {
  id: string
  nickname: string
  avatarUrl: string | null
}>> {
  if (!userIds || userIds.length === 0) {
    return new Map()
  }

  try {
    const users = await prisma.user.findMany({
      where: {
        id: { in: userIds },
        isSuspended: false,
      },
      select: {
        id: true,
        nickname: true,
        avatarUrl: true,
      },
    })

    const userMap = new Map<string, {
      id: string
      nickname: string
      avatarUrl: string | null
    }>()

    for (const user of users) {
      userMap.set(user.id, user)
    }

    return userMap
  } catch (error) {
    logger.error('Resolve mention users error:', error)
    return new Map()
  }
}


// ============================================================
// 最近メンションしたユーザー取得
// ============================================================

/**
 * 最近メンションしたユーザーを取得
 *
 * ## 機能概要
 * 自分が最近の投稿でメンションしたユーザーを取得します。
 *
 * ## 用途
 * - メンション入力時のクイックアクセス
 * - 「よくメンションするユーザー」の表示
 *
 * ## 処理フロー
 * 1. 自分の最近の投稿を取得
 * 2. 各投稿から <@userId> 形式のメンションを抽出
 * 3. ユニークなユーザーIDを取得
 * 4. ユーザー情報を取得
 *
 * @param limit - 取得件数（デフォルト: 5）
 * @returns ユーザー配列
 *
 * @example
 * ```typescript
 * const recentUsers = await getRecentMentionedUsers()
 *
 * return (
 *   <div>
 *     <h4>最近メンションしたユーザー</h4>
 *     {recentUsers.map(user => (
 *       <UserChip key={user.id} user={user} />
 *     ))}
 *   </div>
 * )
 * ```
 */
export async function getRecentMentionedUsers(limit: number = 5) {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------

  const session = await auth()
  if (!session?.user?.id) {
    return []
  }

  // ------------------------------------------------------------
  // 自分の最近の投稿を取得
  // ------------------------------------------------------------

  const recentPosts = await prisma.post.findMany({
    where: {
      userId: session.user.id,
      content: { not: null },
    },
    select: { content: true },
    orderBy: { createdAt: 'desc' },
    take: 50,  // 最近50件の投稿を対象
  })

  // ------------------------------------------------------------
  // メンションを収集（<@userId>形式）
  // ------------------------------------------------------------

  /**
   * 各投稿からメンションIDを抽出して配列に追加
   */
  const mentionedUserIds: string[] = []
  for (const post of recentPosts) {
    if (post.content) {
      const ids = extractMentionIds(post.content)
      mentionedUserIds.push(...ids)
    }
  }

  // ------------------------------------------------------------
  // ユニークなユーザーIDを取得
  // ------------------------------------------------------------

  /**
   * 出現順を維持しつつ重複を除去
   *
   * 最初に出現したものが優先される
   */
  const uniqueUserIds = [...new Set(mentionedUserIds)].slice(0, limit)

  if (uniqueUserIds.length === 0) return []

  // ------------------------------------------------------------
  // ユーザー情報を取得
  // ------------------------------------------------------------

  const users = await prisma.user.findMany({
    where: {
      id: { in: uniqueUserIds },
      isSuspended: false,
    },
    select: {
      id: true,
      nickname: true,
      avatarUrl: true,
    },
  })

  return users
}
