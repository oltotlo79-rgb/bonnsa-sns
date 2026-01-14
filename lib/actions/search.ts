'use server'

import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

export async function searchPosts(
  query: string,
  genreIds?: string[],
  cursor?: string,
  limit = 20
) {
  const session = await auth()
  const currentUserId = session?.user?.id

  // ブロック/ミュートしているユーザーを除外
  let excludedUserIds: string[] = []
  if (currentUserId) {
    const [blocks, mutes] = await Promise.all([
      prisma.block.findMany({
        where: {
          OR: [
            { blockerId: currentUserId },
            { blockedId: currentUserId },
          ],
        },
        select: { blockerId: true, blockedId: true },
      }),
      prisma.mute.findMany({
        where: { muterId: currentUserId },
        select: { mutedId: true },
      }),
    ])
    excludedUserIds = [
      ...blocks.flatMap((b) => [b.blockerId, b.blockedId]),
      ...mutes.map((m) => m.mutedId),
    ].filter((id) => id !== currentUserId)
  }

  // 投稿を検索（部分一致）
  const posts = await prisma.post.findMany({
    where: {
      AND: [
        query
          ? {
              content: {
                contains: query,
                mode: 'insensitive' as const,
              },
            }
          : {},
        genreIds && genreIds.length > 0
          ? {
              genres: {
                some: {
                  genreId: { in: genreIds },
                },
              },
            }
          : {},
        excludedUserIds.length > 0
          ? {
              userId: {
                notIn: excludedUserIds,
              },
            }
          : {},
      ],
    },
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
    orderBy: { createdAt: 'desc' },
    take: limit,
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1,
    }),
  })

  // 現在のユーザーがいいね/ブックマークしているかチェック
  let likedPostIds: Set<string> = new Set()
  let bookmarkedPostIds: Set<string> = new Set()

  if (currentUserId && posts.length > 0) {
    const postIds = posts.map((p) => p.id)

    const [userLikes, userBookmarks] = await Promise.all([
      prisma.like.findMany({
        where: {
          userId: currentUserId,
          postId: { in: postIds },
          commentId: null,
        },
        select: { postId: true },
      }),
      prisma.bookmark.findMany({
        where: {
          userId: currentUserId,
          postId: { in: postIds },
        },
        select: { postId: true },
      }),
    ])

    likedPostIds = new Set(userLikes.map((l) => l.postId).filter((id): id is string => id !== null))
    bookmarkedPostIds = new Set(userBookmarks.map((b) => b.postId))
  }

  const formattedPosts = posts.map((post) => ({
    ...post,
    likeCount: post._count.likes,
    commentCount: post._count.comments,
    genres: post.genres.map((pg) => pg.genre),
    isLiked: likedPostIds.has(post.id),
    isBookmarked: bookmarkedPostIds.has(post.id),
  }))

  return {
    posts: formattedPosts,
    nextCursor: posts.length === limit ? posts[posts.length - 1]?.id : undefined,
  }
}

export async function searchUsers(query: string, cursor?: string, limit = 20) {
  const session = await auth()
  const currentUserId = session?.user?.id

  // ブロックしているユーザーを除外
  let excludedUserIds: string[] = []
  if (currentUserId) {
    const blocks = await prisma.block.findMany({
      where: {
        OR: [
          { blockerId: currentUserId },
          { blockedId: currentUserId },
        ],
      },
      select: { blockerId: true, blockedId: true },
    })
    excludedUserIds = blocks
      .flatMap((b) => [b.blockerId, b.blockedId])
      .filter((id) => id !== currentUserId)
  }

  const users = await prisma.user.findMany({
    where: {
      AND: [
        query
          ? {
              OR: [
                {
                  nickname: {
                    contains: query,
                    mode: 'insensitive' as const,
                  },
                },
                {
                  bio: {
                    contains: query,
                    mode: 'insensitive' as const,
                  },
                },
              ],
            }
          : {},
        excludedUserIds.length > 0
          ? {
              id: {
                notIn: excludedUserIds,
              },
            }
          : {},
        currentUserId
          ? {
              id: {
                not: currentUserId,
              },
            }
          : {},
      ],
    },
    select: {
      id: true,
      nickname: true,
      avatarUrl: true,
      bio: true,
      _count: {
        select: { followers: true, following: true },
      },
    },
    take: limit,
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1,
    }),
  })

  return {
    users: users.map((user) => ({
      ...user,
      followersCount: user._count.followers,
      followingCount: user._count.following,
    })),
    nextCursor: users.length === limit ? users[users.length - 1]?.id : undefined,
  }
}

