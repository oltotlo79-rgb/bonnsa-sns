'use server'

import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

// 1日のメッセージ送信上限
const DAILY_MESSAGE_LIMIT = 100

// 会話を開始または取得
export async function getOrCreateConversation(targetUserId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  if (session.user.id === targetUserId) {
    return { error: '自分自身にメッセージを送ることはできません' }
  }

  // ブロックチェック
  const blocked = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: session.user.id, blockedId: targetUserId },
        { blockerId: targetUserId, blockedId: session.user.id },
      ],
    },
  })

  if (blocked) {
    return { error: 'このユーザーにはメッセージを送れません' }
  }

  // 既存の会話を検索
  const existingConversation = await prisma.conversation.findFirst({
    where: {
      AND: [
        { participants: { some: { userId: session.user.id } } },
        { participants: { some: { userId: targetUserId } } },
      ],
    },
  })

  if (existingConversation) {
    return { conversationId: existingConversation.id }
  }

  // 新規会話を作成
  const conversation = await prisma.conversation.create({
    data: {
      participants: {
        create: [
          { userId: session.user.id },
          { userId: targetUserId },
        ],
      },
    },
  })

  return { conversationId: conversation.id }
}

// メッセージ送信
export async function sendMessage(conversationId: string, content: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  if (!content || content.trim().length === 0) {
    return { error: 'メッセージを入力してください' }
  }

  if (content.length > 1000) {
    return { error: 'メッセージは1000文字以内で入力してください' }
  }

  // 会話の参加者かチェック
  const participant = await prisma.conversationParticipant.findUnique({
    where: {
      conversationId_userId: {
        conversationId,
        userId: session.user.id,
      },
    },
  })

  if (!participant) {
    return { error: 'この会話にアクセスする権限がありません' }
  }

  // 1日のメッセージ送信数チェック
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const todayMessageCount = await prisma.message.count({
    where: {
      senderId: session.user.id,
      createdAt: { gte: today },
    },
  })

  if (todayMessageCount >= DAILY_MESSAGE_LIMIT) {
    return { error: '1日のメッセージ送信上限に達しました' }
  }

  // 相手がブロックしていないかチェック
  const otherParticipant = await prisma.conversationParticipant.findFirst({
    where: {
      conversationId,
      userId: { not: session.user.id },
    },
  })

  if (otherParticipant) {
    const blocked = await prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: session.user.id, blockedId: otherParticipant.userId },
          { blockerId: otherParticipant.userId, blockedId: session.user.id },
        ],
      },
    })

    if (blocked) {
      return { error: 'このユーザーにはメッセージを送れません' }
    }
  }

  // メッセージ作成
  const message = await prisma.message.create({
    data: {
      conversationId,
      senderId: session.user.id,
      content: content.trim(),
    },
    include: {
      sender: {
        select: { id: true, nickname: true, avatarUrl: true },
      },
    },
  })

  // 会話のupdatedAtを更新
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  })

  // 相手に通知を作成
  if (otherParticipant) {
    await prisma.notification.create({
      data: {
        userId: otherParticipant.userId,
        actorId: session.user.id,
        type: 'message',
      },
    })
  }

  revalidatePath(`/messages/${conversationId}`)
  revalidatePath('/messages')
  return { success: true, message }
}

