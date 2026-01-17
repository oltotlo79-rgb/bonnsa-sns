'use server'

import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { sanitizePostContent } from '@/lib/sanitize'

// コメント作成
export async function createComment(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  const postId = formData.get('postId') as string
  const parentId = formData.get('parentId') as string | null
  const rawContent = formData.get('content') as string
  const content = sanitizePostContent(rawContent)
  const mediaUrls = formData.getAll('mediaUrls') as string[]
  const mediaTypes = formData.getAll('mediaTypes') as string[]

  // バリデーション
  if ((!content || content.length === 0) && mediaUrls.length === 0) {
    return { error: 'コメント内容またはメディアを入力してください' }
  }

  if (content && content.length > 500) {
    return { error: 'コメントは500文字以内で入力してください' }
  }

  // メディアバリデーション（画像2枚まで、動画1本まで、混在OK）
  const imageCount = mediaTypes.filter((t: string) => t === 'image').length
  const videoCount = mediaTypes.filter((t: string) => t === 'video').length
  if (imageCount > 2) {
    return { error: '画像は2枚までです' }
  }
  if (videoCount > 1) {
    return { error: '動画は1本までです' }
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
      content: content?.trim() || '',
      media: mediaUrls.length > 0 ? {
        create: mediaUrls.map((url: string, index: number) => ({
          url,
          type: mediaTypes[index] || 'image',
          sortOrder: index,
        })),
      } : undefined,
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
  const session = await auth()
  const currentUserId = session?.user?.id

  // ブロックしているユーザーのIDを取得
  let blockedUserIds: string[] = []
  if (currentUserId) {
    const blockedUsers = await prisma.block.findMany({
      where: { blockerId: currentUserId },
      select: { blockedId: true },
    })
    blockedUserIds = blockedUsers.map((b: { blockedId: string }) => b.blockedId)
  }

  const comments = await prisma.comment.findMany({
    where: {
      postId,
      parentId: null, // 親コメントのみ
      isHidden: false, // 非表示コメントを除外
      // ブロックしているユーザーのコメントを除外
      ...(blockedUserIds.length > 0 && {
        userId: { notIn: blockedUserIds },
      }),
    },
    include: {
      user: {
        select: { id: true, nickname: true, avatarUrl: true },
      },
      media: {
        orderBy: { sortOrder: 'asc' },
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

  // 現在のユーザーがいいねしているかチェック
  let likedCommentIds: Set<string> = new Set()
  if (currentUserId && comments.length > 0) {
    const userLikes = await prisma.like.findMany({
      where: {
        userId: currentUserId,
        commentId: { in: comments.map((c: typeof comments[number]) => c.id) },
      },
      select: { commentId: true },
    })
    likedCommentIds = new Set(userLikes.map((l: { commentId: string | null }) => l.commentId).filter((id: string | null): id is string => id !== null))
  }

  const hasMore = comments.length === limit

  return {
    comments: comments.map((comment: typeof comments[number]) => ({
      ...comment,
      likeCount: comment._count.likes,
      replyCount: comment._count.replies,
      isLiked: likedCommentIds.has(comment.id),
    })),
    nextCursor: hasMore ? comments[comments.length - 1]?.id : undefined,
  }
}

// コメントへの返信取得
export async function getReplies(commentId: string, cursor?: string, limit = 10) {
  const session = await auth()
  const currentUserId = session?.user?.id

  // ブロックしているユーザーのIDを取得
  let blockedUserIds: string[] = []
  if (currentUserId) {
    const blockedUsers = await prisma.block.findMany({
      where: { blockerId: currentUserId },
      select: { blockedId: true },
    })
    blockedUserIds = blockedUsers.map((b: { blockedId: string }) => b.blockedId)
  }

  const replies = await prisma.comment.findMany({
    where: {
      parentId: commentId,
      isHidden: false, // 非表示コメントを除外
      // ブロックしているユーザーの返信を除外
      ...(blockedUserIds.length > 0 && {
        userId: { notIn: blockedUserIds },
      }),
    },
    include: {
      user: {
        select: { id: true, nickname: true, avatarUrl: true },
      },
      media: {
        orderBy: { sortOrder: 'asc' },
      },
      _count: {
        select: { likes: true, replies: true },
      },
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1,
    }),
  })

  // 現在のユーザーがいいねしているかチェック
  let likedReplyIds: Set<string> = new Set()
  if (currentUserId && replies.length > 0) {
    const userLikes = await prisma.like.findMany({
      where: {
        userId: currentUserId,
        commentId: { in: replies.map((r: typeof replies[number]) => r.id) },
      },
      select: { commentId: true },
    })
    likedReplyIds = new Set(userLikes.map((l: { commentId: string | null }) => l.commentId).filter((id: string | null): id is string => id !== null))
  }

  const hasMore = replies.length === limit

  return {
    replies: replies.map((reply: typeof replies[number]) => ({
      ...reply,
      likeCount: reply._count.likes,
      replyCount: reply._count.replies,
      isLiked: likedReplyIds.has(reply.id),
    })),
    nextCursor: hasMore ? replies[replies.length - 1]?.id : undefined,
  }
}

// コメント数取得
export async function getCommentCount(postId: string) {
  const count = await prisma.comment.count({
    where: { postId, isHidden: false },
  })

  return { count }
}

// コメント用メディアアップロード
export async function uploadCommentMedia(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  const file = formData.get('file') as File
  if (!file) {
    return { error: 'ファイルが選択されていません' }
  }

  const isVideo = file.type.startsWith('video/')
  const isImage = file.type.startsWith('image/')

  if (!isVideo && !isImage) {
    return { error: '画像または動画ファイルを選択してください' }
  }

  // ファイルサイズチェック（コメント用は投稿より小さめに）
  const maxSize = isVideo ? 100 * 1024 * 1024 : 5 * 1024 * 1024
  if (file.size > maxSize) {
    return { error: isVideo ? '動画は100MB以下にしてください' : '画像は5MB以下にしてください' }
  }

  // ストレージにアップロード
  const { uploadFile } = await import('@/lib/storage')
  const buffer = Buffer.from(await file.arrayBuffer())
  const folder = isVideo ? 'comment-videos' : 'comment-images'

  const result = await uploadFile(buffer, file.name, file.type, folder)

  if (!result.success || !result.url) {
    return { error: result.error || 'アップロードに失敗しました' }
  }

  return {
    success: true,
    url: result.url,
    type: isVideo ? 'video' : 'image',
  }
}