export async function searchByTag(tag: string, cursor?: string, limit = 20) {
  const session = await auth()
  const currentUserId = session?.user?.id

  // ブロック/ミュートしているユーザーを除外
  let excludedUserIds: string[] = []
  if (currentUserId) {
    const [blocks, mutes] = await Promise.all([
      prisma.block.findMany({
        where: {
          OR: [
            { blockerId: currentUserId },
            { blockedId: currentUserId },
          ],
        },
        select: { blockerId: true, blockedId: true },
      }),
      prisma.mute.findMany({
        where: { muterId: currentUserId },
        select: { mutedId: true },
      }),
    ])
    excludedUserIds = [
      ...blocks.flatMap((b) => [b.blockerId, b.blockedId]),
      ...mutes.map((m) => m.mutedId),
    ].filter((id) => id !== currentUserId)
  }

  // ハッシュタグを含む投稿を検索
  const posts = await prisma.post.findMany({
    where: {
      AND: [
        {
          content: {
            contains: `#${tag}`,
          },
        },
        excludedUserIds.length > 0
          ? {
              userId: {
                notIn: excludedUserIds,
              },
            }
          : {},
      ],
    },
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
    orderBy: { createdAt: 'desc' },
    take: limit,
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1,
    }),
  })

  // 現在のユーザーがいいね/ブックマークしているかチェック
  let likedPostIds: Set<string> = new Set()
  let bookmarkedPostIds: Set<string> = new Set()

  if (currentUserId && posts.length > 0) {
    const postIds = posts.map((p) => p.id)

    const [userLikes, userBookmarks] = await Promise.all([
      prisma.like.findMany({
        where: {
          userId: currentUserId,
          postId: { in: postIds },
          commentId: null,
        },
        select: { postId: true },
      }),
      prisma.bookmark.findMany({
        where: {
          userId: currentUserId,
          postId: { in: postIds },
        },
        select: { postId: true },
      }),
    ])

    likedPostIds = new Set(userLikes.map((l) => l.postId).filter((id): id is string => id !== null))
    bookmarkedPostIds = new Set(userBookmarks.map((b) => b.postId))
  }

  return {
    posts: posts.map((post) => ({
      ...post,
      likeCount: post._count.likes,
      commentCount: post._count.comments,
      genres: post.genres.map((pg) => pg.genre),
      isLiked: likedPostIds.has(post.id),
      isBookmarked: bookmarkedPostIds.has(post.id),
    })),
    nextCursor: posts.length === limit ? posts[posts.length - 1]?.id : undefined,
  }
}

export async function getPopularTags(limit = 10) {
  // 最近1週間で使用されたハッシュタグを集計
  const oneWeekAgo = new Date()
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

  const posts = await prisma.post.findMany({
    where: {
      createdAt: { gte: oneWeekAgo },
      content: {
        contains: '#',
      },
    },
    select: {
      content: true,
    },
  })

  // ハッシュタグを抽出してカウント
  const tagCounts: Record<string, number> = {}
  const hashtagRegex = /#[\w\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]+/g

  for (const post of posts) {
    if (!post.content) continue
    const tags = post.content.match(hashtagRegex) || []
    for (const tag of tags) {
      const normalizedTag = tag.slice(1).toLowerCase()
      tagCounts[normalizedTag] = (tagCounts[normalizedTag] || 0) + 1
    }
  }

  // カウント順にソートしてトップN件を返す
  const sortedTags = Object.entries(tagCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([tag, count]) => ({ tag, count }))

  return { tags: sortedTags }
}

export async function getAllGenres() {
  const genres = await prisma.genre.findMany({
    orderBy: [{ sortOrder: 'asc' }],
  })

  // カテゴリごとにグループ化
  const groupedMap = genres.reduce((acc, genre) => {
    if (!acc[genre.category]) {
      acc[genre.category] = []
    }
    acc[genre.category].push(genre)
    return acc
  }, {} as Record<string, typeof genres>)

  // カテゴリの表示順序を定義
  const categoryOrder = ['松柏類', '雑木類', '草もの', '用品・道具', '施設・イベント', 'その他']

  // 順序通りに並べ替え
  const grouped: Record<string, typeof genres> = {}
  for (const category of categoryOrder) {
    if (groupedMap[category]) {
      grouped[category] = groupedMap[category]
    }
  }

  return { genres: grouped }
}
