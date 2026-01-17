'use server'

import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

type ContentType = 'post' | 'comment' | 'event' | 'shop' | 'review'

// 管理者権限チェック
async function checkAdminAuth() {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です', adminId: null }
  }

  const adminUser = await prisma.adminUser.findUnique({
    where: { userId: session.user.id },
  })

  if (!adminUser) {
    return { error: '管理者権限が必要です', adminId: null }
  }

  return { error: null, adminId: adminUser.userId }
}

// 非表示コンテンツ一覧取得
export async function getHiddenContent(options?: {
  type?: ContentType
  limit?: number
  offset?: number
}) {
  const authResult = await checkAdminAuth()
  if (authResult.error) {
    return { error: authResult.error }
  }

  const { type, limit = 50, offset = 0 } = options || {}

  // 各コンテンツタイプの非表示アイテムを取得
  const results: {
    type: ContentType
    id: string
    content: string | null
    createdBy: { id: string; nickname: string; avatarUrl: string | null }
    hiddenAt: Date | null
    reportCount: number
  }[] = []

  // 投稿
  if (!type || type === 'post') {
    const hiddenPosts = await prisma.post.findMany({
      where: { isHidden: true },
      include: {
        user: {
          select: { id: true, nickname: true, avatarUrl: true },
        },
        _count: {
          select: { likes: true, comments: true },
        },
      },
      orderBy: { hiddenAt: 'desc' },
      take: type ? limit : 10,
      skip: type ? offset : 0,
    })

    for (const post of hiddenPosts) {
      const reportCount = await prisma.report.count({
        where: { targetType: 'post', targetId: post.id },
      })
      results.push({
        type: 'post',
        id: post.id,
        content: post.content,
        createdBy: post.user,
        hiddenAt: post.hiddenAt,
        reportCount,
      })
    }
  }

  // コメント
  if (!type || type === 'comment') {
    const hiddenComments = await prisma.comment.findMany({
      where: { isHidden: true },
      include: {
        user: {
          select: { id: true, nickname: true, avatarUrl: true },
        },
        post: {
          select: { id: true },
        },
      },
      orderBy: { hiddenAt: 'desc' },
      take: type ? limit : 10,
      skip: type ? offset : 0,
    })

    for (const comment of hiddenComments) {
      const reportCount = await prisma.report.count({
        where: { targetType: 'comment', targetId: comment.id },
      })
      results.push({
        type: 'comment',
        id: comment.id,
        content: comment.content,
        createdBy: comment.user,
        hiddenAt: comment.hiddenAt,
        reportCount,
      })
    }
  }

  // イベント
  if (!type || type === 'event') {
    const hiddenEvents = await prisma.event.findMany({
      where: { isHidden: true },
      include: {
        creator: {
          select: { id: true, nickname: true, avatarUrl: true },
        },
      },
      orderBy: { hiddenAt: 'desc' },
      take: type ? limit : 10,
      skip: type ? offset : 0,
    })

    for (const event of hiddenEvents) {
      const reportCount = await prisma.report.count({
        where: { targetType: 'event', targetId: event.id },
      })
      results.push({
        type: 'event',
        id: event.id,
        content: `${event.title}${event.description ? `: ${event.description}` : ''}`,
        createdBy: event.creator,
        hiddenAt: event.hiddenAt,
        reportCount,
      })
    }
  }

  // 盆栽園
  if (!type || type === 'shop') {
    const hiddenShops = await prisma.bonsaiShop.findMany({
      where: { isHidden: true },
      include: {
        creator: {
          select: { id: true, nickname: true, avatarUrl: true },
        },
      },
      orderBy: { hiddenAt: 'desc' },
      take: type ? limit : 10,
      skip: type ? offset : 0,
    })

    for (const shop of hiddenShops) {
      const reportCount = await prisma.report.count({
        where: { targetType: 'shop', targetId: shop.id },
      })
      results.push({
        type: 'shop',
        id: shop.id,
        content: `${shop.name} (${shop.address})`,
        createdBy: shop.creator,
        hiddenAt: shop.hiddenAt,
        reportCount,
      })
    }
  }

  // レビュー
  if (!type || type === 'review') {
    const hiddenReviews = await prisma.shopReview.findMany({
      where: { isHidden: true },
      include: {
        user: {
          select: { id: true, nickname: true, avatarUrl: true },
        },
        shop: {
          select: { name: true },
        },
      },
      orderBy: { hiddenAt: 'desc' },
      take: type ? limit : 10,
      skip: type ? offset : 0,
    })

    for (const review of hiddenReviews) {
      const reportCount = await prisma.report.count({
        where: { targetType: 'review', targetId: review.id },
      })
      results.push({
        type: 'review',
        id: review.id,
        content: `${review.shop.name}へのレビュー: ${review.content || '(コメントなし)'}`,
        createdBy: review.user,
        hiddenAt: review.hiddenAt,
        reportCount,
      })
    }
  }

  // 非表示日時でソート
  results.sort((a: typeof results[number], b: typeof results[number]) => {
    if (!a.hiddenAt || !b.hiddenAt) return 0
    return b.hiddenAt.getTime() - a.hiddenAt.getTime()
  })

  return { items: results }
}

