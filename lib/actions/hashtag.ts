'use server'

import { prisma } from '@/lib/db'

// ハッシュタグを抽出する正規表現
// 日本語、英数字、アンダースコアに対応
const HASHTAG_REGEX = /#([a-zA-Z0-9_\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]+)/g

/**
 * テキストからハッシュタグを抽出（内部関数）
 */
function extractHashtags(text: string): string[] {
  if (!text) return []

  const matches = text.match(HASHTAG_REGEX)
  if (!matches) return []

  // #を除去してユニークな配列を返す
  const hashtags = matches.map((tag: string) => tag.slice(1).toLowerCase())
  return [...new Set(hashtags)]
}

/**
 * 投稿にハッシュタグを関連付け
 */
export async function attachHashtagsToPost(postId: string, content: string | null) {
  if (!content) return

  const hashtagNames = extractHashtags(content)
  if (hashtagNames.length === 0) return

  try {
    for (const name of hashtagNames) {
      const hashtag = await prisma.hashtag.upsert({
        where: { name },
        update: { count: { increment: 1 } },
        create: { name, count: 1 },
      })
      await prisma.postHashtag.upsert({
        where: { postId_hashtagId: { postId, hashtagId: hashtag.id } },
        update: {},
        create: { postId, hashtagId: hashtag.id },
      })
    }
  } catch (error) {
    console.error('Attach hashtags error:', error)
  }
}

/**
 * 投稿からハッシュタグの関連付けを削除
 */
export async function detachHashtagsFromPost(postId: string) {
  try {
    // 関連するハッシュタグを取得
    const postHashtags = await prisma.postHashtag.findMany({
      where: { postId },
      include: { hashtag: true },
    })

    // 関連付けを削除
    await prisma.postHashtag.deleteMany({ where: { postId } })

    // ハッシュタグのカウントを減少
    for (const ph of postHashtags) {
      await prisma.hashtag.update({
        where: { id: ph.hashtagId },
        data: { count: { decrement: 1 } },
      })
    }

    // カウントが0以下になったハッシュタグを削除
    await prisma.hashtag.deleteMany({
      where: { count: { lte: 0 } },
    })
  } catch (error) {
    console.error('Detach hashtags error:', error)
  }
}

/**
 * トレンドハッシュタグを取得
 */
export async function getTrendingHashtags(limit: number = 10) {
  try {
    const hashtags = await prisma.hashtag.findMany({
      where: { count: { gt: 0 } },
      orderBy: { count: 'desc' },
      take: limit,
    })
    return hashtags
  } catch (error) {
    console.error('Get trending hashtags error:', error)
    return []
  }
}

/**
 * ハッシュタグで投稿を検索
 */
export async function getPostsByHashtag(
  hashtagName: string,
  options: { cursor?: string; limit?: number } = {}
) {
  const { limit = 20 } = options

  // ハッシュタグがない場合は通常検索にフォールバック
  const posts = await prisma.post.findMany({
    where: {
      isHidden: false,
      content: {
        contains: `#${hashtagName}`,
        mode: 'insensitive',
      },
    },
    include: {
      user: {
        select: {
          id: true,
          nickname: true,
          avatarUrl: true,
        },
      },
      media: { orderBy: { sortOrder: 'asc' } },
      genres: { include: { genre: true } },
      _count: { select: { likes: true, comments: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  const hasMore = posts.length === limit
  const nextCursor = hasMore ? posts[posts.length - 1]?.id : undefined

  return { posts, hashtag: { name: hashtagName, count: posts.length }, nextCursor }
}

/**
 * ハッシュタグ候補を検索（オートコンプリート用）
 */
export async function searchHashtags(query: string, limit: number = 10) {
  if (!query || query.length < 1) return []

  try {
    const hashtags = await prisma.hashtag.findMany({
      where: {
        name: {
          contains: query.toLowerCase(),
          mode: 'insensitive',
        },
        count: { gt: 0 },
      },
      orderBy: { count: 'desc' },
      take: limit,
    })
    return hashtags
  } catch (error) {
    console.error('Search hashtags error:', error)
    return []
  }
}
