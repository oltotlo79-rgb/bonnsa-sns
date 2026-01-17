'use server'

import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

// 管理者権限チェック
async function checkAdminPermission() {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error('認証が必要です')
  }

  const adminUser = await prisma.adminUser.findUnique({
    where: { userId: session.user.id },
  })

  if (!adminUser) {
    throw new Error('管理者権限が必要です')
  }

  return { user: session.user, adminUser }
}

// 管理者統計情報取得
export async function getAdminStats() {
  await checkAdminPermission()

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  weekAgo.setHours(0, 0, 0, 0)

  const [
    totalUsers,
    todayUsers,
    totalPosts,
    todayPosts,
    pendingReports,
    totalEvents,
    totalShops,
    activeUsersWeek,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({
      where: { createdAt: { gte: today } },
    }),
    prisma.post.count(),
    prisma.post.count({
      where: { createdAt: { gte: today } },
    }),
    prisma.report.count({
      where: { status: 'pending' },
    }),
    prisma.event.count(),
    prisma.bonsaiShop.count(),
    prisma.user.count({
      where: {
        posts: {
          some: {
            createdAt: { gte: weekAgo },
          },
        },
      },
    }),
  ])

  return {
    totalUsers,
    todayUsers,
    totalPosts,
    todayPosts,
    pendingReports,
    totalEvents,
    totalShops,
    activeUsersWeek,
  }
}

// ユーザー一覧取得
export async function getAdminUsers(options?: {
  search?: string
  status?: 'all' | 'active' | 'suspended'
  sortBy?: 'createdAt' | 'postCount' | 'nickname'
  sortOrder?: 'asc' | 'desc'
  limit?: number
  offset?: number
}) {
  await checkAdminPermission()

  const {
    search,
    status = 'all',
    sortBy = 'createdAt',
    sortOrder = 'desc',
    limit = 20,
    offset = 0,
  } = options || {}

  const where = {
    ...(search && {
      OR: [
        { nickname: { contains: search } },
        { email: { contains: search } },
      ],
    }),
    ...(status === 'suspended' && { isSuspended: true }),
    ...(status === 'active' && { isSuspended: false }),
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        nickname: true,
        avatarUrl: true,
        createdAt: true,
        isSuspended: true,
        suspendedAt: true,
        _count: {
          select: { posts: true },
        },
      },
      orderBy:
        sortBy === 'postCount'
          ? { posts: { _count: sortOrder } }
          : { [sortBy]: sortOrder },
      take: limit,
      skip: offset,
    }),
    prisma.user.count({ where }),
  ])

  return { users, total }
}

// ユーザー詳細取得
export async function getAdminUserDetail(userId: string) {
  await checkAdminPermission()

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      _count: {
        select: {
          posts: true,
          comments: true,
          followers: true,
          following: true,
        },
      },
    },
  })

  if (!user) {
    return { error: 'ユーザーが見つかりません' }
  }

  // 通報件数
  const reportCount = await prisma.report.count({
    where: {
      OR: [
        { targetType: 'user', targetId: userId },
        {
          targetType: 'post',
          targetId: {
            in: (
              await prisma.post.findMany({
                where: { userId },
                select: { id: true },
              })
            ).map((p: { id: string }) => p.id),
          },
        },
      ],
    },
  })

  return { user, reportCount }
}

// ユーザー停止
export async function suspendUser(userId: string, reason: string) {
  const { adminUser } = await checkAdminPermission()

  const user = await prisma.user.findUnique({
    where: { id: userId },
  })

  if (!user) {
    return { error: 'ユーザーが見つかりません' }
  }

  if (user.isSuspended) {
    return { error: 'このユーザーは既に停止されています' }
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        isSuspended: true,
        suspendedAt: new Date(),
      },
    }),
    prisma.adminLog.create({
      data: {
        adminId: adminUser.userId,
        action: 'suspend_user',
        targetType: 'user',
        targetId: userId,
        details: JSON.stringify({ reason }),
      },
    }),
  ])

  revalidatePath('/admin/users')
  return { success: true }
}

// ユーザー復帰
export async function activateUser(userId: string) {
  const { adminUser } = await checkAdminPermission()

  const user = await prisma.user.findUnique({
    where: { id: userId },
  })

  if (!user) {
    return { error: 'ユーザーが見つかりません' }
  }

  if (!user.isSuspended) {
    return { error: 'このユーザーは停止されていません' }
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        isSuspended: false,
        suspendedAt: null,
      },
    }),
    prisma.adminLog.create({
      data: {
        adminId: adminUser.userId,
        action: 'activate_user',
        targetType: 'user',
        targetId: userId,
        details: JSON.stringify({}),
      },
    }),
  ])

  revalidatePath('/admin/users')
  return { success: true }
}

