/**
 * メンション機能のServer Actions
 *
 * このファイルは、投稿内のメンション（@ユーザー名）に関する
 * サーバーサイドの処理を提供します。
 *
 * ## 機能概要
 * - メンション候補ユーザーの検索（オートコンプリート）
 * - メンションされたユーザーへの通知送信
 * - 最近メンションしたユーザーの取得
 *
 * ## メンションとは
 * 投稿内で @ユーザー名 の形式で他のユーザーを言及する機能です。
 * メンションされたユーザーには通知が送信されます。
 *
 * ## 対応文字
 * - 英数字（a-z, A-Z, 0-9）
 * - アンダースコア（_）
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

// ============================================================
// 定数・正規表現
// ============================================================

/**
 * メンションを抽出する正規表現
 *
 * ## マッチするパターン
 * - @username
 * - @user_name
 * - @User123
 *
 * ## 注意
 * 日本語には対応していない（英数字とアンダースコアのみ）
 */
const MENTION_REGEX = /@([a-zA-Z0-9_]+)/g

// ============================================================
// 内部関数
// ============================================================

/**
 * テキストからメンションを抽出（内部関数）
 *
 * ## 処理内容
 * 1. 正規表現でメンションをマッチ
 * 2. @ を除去
 * 3. 小文字に変換
 * 4. 重複を除去
 *
 * @param text - 抽出元のテキスト
 * @returns ユーザー名の配列（@ なし）
 *
 * @example
 * ```typescript
 * extractMentions('@User1 さんと @user2 と @User1')
 * // → ['user1', 'user2']
 * ```
 */
function extractMentions(text: string): string[] {
  if (!text) return []

  /**
   * 正規表現でマッチ
   */
  const matches = text.match(MENTION_REGEX)
  if (!matches) return []

  /**
   * @ を除去して小文字に変換
   *
   * slice(1) で最初の1文字（@）を除去
   */
  const mentions = matches.map((m: string) => m.slice(1).toLowerCase())

  /**
   * Set で重複を除去して配列に戻す
   */
  return [...new Set(mentions)]
}

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
 * 投稿の本文からメンションを抽出し、
 * 該当するユーザーに通知を送信します。
 *
 * ## 処理フロー
 * 1. テキストからメンションを抽出
 * 2. ニックネームでユーザーを検索
 * 3. 各ユーザーに通知を作成
 *
 * ## 呼び出しタイミング
 * 投稿作成時に自動的に呼び出される
 *
 * ## 注意
 * ニックネームは一意ではない可能性があるため、
 * 同名のユーザー全員に通知が送信される
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
  // メンションを抽出
  // ------------------------------------------------------------

  const mentionedNames = extractMentions(content)
  if (mentionedNames.length === 0) return

  try {
    // ------------------------------------------------------------
    // メンションされたユーザーを検索
    // ------------------------------------------------------------

    /**
     * ニックネームでユーザーを検索
     *
     * 注意: ニックネームは一意ではない可能性があるため、
     * 実際のシステムではユーザーIDを使用することを推奨
     */
    const users = await prisma.user.findMany({
      where: {
        nickname: { in: mentionedNames, mode: 'insensitive' },
        isSuspended: false,
        id: { not: authorId },  // 自分を除外
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
// メンションのリンク変換（内部関数）
// ============================================================

/**
 * テキスト内のメンションをリンクに変換（内部関数・クライアント用）
 *
 * ## 機能概要
 * @username 形式のテキストをHTMLリンクに変換します。
 *
 * ## 用途
 * 投稿本文の表示時にメンションをクリック可能にする
 *
 * @param text - 変換元のテキスト
 * @returns HTMLリンクを含むテキスト
 *
 * @example
 * ```typescript
 * formatMentionsToLinks('@user1 さんと @user2 へ')
 * // → '<a href="/users/search?q=user1">@user1</a> さんと <a href="/users/search?q=user2">@user2</a> へ'
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- 将来のUI表示用に保持
function formatMentionsToLinks(text: string): string {
  if (!text) return ''

  /**
   * 正規表現で置換
   *
   * encodeURIComponent でURLエンコード
   */
  return text.replace(MENTION_REGEX, (match: string, username: string) => {
    return `<a href="/users/search?q=${encodeURIComponent(username)}" class="text-primary hover:underline">${match}</a>`
  })
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
 * 2. 各投稿からメンションを抽出
 * 3. ユニークなメンションを取得
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
  // メンションを収集
  // ------------------------------------------------------------

  /**
   * 各投稿からメンションを抽出して配列に追加
   */
  const mentionedNames: string[] = []
  for (const post of recentPosts) {
    if (post.content) {
      const mentions = extractMentions(post.content)
      mentionedNames.push(...mentions)
    }
  }

  // ------------------------------------------------------------
  // ユニークなメンションを取得
  // ------------------------------------------------------------

  /**
   * 出現順を維持しつつ重複を除去
   *
   * 最初に出現したものが優先される
   */
  const uniqueMentions = [...new Set(mentionedNames)].slice(0, limit)

  if (uniqueMentions.length === 0) return []

  // ------------------------------------------------------------
  // ユーザー情報を取得
  // ------------------------------------------------------------

  const users = await prisma.user.findMany({
    where: {
      nickname: { in: uniqueMentions, mode: 'insensitive' },
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