// コンテンツを再表示
export async function restoreContent(type: ContentType, id: string) {
  const authResult = await checkAdminAuth()
  if (authResult.error || !authResult.adminId) {
    return { error: authResult.error || '認証エラー' }
  }

  switch (type) {
    case 'post':
      await prisma.post.update({
        where: { id },
        data: { isHidden: false, hiddenAt: null },
      })
      break
    case 'comment':
      await prisma.comment.update({
        where: { id },
        data: { isHidden: false, hiddenAt: null },
      })
      break
    case 'event':
      await prisma.event.update({
        where: { id },
        data: { isHidden: false, hiddenAt: null },
      })
      break
    case 'shop':
      await prisma.bonsaiShop.update({
        where: { id },
        data: { isHidden: false, hiddenAt: null },
      })
      break
    case 'review':
      await prisma.shopReview.update({
        where: { id },
        data: { isHidden: false, hiddenAt: null },
      })
      break
  }

  // 関連する通報のステータスを更新
  await prisma.report.updateMany({
    where: { targetType: type, targetId: id },
    data: { status: 'resolved' },
  })

  // 管理者通知を解決済みに
  await prisma.adminNotification.updateMany({
    where: { targetType: type, targetId: id, isResolved: false },
    data: { isResolved: true, resolvedAt: new Date() },
  })

  // 管理ログに記録
  await prisma.adminLog.create({
    data: {
      adminId: authResult.adminId,
      action: 'restore_content',
      targetType: type,
      targetId: id,
    },
  })

  revalidatePath('/admin/hidden')
  return { success: true }
}

// コンテンツを完全削除
export async function deleteHiddenContent(type: ContentType, id: string) {
  const authResult = await checkAdminAuth()
  if (authResult.error || !authResult.adminId) {
    return { error: authResult.error || '認証エラー' }
  }

  switch (type) {
    case 'post':
      await prisma.post.delete({ where: { id } })
      break
    case 'comment':
      await prisma.comment.delete({ where: { id } })
      break
    case 'event':
      await prisma.event.delete({ where: { id } })
      break
    case 'shop':
      await prisma.bonsaiShop.delete({ where: { id } })
      break
    case 'review':
      await prisma.shopReview.delete({ where: { id } })
      break
  }

  // 関連する通報を削除
  await prisma.report.deleteMany({
    where: { targetType: type, targetId: id },
  })

  // 管理者通知を解決済みに
  await prisma.adminNotification.updateMany({
    where: { targetType: type, targetId: id, isResolved: false },
    data: { isResolved: true, resolvedAt: new Date() },
  })

  // 管理ログに記録
  await prisma.adminLog.create({
    data: {
      adminId: authResult.adminId,
      action: 'delete_hidden_content',
      targetType: type,
      targetId: id,
    },
  })

  revalidatePath('/admin/hidden')
  return { success: true }
}

// 管理者通知一覧取得
export async function getAdminNotifications(options?: {
  unreadOnly?: boolean
  limit?: number
}) {
  const authResult = await checkAdminAuth()
  if (authResult.error) {
    return { error: authResult.error }
  }

  const { unreadOnly = false, limit = 20 } = options || {}

  const notifications = await prisma.adminNotification.findMany({
    where: {
      ...(unreadOnly && { isRead: false }),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  const unreadCount = await prisma.adminNotification.count({
    where: { isRead: false },
  })

  return { notifications, unreadCount }
}

// 管理者通知を既読に
export async function markAdminNotificationAsRead(notificationId: string) {
  const authResult = await checkAdminAuth()
  if (authResult.error) {
    return { error: authResult.error }
  }

  await prisma.adminNotification.update({
    where: { id: notificationId },
    data: { isRead: true },
  })

  revalidatePath('/admin/hidden')
  return { success: true }
}

// 全ての管理者通知を既読に
export async function markAllAdminNotificationsAsRead() {
  const authResult = await checkAdminAuth()
  if (authResult.error) {
    return { error: authResult.error }
  }

  await prisma.adminNotification.updateMany({
    where: { isRead: false },
    data: { isRead: true },
  })

  revalidatePath('/admin/hidden')
  return { success: true }
}
