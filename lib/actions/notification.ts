'use server'

import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export type NotificationType = 'like' | 'comment' | 'follow' | 'quote' | 'reply' | 'comment_like'

export async function getNotifications(cursor?: string, limit = 20) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です', notifications: [], nextCursor: undefined }
  }

  // ミュートしているユーザーを取得
  const mutes = await prisma.mute.findMany({
    where: { muterId: session.user.id },
    select: { mutedId: true },
  })
  const mutedUserIds = mutes.map((m: { mutedId: string }) => m.mutedId)

  const notifications = await prisma.notification.findMany({
    where: {
      userId: session.user.id,
      // ミュートしているユーザーからの通知を除外
      ...(mutedUserIds.length > 0 && {
        actorId: {
          notIn: mutedUserIds,
        },
      }),
    },
    include: {
      actor: {
        select: { id: true, nickname: true, avatarUrl: true },
      },
      post: {
        select: { id: true, content: true },
      },
      comment: {
        select: { id: true, content: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1,
    }),
  })

  return {
    notifications,
    nextCursor: notifications.length === limit ? notifications[notifications.length - 1]?.id : undefined,
  }
}

export async function markAsRead(notificationId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  await prisma.notification.update({
    where: {
      id: notificationId,
      userId: session.user.id,
    },
    data: { isRead: true },
  })

  revalidatePath('/notifications')
  return { success: true }
}

export async function markAllAsRead() {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  await prisma.notification.updateMany({
    where: {
      userId: session.user.id,
      isRead: false,
    },
    data: { isRead: true },
  })

  revalidatePath('/notifications')
  return { success: true }
}

export async function getUnreadCount() {
  const session = await auth()
  if (!session?.user?.id) {
    return { count: 0 }
  }

  // ミュートしているユーザーを取得
  const mutes = await prisma.mute.findMany({
    where: { muterId: session.user.id },
    select: { mutedId: true },
  })
  const mutedUserIds = mutes.map((m: { mutedId: string }) => m.mutedId)

  const count = await prisma.notification.count({
    where: {
      userId: session.user.id,
      isRead: false,
      // ミュートしているユーザーからの通知を除外
      ...(mutedUserIds.length > 0 && {
        actorId: {
          notIn: mutedUserIds,
        },
      }),
    },
  })

  return { count }
}

export async function createNotification({
  userId,
  actorId,
  type,
  postId,
  commentId,
}: {
  userId: string
  actorId: string
  type: NotificationType
  postId?: string
  commentId?: string
}) {
  // 自分自身への通知は作成しない
  if (userId === actorId) {
    return { success: true }
  }

  // ブロック関係をチェック
  const block = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: userId, blockedId: actorId },
        { blockerId: actorId, blockedId: userId },
      ],
    },
  })

  if (block) {
    return { success: true }
  }

  // 重複通知チェック（同じタイプ、同じアクター、同じ投稿/コメントの場合はスキップ）
  const existingNotification = await prisma.notification.findFirst({
    where: {
      userId,
      actorId,
      type,
      postId: postId || null,
      commentId: commentId || null,
    },
  })

  if (existingNotification) {
    return { success: true }
  }

  await prisma.notification.create({
    data: {
      userId,
      actorId,
      type,
      postId,
      commentId,
    },
  })

  return { success: true }
}

export async function deleteNotification({
  userId,
  actorId,
  type,
  postId,
  commentId,
}: {
  userId: string
  actorId: string
  type: NotificationType
  postId?: string
  commentId?: string
}) {
  await prisma.notification.deleteMany({
    where: {
      userId,
      actorId,
      type,
      postId: postId || null,
      commentId: commentId || null,
    },
  })

  return { success: true }
}
