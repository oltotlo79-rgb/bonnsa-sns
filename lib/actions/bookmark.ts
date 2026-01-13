'use server'

import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

// ブックマークトグル
export async function toggleBookmark(postId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // 現在のブックマーク状態を確認
  const existingBookmark = await prisma.bookmark.findFirst({
    where: {
      postId,
      userId: session.user.id,
    },
  })

  if (existingBookmark) {
    // ブックマーク解除
    await prisma.bookmark.delete({
      where: { id: existingBookmark.id },
    })

    return { success: true, bookmarked: false }
  } else {
    // ブックマーク追加
    await prisma.bookmark.create({
      data: {
        postId,
        userId: session.user.id,
      },
    })

    return { success: true, bookmarked: true }
  }
}

// ブックマーク状態取得
export async function getBookmarkStatus(postId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { bookmarked: false }
  }

  const existingBookmark = await prisma.bookmark.findFirst({
    where: {
      postId,
      userId: session.user.id,
    },
  })

  return { bookmarked: !!existingBookmark }
}

// ブックマーク一覧取得
export async function getBookmarkedPosts(cursor?: string, limit = 20) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です', posts: [] }
  }

  const currentUserId = session.user.id

  const bookmarks = await prisma.bookmark.findMany({
    where: { userId: currentUserId },
    include: {
      post: {
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
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1,
    }),
  })

  const validBookmarks = bookmarks.filter((bookmark) => bookmark.post)
  const postIds = validBookmarks.map(b => b.post.id)

  // 現在のユーザーのいいね状態をチェック
  let likedPostIds: Set<string> = new Set()

  if (postIds.length > 0) {
    const userLikes = await prisma.like.findMany({
      where: {
        userId: currentUserId,
        postId: { in: postIds },
        commentId: null,
      },
      select: { postId: true },
    })
    likedPostIds = new Set(userLikes.map(l => l.postId).filter((id): id is string => id !== null))
  }

  const posts = validBookmarks.map((bookmark) => ({
    ...bookmark.post,
    likeCount: bookmark.post._count.likes,
    commentCount: bookmark.post._count.comments,
    genres: bookmark.post.genres.map((pg) => pg.genre),
    isLiked: likedPostIds.has(bookmark.post.id),
    isBookmarked: true, // ブックマーク一覧なので必ずtrue
  }))

  const hasMore = bookmarks.length === limit

  return {
    posts,
    nextCursor: hasMore ? bookmarks[bookmarks.length - 1]?.id : undefined,
  }
}
