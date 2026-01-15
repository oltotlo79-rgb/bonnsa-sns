'use server'

import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

/**
 * 管理者権限チェック
 */
async function checkAdminAuth() {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  const adminUser = await prisma.adminUser.findUnique({
    where: { userId: session.user.id },
  })

  if (!adminUser) {
    return { error: '管理者権限が必要です' }
  }

  return { adminUser, userId: session.user.id }
}

/**
 * 有料会員を付与
 */
export async function grantPremium(targetUserId: string, durationDays: number = 30) {
  const authResult = await checkAdminAuth()
  if ('error' in authResult) {
    return authResult
  }

  const { userId: adminId } = authResult

  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
  })

  if (!targetUser) {
    return { error: 'ユーザーが見つかりません' }
  }

  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + durationDays)

  await prisma.user.update({
    where: { id: targetUserId },
    data: {
      isPremium: true,
      premiumExpiresAt: expiresAt,
    },
  })

  // 管理者ログを記録
  await prisma.adminLog.create({
    data: {
      adminId,
      action: 'grant_premium',
      targetType: 'user',
      targetId: targetUserId,
      details: { durationDays, expiresAt: expiresAt.toISOString() },
    },
  })

  revalidatePath('/admin/premium')
  return { success: true, expiresAt }
}

/**
 * 有料会員を取り消し
 */
export async function revokePremium(targetUserId: string) {
  const authResult = await checkAdminAuth()
  if ('error' in authResult) {
    return authResult
  }

  const { userId: adminId } = authResult

  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { isPremium: true },
  })

  if (!targetUser) {
    return { error: 'ユーザーが見つかりません' }
  }

  if (!targetUser.isPremium) {
    return { error: 'このユーザーは有料会員ではありません' }
  }

  await prisma.user.update({
    where: { id: targetUserId },
    data: {
      isPremium: false,
      premiumExpiresAt: null,
      // Stripe連携は残す（再登録時に使用可能）
    },
  })

  // 管理者ログを記録
  await prisma.adminLog.create({
    data: {
      adminId,
      action: 'revoke_premium',
      targetType: 'user',
      targetId: targetUserId,
    },
  })

  revalidatePath('/admin/premium')
  return { success: true }
}

/**
 * 有料会員期限を延長
 */
export async function extendPremium(targetUserId: string, additionalDays: number) {
  const authResult = await checkAdminAuth()
  if ('error' in authResult) {
    return authResult
  }

  const { userId: adminId } = authResult

  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { isPremium: true, premiumExpiresAt: true },
  })

  if (!targetUser) {
    return { error: 'ユーザーが見つかりません' }
  }

  // 現在の期限から延長（期限切れの場合は現在時刻から）
  const baseDate = targetUser.premiumExpiresAt && targetUser.premiumExpiresAt > new Date()
    ? targetUser.premiumExpiresAt
    : new Date()

  const newExpiresAt = new Date(baseDate)
  newExpiresAt.setDate(newExpiresAt.getDate() + additionalDays)

  await prisma.user.update({
    where: { id: targetUserId },
    data: {
      isPremium: true,
      premiumExpiresAt: newExpiresAt,
    },
  })

  // 管理者ログを記録
  await prisma.adminLog.create({
    data: {
      adminId,
      action: 'extend_premium',
      targetType: 'user',
      targetId: targetUserId,
      details: { additionalDays, newExpiresAt: newExpiresAt.toISOString() },
    },
  })

  revalidatePath('/admin/premium')
  return { success: true, newExpiresAt }
}

/**
 * 有料会員一覧を取得
 */
export async function getPremiumUsers(options: { search?: string; limit?: number; offset?: number } = {}) {
  const authResult = await checkAdminAuth()
  if ('error' in authResult) {
    return { error: authResult.error }
  }

  const { search, limit = 20, offset = 0 } = options

  const where = {
    isPremium: true,
    ...(search && {
      OR: [
        { email: { contains: search, mode: 'insensitive' as const } },
        { nickname: { contains: search, mode: 'insensitive' as const } },
      ],
    }),
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        nickname: true,
        avatarUrl: true,
        isPremium: true,
        premiumExpiresAt: true,
        stripeSubscriptionId: true,
        createdAt: true,
      },
      orderBy: { premiumExpiresAt: 'asc' },
      take: limit,
      skip: offset,
    }),
    prisma.user.count({ where }),
  ])

  return { users, total }
}

/**
 * 有料会員の統計情報を取得
 */
export async function getPremiumStats() {
  const authResult = await checkAdminAuth()
  if ('error' in authResult) {
    return { error: authResult.error }
  }

  const now = new Date()
  const sevenDaysLater = new Date()
  sevenDaysLater.setDate(sevenDaysLater.getDate() + 7)

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const [totalPremiumUsers, expiringIn7Days, newThisMonth, totalPayments] = await Promise.all([
    // 有料会員総数
    prisma.user.count({
      where: { isPremium: true },
    }),
    // 7日以内に期限切れになるユーザー
    prisma.user.count({
      where: {
        isPremium: true,
        premiumExpiresAt: {
          gte: now,
          lte: sevenDaysLater,
        },
      },
    }),
    // 今月の新規有料会員
    prisma.user.count({
      where: {
        isPremium: true,
        createdAt: { gte: monthStart },
      },
    }),
    // 総支払い額（成功分のみ）
    prisma.payment.aggregate({
      where: { status: 'succeeded' },
      _sum: { amount: true },
    }),
  ])

  return {
    totalPremiumUsers,
    newThisMonth,
    expiringIn7Days,
    totalRevenue: totalPayments._sum.amount || 0,
  }
}

/**
 * ユーザーを検索してプレミアム状態を確認
 */
export async function searchUserForPremium(query: string) {
  const authResult = await checkAdminAuth()
  if ('error' in authResult) {
    return authResult
  }

  if (!query || query.length < 2) {
    return { users: [] }
  }

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { email: { contains: query, mode: 'insensitive' } },
        { nickname: { contains: query, mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      email: true,
      nickname: true,
      avatarUrl: true,
      isPremium: true,
      premiumExpiresAt: true,
    },
    take: 10,
  })

  return { users }
}
