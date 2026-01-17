'use server'

import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

export async function getTimeline(cursor?: string, limit = 20) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です', posts: [], nextCursor: undefined }
  }

  const currentUserId = session.user.id

  // フォロー中のユーザーID、ブロック/ミュートしているユーザーのIDを並列取得
  const [following, blocks, mutes] = await Promise.all([
    prisma.follow.findMany({
      where: { followerId: currentUserId },
      select: { followingId: true },
    }),
    prisma.block.findMany({
      where: { blockerId: currentUserId },
      select: { blockedId: true },
    }),
    prisma.mute.findMany({
      where: { muterId: currentUserId },
      select: { mutedId: true },
    }),
  ])

  const followingIds = following.map((f: typeof following[number]) => f.followingId)
  // 自分の投稿も含める
  followingIds.push(currentUserId)

  const excludeIds = [
    ...blocks.map((b: typeof blocks[number]) => b.blockedId),
    ...mutes.map((m: typeof mutes[number]) => m.mutedId),
  ]

  // タイムライン取得
  const posts = await prisma.post.findMany({
    where: {
      userId: {
        in: followingIds,
        notIn: excludeIds.length > 0 ? excludeIds : undefined,
      },
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
      quotePost: {
        include: {
          user: {
            select: { id: true, nickname: true, avatarUrl: true },
          },
          media: {
            orderBy: { sortOrder: 'asc' },
          },
        },
      },
      repostPost: {
        include: {
          user: {
            select: { id: true, nickname: true, avatarUrl: true },
          },
          media: {
            orderBy: { sortOrder: 'asc' },
          },
        },
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

  if (posts.length > 0) {
    const postIds = posts.map((p: typeof posts[number]) => p.id)

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

    likedPostIds = new Set(userLikes.map((l: { postId: string | null }) => l.postId).filter((id: string | null): id is string => id !== null))
    bookmarkedPostIds = new Set(userBookmarks.map((b: { postId: string }) => b.postId))
  }

  const formattedPosts = posts.map((post: typeof posts[number]) => ({
    ...post,
    likeCount: post._count.likes,
    commentCount: post._count.comments,
    genres: post.genres.map((pg: typeof post.genres[number]) => pg.genre),
    isLiked: likedPostIds.has(post.id),
    isBookmarked: bookmarkedPostIds.has(post.id),
  }))

  return {
    posts: formattedPosts,
    nextCursor: posts.length === limit ? posts[posts.length - 1]?.id : undefined,
  }
}

export async function getRecommendedUsers(limit = 5) {
  const session = await auth()
  if (!session?.user?.id) {
    return { users: [] }
  }

  const currentUserId = session.user.id

  // 既にフォローしているユーザーID
  const following = await prisma.follow.findMany({
    where: { followerId: currentUserId },
    select: { followingId: true },
  })
  const followingIds = following.map((f: typeof following[number]) => f.followingId)
  followingIds.push(currentUserId) // 自分自身を除外

  // ブロックしているユーザー
  const blocks = await prisma.block.findMany({
    where: {
      OR: [
        { blockerId: currentUserId },
        { blockedId: currentUserId },
      ],
    },
    select: { blockerId: true, blockedId: true },
  })
  const blockedIds = blocks.flatMap((b) => [b.blockerId, b.blockedId])

  // おすすめユーザー取得（フォロワーが多い順）
  const users = await prisma.user.findMany({
    where: {
      id: {
        notIn: [...followingIds, ...blockedIds],
      },
      isPublic: true,
    },
    select: {
      id: true,
      nickname: true,
      avatarUrl: true,
      bio: true,
      _count: {
        select: { followers: true },
      },
    },
    orderBy: {
      followers: { _count: 'desc' },
    },
    take: limit,
  })

  return {
    users: users.map((user: typeof users[number]) => ({
      ...user,
      followersCount: user._count.followers,
    })),
  }
}

export async function getTrendingGenres(limit = 5) {
  // 最近1週間で投稿が多いジャンルを取得
  const oneWeekAgo = new Date()
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

  const trendingGenres = await prisma.postGenre.groupBy({
    by: ['genreId'],
    where: {
      post: {
        createdAt: { gte: oneWeekAgo },
      },
    },
    _count: {
      genreId: true,
    },
    orderBy: {
      _count: {
        genreId: 'desc',
      },
    },
    take: limit,
  })

  // ジャンル詳細を取得
  const genreIds = trendingGenres.map((g: typeof trendingGenres[number]) => g.genreId)
  const genres = await prisma.genre.findMany({
    where: {
      id: { in: genreIds },
    },
  })

  return {
    genres: trendingGenres.map((g: typeof trendingGenres[number]) => {
      const genre = genres.find((gen: typeof genres[number]) => gen.id === g.genreId)
      return {
        ...genre,
        postCount: g._count.genreId,
      }
    }).filter((g: { id?: string }) => g.id),
  }
}
