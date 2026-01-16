'use server'

import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

// メンションを抽出する正規表現
// @ユーザー名（英数字とアンダースコア）
const MENTION_REGEX = /@([a-zA-Z0-9_]+)/g

/**
 * テキストからメンションを抽出（内部関数）
 */
function extractMentions(text: string): string[] {
  if (!text) return []

  const matches = text.match(MENTION_REGEX)
  if (!matches) return []

  // @を除去してユニークな配列を返す
  const mentions = matches.map((m) => m.slice(1).toLowerCase())
  return [...new Set(mentions)]
}

/**
 * メンション候補ユーザーを検索（オートコンプリート用）
 */
export async function searchMentionUsers(query: string, limit: number = 10) {
  const session = await auth()
  if (!session?.user?.id) {
    return []
  }

  if (!query || query.length < 1) return []

  // 自分がフォローしているユーザーを優先
  const followingIds = await prisma.follow.findMany({
    where: { followerId: session.user.id },
    select: { followingId: true },
  })

  const followingIdSet = new Set(followingIds.map((f) => f.followingId))

  // ユーザーを検索
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { nickname: { contains: query, mode: 'insensitive' } },
        { email: { startsWith: query, mode: 'insensitive' } },
      ],
      isSuspended: false,
      id: { not: session.user.id }, // 自分を除外
    },
    select: {
      id: true,
      nickname: true,
      avatarUrl: true,
    },
    take: limit * 2, // フィルタ後にlimit数確保するため多めに取得
  })

  // フォローしているユーザーを優先してソート
  const sortedUsers = users
    .map((user) => ({
      ...user,
      isFollowing: followingIdSet.has(user.id),
    }))
    .sort((a, b) => {
      // フォロー中を優先
      if (a.isFollowing && !b.isFollowing) return -1
      if (!a.isFollowing && b.isFollowing) return 1
      return 0
    })
    .slice(0, limit)

  return sortedUsers
}

/**
 * メンションされたユーザーに通知を送信
 */
export async function notifyMentionedUsers(
  postId: string,
  content: string | null,
  authorId: string
) {
  if (!content) return

  const mentionedNames = extractMentions(content)
  if (mentionedNames.length === 0) return

  try {
    // メンションされたユーザーをニックネームで検索
    // 注意: ニックネームは一意ではない可能性があるため、
    // 実際のシステムではユーザーIDを使用することを推奨
    const users = await prisma.user.findMany({
      where: {
        nickname: { in: mentionedNames, mode: 'insensitive' },
        isSuspended: false,
        id: { not: authorId }, // 自分を除外
      },
      select: { id: true },
    })

    // 通知を作成
    if (users.length > 0) {
      await prisma.notification.createMany({
        data: users.map((user) => ({
          userId: user.id,
          actorId: authorId,
          type: 'mention',
          postId,
        })),
        skipDuplicates: true,
      })
    }
  } catch (error) {
    console.error('Notify mentioned users error:', error)
  }
}

/**
 * テキスト内のメンションをリンクに変換（内部関数・クライアント用）
 */
function formatMentionsToLinks(text: string): string {
  if (!text) return ''

  return text.replace(MENTION_REGEX, (match, username) => {
    return `<a href="/users/search?q=${encodeURIComponent(username)}" class="text-primary hover:underline">${match}</a>`
  })
}

/**
 * 最近メンションしたユーザーを取得
 */
export async function getRecentMentionedUsers(limit: number = 5) {
  const session = await auth()
  if (!session?.user?.id) {
    return []
  }

  // 自分の最近の投稿からメンションを抽出
  const recentPosts = await prisma.post.findMany({
    where: {
      userId: session.user.id,
      content: { not: null },
    },
    select: { content: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  // メンションを収集
  const mentionedNames: string[] = []
  for (const post of recentPosts) {
    if (post.content) {
      const mentions = extractMentions(post.content)
      mentionedNames.push(...mentions)
    }
  }

  // ユニークなメンションを取得（出現順を維持）
  const uniqueMentions = [...new Set(mentionedNames)].slice(0, limit)

  if (uniqueMentions.length === 0) return []

  // ユーザー情報を取得
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