// 投稿一覧取得
export async function getAdminPosts(options?: {
  search?: string
  hasReports?: boolean
  sortBy?: 'createdAt' | 'likeCount' | 'reportCount'
  sortOrder?: 'asc' | 'desc'
  limit?: number
  offset?: number
}) {
  await checkAdminPermission()

  const {
    search,
    hasReports = false,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    limit = 20,
    offset = 0,
  } = options || {}

  // 通報された投稿ID
  let reportedPostIds: string[] = []
  if (hasReports) {
    const reports = await prisma.report.findMany({
      where: { targetType: 'post' },
      select: { targetId: true },
      distinct: ['targetId'],
    })
    reportedPostIds = reports.map((r) => r.targetId)
  }

  const where = {
    ...(search && {
      content: { contains: search },
    }),
    ...(hasReports && {
      id: { in: reportedPostIds },
    }),
  }

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where,
      select: {
        id: true,
        content: true,
        createdAt: true,
        user: {
          select: { id: true, nickname: true, avatarUrl: true },
        },
        _count: {
          select: { likes: true, comments: true },
        },
      },
      orderBy:
        sortBy === 'likeCount'
          ? { likes: { _count: sortOrder } }
          : { [sortBy]: sortOrder },
      take: limit,
      skip: offset,
    }),
    prisma.post.count({ where }),
  ])

  // 通報件数を追加
  const postsWithReportCount = await Promise.all(
    posts.map(async (post) => {
      const reportCount = await prisma.report.count({
        where: { targetType: 'post', targetId: post.id },
      })
      return { ...post, reportCount }
    })
  )

  return { posts: postsWithReportCount, total }
}

// 投稿削除（管理者）
export async function deletePostByAdmin(postId: string, reason: string) {
  const { adminUser } = await checkAdminPermission()

  const post = await prisma.post.findUnique({
    where: { id: postId },
  })

  if (!post) {
    return { error: '投稿が見つかりません' }
  }

  await prisma.$transaction([
    prisma.post.delete({
      where: { id: postId },
    }),
    prisma.adminLog.create({
      data: {
        adminId: adminUser.userId,
        action: 'delete_post',
        targetType: 'post',
        targetId: postId,
        details: JSON.stringify({ reason }),
      },
    }),
  ])

  revalidatePath('/admin/posts')
  return { success: true }
}

// イベント削除（管理者）
export async function deleteEventByAdmin(eventId: string, reason: string) {
  const { adminUser } = await checkAdminPermission()

  const event = await prisma.event.findUnique({
    where: { id: eventId },
  })

  if (!event) {
    return { error: 'イベントが見つかりません' }
  }

  await prisma.$transaction([
    prisma.event.delete({
      where: { id: eventId },
    }),
    prisma.adminLog.create({
      data: {
        adminId: adminUser.userId,
        action: 'delete_event',
        targetType: 'event',
        targetId: eventId,
        details: JSON.stringify({ reason }),
      },
    }),
  ])

  revalidatePath('/admin/events')
  return { success: true }
}

// 盆栽園削除（管理者）
export async function deleteShopByAdmin(shopId: string, reason: string) {
  const { adminUser } = await checkAdminPermission()

  const shop = await prisma.bonsaiShop.findUnique({
    where: { id: shopId },
  })

  if (!shop) {
    return { error: '盆栽園が見つかりません' }
  }

  await prisma.$transaction([
    prisma.bonsaiShop.delete({
      where: { id: shopId },
    }),
    prisma.adminLog.create({
      data: {
        adminId: adminUser.userId,
        action: 'delete_shop',
        targetType: 'shop',
        targetId: shopId,
        details: JSON.stringify({ reason }),
      },
    }),
  ])

  revalidatePath('/admin/shops')
  return { success: true }
}

