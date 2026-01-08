'use server'

import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

// コメント作成
export async function createComment(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  const postId = formData.get('postId') as string
  const parentId = formData.get('parentId') as string | null
  const content = formData.get('content') as string

  // バリデーション
  if (!content || content.trim().length === 0) {
    return { error: 'コメント内容を入力してください' }
  }

  if (content.length > 500) {
    return { error: 'コメントは500文字以内で入力してください' }
  }

  // コメント制限チェック（1日100件）
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const count = await prisma.comment.count({
    where: {
      userId: session.user.id,
      createdAt: { gte: today },
    },
  })

  if (count >= 100) {
    return { error: '1日のコメント上限（100件）に達しました' }
  }

  // コメント作成
  const comment = await prisma.comment.create({
    data: {
      postId,
      userId: session.user.id,
      parentId: parentId || null,
      content: content.trim(),
    },
  })

  // 通知作成
  if (parentId) {
    // 返信の場合：親コメントの投稿者へ通知
    const parentComment = await prisma.comment.findUnique({
      where: { id: parentId },
      select: { userId: true },
    })

    if (parentComment && parentComment.userId !== session.user.id) {
      await prisma.notification.create({
        data: {
          userId: parentComment.userId,
          actorId: session.user.id,
          type: 'reply',
          postId,
          commentId: comment.id,
        },
      })
    }
  } else {
    // 通常コメントの場合：投稿者へ通知
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { userId: true },
    })

    if (post && post.userId !== session.user.id) {
      await prisma.notification.create({
        data: {
          userId: post.userId,
          actorId: session.user.id,
          type: 'comment',
          postId,
          commentId: comment.id,
        },
      })
    }
  }

  revalidatePath(`/posts/${postId}`)
  return { success: true, comment }
}

// コメント削除
export async function deleteComment(commentId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // コメント取得して所有者確認
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { userId: true, postId: true },
  })

  if (!comment) {
    return { error: 'コメントが見つかりません' }
  }

  if (comment.userId !== session.user.id) {
    return { error: '削除権限がありません' }
  }

  // 子コメント（返信）も含めて削除（Prismaのカスケード削除で自動的に処理）
  await prisma.comment.delete({
    where: { id: commentId },
  })

  revalidatePath(`/posts/${comment.postId}`)
  return { success: true }
}

// 投稿のコメント取得
export async function getComments(postId: string, cursor?: string, limit = 20) {
  const comments = await prisma.comment.findMany({
    where: {
      postId,
      parentId: null, // 親コメントのみ
    },
    include: {
      user: {
        select: { id: true, nickname: true, avatarUrl: true },
      },
      _count: {
        select: { likes: true, replies: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1,
    }),
  })

  const hasMore = comments.length === limit

  return {
    comments: comments.map((comment) => ({
      ...comment,
      likeCount: comment._count.likes,
      replyCount: comment._count.replies,
    })),
    nextCursor: hasMore ? comments[comments.length - 1]?.id : undefined,
  }
}

// コメントへの返信取得
export async function getReplies(commentId: string, cursor?: string, limit = 10) {
  const replies = await prisma.comment.findMany({
    where: { parentId: commentId },
    include: {
      user: {
        select: { id: true, nickname: true, avatarUrl: true },
      },
      _count: {
        select: { likes: true },
      },
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1,
    }),
  })

  const hasMore = replies.length === limit

  return {
    replies: replies.map((reply) => ({
      ...reply,
      likeCount: reply._count.likes,
    })),
    nextCursor: hasMore ? replies[replies.length - 1]?.id : undefined,
  }
}

// コメント数取得
export async function getCommentCount(postId: string) {
  const count = await prisma.comment.count({
    where: { postId },
  })

  return { count }
}