// 会話一覧取得
export async function getConversations() {
  const session = await auth()
  if (!session?.user?.id) {
    return { conversations: [] }
  }

  const conversations = await prisma.conversation.findMany({
    where: {
      participants: { some: { userId: session.user.id } },
    },
    include: {
      participants: {
        include: {
          user: {
            select: { id: true, nickname: true, avatarUrl: true },
          },
        },
      },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { updatedAt: 'desc' },
  })

  // 現在のユーザーの参加者情報と相手の情報を整理
  const conversationsWithDetails = conversations.map((conv) => {
    const currentUserParticipant = conv.participants.find(
      (p) => p.userId === session.user.id
    )
    const otherParticipant = conv.participants.find(
      (p) => p.userId !== session.user.id
    )

    const lastMessage = conv.messages[0]
    const unreadCount = lastMessage && currentUserParticipant?.lastReadAt
      ? (lastMessage.createdAt > currentUserParticipant.lastReadAt ? 1 : 0)
      : (lastMessage ? 1 : 0)

    return {
      id: conv.id,
      updatedAt: conv.updatedAt,
      otherUser: otherParticipant?.user || null,
      lastMessage: lastMessage || null,
      hasUnread: unreadCount > 0,
    }
  })

  return { conversations: conversationsWithDetails }
}

// 会話詳細取得
export async function getConversation(conversationId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // 会話の参加者かチェック
  const participant = await prisma.conversationParticipant.findUnique({
    where: {
      conversationId_userId: {
        conversationId,
        userId: session.user.id,
      },
    },
  })

  if (!participant) {
    return { error: 'この会話にアクセスする権限がありません' }
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      participants: {
        include: {
          user: {
            select: { id: true, nickname: true, avatarUrl: true },
          },
        },
      },
    },
  })

  if (!conversation) {
    return { error: '会話が見つかりません' }
  }

  const otherParticipant = conversation.participants.find(
    (p) => p.userId !== session.user.id
  )

  return {
    conversation: {
      id: conversation.id,
      otherUser: otherParticipant?.user || null,
    },
  }
}

// メッセージ取得
export async function getMessages(conversationId: string, cursor?: string, limit = 50) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // 会話の参加者かチェック
  const participant = await prisma.conversationParticipant.findUnique({
    where: {
      conversationId_userId: {
        conversationId,
        userId: session.user.id,
      },
    },
  })

  if (!participant) {
    return { error: 'この会話にアクセスする権限がありません' }
  }

  const messages = await prisma.message.findMany({
    where: { conversationId },
    include: {
      sender: {
        select: { id: true, nickname: true, avatarUrl: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1,
    }),
  })

  // 既読を更新
  await prisma.conversationParticipant.update({
    where: {
      conversationId_userId: {
        conversationId,
        userId: session.user.id,
      },
    },
    data: { lastReadAt: new Date() },
  })

  return {
    messages: messages.reverse(), // 古い順に並べ替え
    nextCursor: messages.length === limit ? messages[0]?.id : undefined,
    currentUserId: session.user.id,
  }
}

// 未読メッセージ数取得
export async function getUnreadMessageCount() {
  const session = await auth()
  if (!session?.user?.id) {
    return { count: 0 }
  }

  // ユーザーが参加している全会話を取得
  const participants = await prisma.conversationParticipant.findMany({
    where: { userId: session.user.id },
    include: {
      conversation: {
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      },
    },
  })

  let unreadCount = 0
  for (const participant of participants) {
    const lastMessage = participant.conversation.messages[0]
    if (lastMessage) {
      // 自分が送ったメッセージは未読カウントしない
      if (lastMessage.senderId === session.user.id) {
        continue
      }
      // 既読時刻より後のメッセージがあれば未読
      if (!participant.lastReadAt || lastMessage.createdAt > participant.lastReadAt) {
        unreadCount++
      }
    }
  }

  return { count: unreadCount }
}

// 既読にする
export async function markAsRead(conversationId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  await prisma.conversationParticipant.update({
    where: {
      conversationId_userId: {
        conversationId,
        userId: session.user.id,
      },
    },
    data: { lastReadAt: new Date() },
  })

  revalidatePath('/messages')
  return { success: true }
}

// メッセージ削除
export async function deleteMessage(messageId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // メッセージを取得
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: {
      id: true,
      senderId: true,
      conversationId: true,
    },
  })

  if (!message) {
    return { error: 'メッセージが見つかりません' }
  }

  // 自分が送ったメッセージのみ削除可能
  if (message.senderId !== session.user.id) {
    return { error: 'このメッセージを削除する権限がありません' }
  }

  // メッセージ削除
  await prisma.message.delete({
    where: { id: messageId },
  })

  revalidatePath(`/messages/${message.conversationId}`)
  revalidatePath('/messages')
  return { success: true }
}