// 管理者ログ取得
export async function getAdminLogs(options?: {
  action?: string
  limit?: number
  offset?: number
}) {
  await checkAdminPermission()

  const { action, limit = 50, offset = 0 } = options || {}

  const [logs, total] = await Promise.all([
    prisma.adminLog.findMany({
      where: action ? { action } : undefined,
      include: {
        admin: {
          include: {
            user: {
              select: { id: true, nickname: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.adminLog.count({
      where: action ? { action } : undefined,
    }),
  ])

  return { logs, total }
}

// 管理者権限チェック（ページ用）
export async function isAdmin() {
  const session = await auth()
  if (!session?.user?.id) {
    return false
  }

  const adminUser = await prisma.adminUser.findUnique({
    where: { userId: session.user.id },
  })

  return !!adminUser
}

// 管理者情報取得
export async function getAdminInfo() {
  const session = await auth()
  if (!session?.user?.id) {
    return null
  }

  const adminUser = await prisma.adminUser.findUnique({
    where: { userId: session.user.id },
  })

  if (!adminUser) {
    return null
  }

  return {
    userId: session.user.id,
    role: adminUser.role,
  }
}

// ユーザー削除（管理者）
export async function deleteUserByAdmin(userId: string, reason: string) {
  const { adminUser } = await checkAdminPermission()

  const user = await prisma.user.findUnique({
    where: { id: userId },
  })

  if (!user) {
    return { error: 'ユーザーが見つかりません' }
  }

  // 自分自身は削除不可
  if (userId === adminUser.userId) {
    return { error: '自分自身を削除することはできません' }
  }

  // 管理者かどうかチェック
  const targetAdminUser = await prisma.adminUser.findUnique({
    where: { userId },
  })

  if (targetAdminUser) {
    return { error: '管理者ユーザーは削除できません' }
  }

  await prisma.$transaction([
    // ユーザー削除（関連データはカスケード削除）
    prisma.user.delete({
      where: { id: userId },
    }),
    prisma.adminLog.create({
      data: {
        adminId: adminUser.userId,
        action: 'delete_user',
        targetType: 'user',
        targetId: userId,
        details: JSON.stringify({ reason, deletedEmail: user.email, deletedNickname: user.nickname }),
      },
    }),
  ])

  revalidatePath('/admin/users')
  return { success: true }
}

// DAU（デイリーアクティブユーザー）取得
export async function getDailyActiveUsers() {
  await checkAdminPermission()

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // 今日投稿またはコメントしたユーザー数
  const activeUsers = await prisma.user.count({
    where: {
      OR: [
        {
          posts: {
            some: {
              createdAt: { gte: today },
            },
          },
        },
        {
          comments: {
            some: {
              createdAt: { gte: today },
            },
          },
        },
      ],
    },
  })

  return activeUsers
}

// 統計データ取得（グラフ用）
export async function getStatsHistory(days: number = 30) {
  await checkAdminPermission()

  const results: {
    date: string
    users: number
    posts: number
    comments: number
  }[] = []

  // 過去N日分のデータを取得
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    date.setHours(0, 0, 0, 0)

    const nextDate = new Date(date)
    nextDate.setDate(nextDate.getDate() + 1)

    const [usersCount, postsCount, commentsCount] = await Promise.all([
      // その日までの累計ユーザー数
      prisma.user.count({
        where: { createdAt: { lt: nextDate } },
      }),
      // その日の投稿数
      prisma.post.count({
        where: {
          createdAt: { gte: date, lt: nextDate },
        },
      }),
      // その日のコメント数
      prisma.comment.count({
        where: {
          createdAt: { gte: date, lt: nextDate },
        },
      }),
    ])

    results.push({
      date: date.toISOString().split('T')[0],
      users: usersCount,
      posts: postsCount,
      comments: commentsCount,
    })
  }

  return results
}

// 期間別統計サマリー取得
export async function getStatsSummary() {
  await checkAdminPermission()

  const now = new Date()
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)

  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const weekAgo = new Date(today)
  weekAgo.setDate(weekAgo.getDate() - 7)

  const monthAgo = new Date(today)
  monthAgo.setMonth(monthAgo.getMonth() - 1)

  const [
    totalUsers,
    todayUsers,
    weekUsers,
    monthUsers,
    totalPosts,
    todayPosts,
    weekPosts,
    monthPosts,
    totalComments,
    todayComments,
    weekComments,
    monthComments,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: today } } }),
    prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.user.count({ where: { createdAt: { gte: monthAgo } } }),
    prisma.post.count(),
    prisma.post.count({ where: { createdAt: { gte: today } } }),
    prisma.post.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.post.count({ where: { createdAt: { gte: monthAgo } } }),
    prisma.comment.count(),
    prisma.comment.count({ where: { createdAt: { gte: today } } }),
    prisma.comment.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.comment.count({ where: { createdAt: { gte: monthAgo } } }),
  ])

  return {
    users: { total: totalUsers, today: todayUsers, week: weekUsers, month: monthUsers },
    posts: { total: totalPosts, today: todayPosts, week: weekPosts, month: monthPosts },
    comments: { total: totalComments, today: todayComments, week: weekComments, month: monthComments },
  }
}
