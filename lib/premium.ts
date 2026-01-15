import { prisma } from '@/lib/db'

export type MembershipType = 'free' | 'premium'

export interface MembershipLimits {
  maxPostLength: number
  maxImages: number
  maxVideos: number
  canSchedulePost: boolean
  canViewAnalytics: boolean
}

const FREE_LIMITS: MembershipLimits = {
  maxPostLength: 500,
  maxImages: 4,
  maxVideos: 2,
  canSchedulePost: false,
  canViewAnalytics: false,
}

const PREMIUM_LIMITS: MembershipLimits = {
  maxPostLength: 2000,
  maxImages: 6,
  maxVideos: 3,
  canSchedulePost: true,
  canViewAnalytics: true,
}

/**
 * ユーザーが有料会員かどうかを判定
 * 期限切れの場合は自動的にフラグを更新
 */
export async function isPremiumUser(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isPremium: true, premiumExpiresAt: true },
  })

  if (!user || !user.isPremium) return false

  // 期限切れチェック
  if (user.premiumExpiresAt && user.premiumExpiresAt < new Date()) {
    // 期限切れの場合はフラグを更新
    await prisma.user.update({
      where: { id: userId },
      data: { isPremium: false },
    })
    return false
  }

  return true
}

/**
 * 会員種別に応じた制限値を取得
 */
export async function getMembershipLimits(userId: string): Promise<MembershipLimits> {
  const isPremium = await isPremiumUser(userId)
  return isPremium ? PREMIUM_LIMITS : FREE_LIMITS
}

/**
 * 会員種別を取得
 */
export async function getMembershipType(userId: string): Promise<MembershipType> {
  const isPremium = await isPremiumUser(userId)
  return isPremium ? 'premium' : 'free'
}

/**
 * 有料会員の期限情報を取得
 */
export async function getPremiumStatus(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      isPremium: true,
      premiumExpiresAt: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
    },
  })

  if (!user) {
    return null
  }

  return {
    isPremium: user.isPremium,
    premiumExpiresAt: user.premiumExpiresAt,
    hasStripeSubscription: !!user.stripeSubscriptionId,
  }
}

/**
 * 期限切れの有料会員を一括で無効化（バッチ処理用）
 */
export async function checkPremiumExpiry(): Promise<number> {
  const result = await prisma.user.updateMany({
    where: {
      isPremium: true,
      premiumExpiresAt: {
        lt: new Date(),
      },
    },
    data: {
      isPremium: false,
    },
  })

  return result.count
}

/**
 * 制限値の定数をエクスポート
 */
export { FREE_LIMITS, PREMIUM_LIMITS }
