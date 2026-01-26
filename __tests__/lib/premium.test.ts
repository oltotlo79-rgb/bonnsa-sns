/**
 * @jest-environment node
 */

// Prismaモックをjest.mock内で定義（hoisting対策）
jest.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}))

// モックへの参照を取得
import { prisma } from '@/lib/db'
const mockPrisma = prisma as jest.Mocked<typeof prisma>

import {
  isPremiumUser,
  getMembershipLimits,
  getMembershipType,
  getPremiumStatus,
  checkPremiumExpiry,
  FREE_LIMITS,
  PREMIUM_LIMITS,
} from '@/lib/premium'

describe('Premium Module', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('FREE_LIMITS', () => {
    it('無料会員の制限値が正しく設定されている', () => {
      expect(FREE_LIMITS).toEqual({
        maxPostLength: 500,
        maxImages: 4,
        maxVideos: 1,
        maxDailyPosts: 20,
        canSchedulePost: false,
        canViewAnalytics: false,
      })
    })
  })

  describe('PREMIUM_LIMITS', () => {
    it('プレミアム会員の制限値が正しく設定されている', () => {
      expect(PREMIUM_LIMITS).toEqual({
        maxPostLength: 2000,
        maxImages: 6,
        maxVideos: 3,
        maxDailyPosts: 40,
        canSchedulePost: true,
        canViewAnalytics: true,
      })
    })
  })

  describe('isPremiumUser', () => {
    it('ユーザーが存在しない場合はfalseを返す', async () => {
      ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null)

      const result = await isPremiumUser('non-existent-user')

      expect(result).toBe(false)
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'non-existent-user' },
        select: { isPremium: true, premiumExpiresAt: true },
      })
    })

    it('isPremiumがfalseの場合はfalseを返す', async () => {
      ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        isPremium: false,
        premiumExpiresAt: null,
      })

      const result = await isPremiumUser('user-1')

      expect(result).toBe(false)
    })

    it('isPremiumがtrueで期限が設定されていない場合はtrueを返す', async () => {
      ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        isPremium: true,
        premiumExpiresAt: null,
      })

      const result = await isPremiumUser('user-1')

      expect(result).toBe(true)
    })

    it('isPremiumがtrueで期限内の場合はtrueを返す', async () => {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 30) // 30日後

      ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        isPremium: true,
        premiumExpiresAt: futureDate,
      })

      const result = await isPremiumUser('user-1')

      expect(result).toBe(true)
    })

    it('期限切れの場合はfalseを返し、フラグを更新する', async () => {
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 1) // 1日前

      ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        isPremium: true,
        premiumExpiresAt: pastDate,
      })
      ;(mockPrisma.user.update as jest.Mock).mockResolvedValue({})

      const result = await isPremiumUser('user-1')

      expect(result).toBe(false)
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { isPremium: false },
      })
    })
  })

  describe('getMembershipLimits', () => {
    it('プレミアム会員の場合はPREMIUM_LIMITSを返す', async () => {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 30)

      ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        isPremium: true,
        premiumExpiresAt: futureDate,
      })

      const result = await getMembershipLimits('user-1')

      expect(result).toEqual(PREMIUM_LIMITS)
    })

    it('無料会員の場合はFREE_LIMITSを返す', async () => {
      ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        isPremium: false,
        premiumExpiresAt: null,
      })

      const result = await getMembershipLimits('user-1')

      expect(result).toEqual(FREE_LIMITS)
    })

    it('ユーザーが存在しない場合はFREE_LIMITSを返す', async () => {
      ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null)

      const result = await getMembershipLimits('non-existent-user')

      expect(result).toEqual(FREE_LIMITS)
    })
  })

  describe('getMembershipType', () => {
    it('プレミアム会員の場合は"premium"を返す', async () => {
      ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        isPremium: true,
        premiumExpiresAt: null,
      })

      const result = await getMembershipType('user-1')

      expect(result).toBe('premium')
    })

    it('無料会員の場合は"free"を返す', async () => {
      ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        isPremium: false,
        premiumExpiresAt: null,
      })

      const result = await getMembershipType('user-1')

      expect(result).toBe('free')
    })

    it('ユーザーが存在しない場合は"free"を返す', async () => {
      ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null)

      const result = await getMembershipType('non-existent-user')

      expect(result).toBe('free')
    })
  })

  describe('getPremiumStatus', () => {
    it('ユーザーが存在しない場合はnullを返す', async () => {
      ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null)

      const result = await getPremiumStatus('non-existent-user')

      expect(result).toBeNull()
    })

    it('プレミアム会員の詳細情報を返す', async () => {
      const expiresAt = new Date('2025-12-31')

      ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        isPremium: true,
        premiumExpiresAt: expiresAt,
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: 'sub_123',
      })

      const result = await getPremiumStatus('user-1')

      expect(result).toEqual({
        isPremium: true,
        premiumExpiresAt: expiresAt,
        hasStripeSubscription: true,
      })
    })

    it('Stripeサブスクリプションがない場合はhasStripeSubscriptionがfalse', async () => {
      ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        isPremium: true,
        premiumExpiresAt: null,
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: null,
      })

      const result = await getPremiumStatus('user-1')

      expect(result).toEqual({
        isPremium: true,
        premiumExpiresAt: null,
        hasStripeSubscription: false,
      })
    })

    it('無料会員の情報を返す', async () => {
      ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        isPremium: false,
        premiumExpiresAt: null,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
      })

      const result = await getPremiumStatus('user-1')

      expect(result).toEqual({
        isPremium: false,
        premiumExpiresAt: null,
        hasStripeSubscription: false,
      })
    })
  })

  describe('checkPremiumExpiry', () => {
    it('期限切れのプレミアム会員を一括で無効化する', async () => {
      ;(mockPrisma.user.updateMany as jest.Mock).mockResolvedValue({ count: 5 })

      const result = await checkPremiumExpiry()

      expect(result).toBe(5)
      expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
        where: {
          isPremium: true,
          premiumExpiresAt: {
            lt: expect.any(Date),
          },
        },
        data: {
          isPremium: false,
        },
      })
    })

    it('期限切れのユーザーがいない場合は0を返す', async () => {
      ;(mockPrisma.user.updateMany as jest.Mock).mockResolvedValue({ count: 0 })

      const result = await checkPremiumExpiry()

      expect(result).toBe(0)
    })
  })
})
