'use server'

import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { recordLikeReceived } from './analytics'

// 投稿いいねトグル
export async function togglePostLike(postId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // 現在のいいね状態を確認
  const existingLike = await prisma.like.findFirst({
    where: {
      postId,
      userId: session.user.id,
      commentId: null,
    },
  })

  if (existingLike) {
    // いいね解除
    await prisma.like.delete({
      where: { id: existingLike.id },
    })

    revalidatePath('/feed')
    revalidatePath(`/posts/${postId}`)
    return { success: true, liked: false }
  } else {
    // いいね追加
    await prisma.like.create({
      data: {
        postId,
        userId: session.user.id,
      },
    })

    // 通知作成（投稿者へ）
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { userId: true },
    })

    if (post && post.userId !== session.user.id) {
      await prisma.notification.create({
        data: {
          userId: post.userId,
          actorId: session.user.id,
          type: 'like',
          postId,
        },
      })

      // いいね受信を記録
      recordLikeReceived(post.userId).catch(() => {})
    }

    revalidatePath('/feed')
    revalidatePath(`/posts/${postId}`)
    return { success: true, liked: true }
  }
}

// コメントいいねトグル
export async function toggleCommentLike(commentId: string, postId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // 現在のいいね状態を確認
  const existingLike = await prisma.like.findFirst({
    where: {
      commentId,
      userId: session.user.id,
    },
  })

  if (existingLike) {
    // いいね解除
    await prisma.like.delete({
      where: { id: existingLike.id },
    })

    revalidatePath(`/posts/${postId}`)
    return { success: true, liked: false }
  } else {
    // いいね追加
    await prisma.like.create({
      data: {
        commentId,
        userId: session.user.id,
      },
    })

    // 通知作成（コメント投稿者へ）
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { userId: true },
    })

    if (comment && comment.userId !== session.user.id) {
      await prisma.notification.create({
        data: {
          userId: comment.userId,
          actorId: session.user.id,
          type: 'comment_like',
          postId,
          commentId,
        },
      })
    }

    revalidatePath(`/posts/${postId}`)
    return { success: true, liked: true }
  }
}

// 投稿いいね状態取得
export async function getPostLikeStatus(postId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { liked: false }
  }

  const existingLike = await prisma.like.findFirst({
    where: {
      postId,
      userId: session.user.id,
      commentId: null,
    },
  })

  return { liked: !!existingLike }
}

// いいねした投稿一覧
export async function getLikedPosts(userId: string, cursor?: string, limit = 20) {
  const session = await auth()
  const currentUserId = session?.user?.id

  const likes = await prisma.like.findMany({
    where: {
      userId,
      postId: { not: null },
      commentId: null,
    },
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

  type LikeType = typeof likes[number]
  type ValidLikeType = LikeType & { post: NonNullable<LikeType['post']> }
  const validLikes = likes.filter((like: LikeType): like is ValidLikeType => Boolean(like.post))
  const postIds = validLikes.map((like: ValidLikeType) => like.post.id)

  // 現在のユーザーのいいね/ブックマーク状態をチェック
  let likedPostIds: Set<string> = new Set()
  let bookmarkedPostIds: Set<string> = new Set()

  if (currentUserId && postIds.length > 0) {
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

  const posts = validLikes.map((like: ValidLikeType) => ({
    ...like.post,
    likeCount: like.post._count.likes,
    commentCount: like.post._count.comments,
    genres: like.post.genres.map((pg: typeof like.post.genres[number]) => pg.genre),
    isLiked: likedPostIds.has(like.post.id),
    isBookmarked: bookmarkedPostIds.has(like.post.id),
  }))

  const hasMore = likes.length === limit

  return {
    posts,
    nextCursor: hasMore ? likes[likes.length - 1]?.id : undefined,
  }
}
