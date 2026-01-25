/**
 * @jest-environment node
 */

import { createMockPrismaClient, mockUser } from '../../../utils/test-utils'

// Prismaモック
const mockPrisma = createMockPrismaClient()
jest.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}))

// 認証モック
const mockAuth = jest.fn()
jest.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}))

// revalidatePathモック
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}))

const mockAdminUser = {
  id: 'admin-user-id',
  userId: mockUser.id,
  role: 'admin',
  createdAt: new Date(),
}

const mockTargetUser = {
  id: 'target-user-id',
  email: 'target@example.com',
  nickname: 'ターゲットユーザー',
  avatarUrl: null,
  isPremium: false,
  premiumExpiresAt: null,
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  createdAt: new Date(),
}

describe('Admin Premium Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
    mockPrisma.adminUser.findUnique.mockResolvedValue(mockAdminUser)
  })

  // ============================================================
  // grantPremium
  // ============================================================

  describe('grantPremium', () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { grantPremium } = await import('@/lib/actions/admin/premium')
      const result = await grantPremium('target-user-id')

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)

      const { grantPremium } = await import('@/lib/actions/admin/premium')
      const result = await grantPremium('target-user-id')

      expect(result).toEqual({ error: '管理者権限が必要です' })
    })

    it('存在しないユーザーはエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)

      const { grantPremium } = await import('@/lib/actions/admin/premium')
      const result = await grantPremium('non-existent-user')

      expect(result).toEqual({ error: 'ユーザーが見つかりません' })
    })

    it('デフォルト30日でプレミアムを付与できる', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockTargetUser)
      mockPrisma.user.update.mockResolvedValue({
        ...mockTargetUser,
        isPremium: true,
        premiumExpiresAt: new Date(),
      })
      mockPrisma.adminLog.create.mockResolvedValue({})

      const { grantPremium } = await import('@/lib/actions/admin/premium')
      const result = await grantPremium('target-user-id')

      expect('success' in result && result.success).toBe(true)
      expect('expiresAt' in result && result.expiresAt).toBeDefined()
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'target-user-id' },
          data: expect.objectContaining({
            isPremium: true,
          }),
        })
      )
      expect(mockPrisma.adminLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'grant_premium',
            targetType: 'user',
            targetId: 'target-user-id',
          }),
        })
      )
    })

    it('カスタム期間でプレミアムを付与できる', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockTargetUser)
      mockPrisma.user.update.mockResolvedValue({
        ...mockTargetUser,
        isPremium: true,
      })
      mockPrisma.adminLog.create.mockResolvedValue({})

      const { grantPremium } = await import('@/lib/actions/admin/premium')
      const result = await grantPremium('target-user-id', 365)

      expect('success' in result && result.success).toBe(true)
      expect(mockPrisma.adminLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            details: expect.objectContaining({
              durationDays: 365,
            }),
          }),
        })
      )
    })
  })

  // ============================================================
  // revokePremium
  // ============================================================

  describe('revokePremium', () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { revokePremium } = await import('@/lib/actions/admin/premium')
      const result = await revokePremium('target-user-id')

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)

      const { revokePremium } = await import('@/lib/actions/admin/premium')
      const result = await revokePremium('target-user-id')

      expect(result).toEqual({ error: '管理者権限が必要です' })
    })

    it('存在しないユーザーはエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)

      const { revokePremium } = await import('@/lib/actions/admin/premium')
      const result = await revokePremium('non-existent-user')

      expect(result).toEqual({ error: 'ユーザーが見つかりません' })
    })

    it('プレミアムではないユーザーはエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockTargetUser,
        isPremium: false,
      })

      const { revokePremium } = await import('@/lib/actions/admin/premium')
      const result = await revokePremium('target-user-id')

      expect(result).toEqual({ error: 'このユーザーは有料会員ではありません' })
    })

    it('プレミアムを取り消しできる', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockTargetUser,
        isPremium: true,
        premiumExpiresAt: new Date(),
      })
      mockPrisma.user.update.mockResolvedValue({
        ...mockTargetUser,
        isPremium: false,
        premiumExpiresAt: null,
      })
      mockPrisma.adminLog.create.mockResolvedValue({})

      const { revokePremium } = await import('@/lib/actions/admin/premium')
      const result = await revokePremium('target-user-id')

      expect(result).toEqual({ success: true })
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'target-user-id' },
          data: expect.objectContaining({
            isPremium: false,
            premiumExpiresAt: null,
          }),
        })
      )
      expect(mockPrisma.adminLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'revoke_premium',
          }),
        })
      )
    })
  })

  // ============================================================
  // extendPremium
  // ============================================================

  describe('extendPremium', () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { extendPremium } = await import('@/lib/actions/admin/premium')
      const result = await extendPremium('target-user-id', 30)

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)

      const { extendPremium } = await import('@/lib/actions/admin/premium')
      const result = await extendPremium('target-user-id', 30)

      expect(result).toEqual({ error: '管理者権限が必要です' })
    })

    it('存在しないユーザーはエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)

      const { extendPremium } = await import('@/lib/actions/admin/premium')
      const result = await extendPremium('non-existent-user', 30)

      expect(result).toEqual({ error: 'ユーザーが見つかりません' })
    })

    it('現在の期限から延長できる（期限が未来の場合）', async () => {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 10)

      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockTargetUser,
        isPremium: true,
        premiumExpiresAt: futureDate,
      })
      mockPrisma.user.update.mockResolvedValue({
        ...mockTargetUser,
        isPremium: true,
      })
      mockPrisma.adminLog.create.mockResolvedValue({})

      const { extendPremium } = await import('@/lib/actions/admin/premium')
      const result = await extendPremium('target-user-id', 30)

      expect('success' in result && result.success).toBe(true)
      expect('newExpiresAt' in result && result.newExpiresAt).toBeDefined()
      expect(mockPrisma.adminLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'extend_premium',
            details: expect.objectContaining({
              additionalDays: 30,
            }),
          }),
        })
      )
    })

    it('期限切れの場合は現在日時から延長する', async () => {
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 10)

      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockTargetUser,
        isPremium: false,
        premiumExpiresAt: pastDate,
      })
      mockPrisma.user.update.mockResolvedValue({
        ...mockTargetUser,
        isPremium: true,
      })
      mockPrisma.adminLog.create.mockResolvedValue({})

      const { extendPremium } = await import('@/lib/actions/admin/premium')
      const result = await extendPremium('target-user-id', 30)

      expect('success' in result && result.success).toBe(true)
      expect('newExpiresAt' in result && result.newExpiresAt).toBeDefined()
    })

    it('プレミアム期限がnullの場合は現在日時から延長する', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockTargetUser,
        isPremium: false,
        premiumExpiresAt: null,
      })
      mockPrisma.user.update.mockResolvedValue({
        ...mockTargetUser,
        isPremium: true,
      })
      mockPrisma.adminLog.create.mockResolvedValue({})

      const { extendPremium } = await import('@/lib/actions/admin/premium')
      const result = await extendPremium('target-user-id', 30)

      expect('success' in result && result.success).toBe(true)
      expect('newExpiresAt' in result && result.newExpiresAt).toBeDefined()
    })
  })

  // ============================================================
  // getPremiumUsers
  // ============================================================

  describe('getPremiumUsers', () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { getPremiumUsers } = await import('@/lib/actions/admin/premium')
      const result = await getPremiumUsers()

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)

      const { getPremiumUsers } = await import('@/lib/actions/admin/premium')
      const result = await getPremiumUsers()

      expect(result).toEqual({ error: '管理者権限が必要です' })
    })

    it('プレミアム会員一覧を取得できる', async () => {
      const mockPremiumUsers = [
        {
          id: 'user-1',
          email: 'user1@example.com',
          nickname: 'ユーザー1',
          avatarUrl: null,
          isPremium: true,
          premiumExpiresAt: new Date(),
          stripeSubscriptionId: null,
          createdAt: new Date(),
        },
      ]
      mockPrisma.user.findMany.mockResolvedValue(mockPremiumUsers)
      mockPrisma.user.count.mockResolvedValue(1)

      const { getPremiumUsers } = await import('@/lib/actions/admin/premium')
      const result = await getPremiumUsers()

      expect('users' in result && result.users).toHaveLength(1)
      expect('total' in result && result.total).toBe(1)
    })

    it('検索クエリでフィルタリングできる', async () => {
      mockPrisma.user.findMany.mockResolvedValue([])
      mockPrisma.user.count.mockResolvedValue(0)

      const { getPremiumUsers } = await import('@/lib/actions/admin/premium')
      await getPremiumUsers({ search: 'test@' })

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isPremium: true,
            OR: expect.arrayContaining([
              { email: { contains: 'test@', mode: 'insensitive' } },
              { nickname: { contains: 'test@', mode: 'insensitive' } },
            ]),
          }),
        })
      )
    })

    it('ページネーションが動作する', async () => {
      mockPrisma.user.findMany.mockResolvedValue([])
      mockPrisma.user.count.mockResolvedValue(0)

      const { getPremiumUsers } = await import('@/lib/actions/admin/premium')
      await getPremiumUsers({ limit: 10, offset: 20 })

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 20,
        })
      )
    })
  })

  // ============================================================
  // getPremiumStats
  // ============================================================

  describe('getPremiumStats', () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { getPremiumStats } = await import('@/lib/actions/admin/premium')
      const result = await getPremiumStats()

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)

      const { getPremiumStats } = await import('@/lib/actions/admin/premium')
      const result = await getPremiumStats()

      expect(result).toEqual({ error: '管理者権限が必要です' })
    })

    it('プレミアム統計を取得できる', async () => {
      mockPrisma.user.count
        .mockResolvedValueOnce(100) // totalPremiumUsers
        .mockResolvedValueOnce(5)   // expiringIn7Days
        .mockResolvedValueOnce(20)  // newThisMonth
      mockPrisma.payment.aggregate.mockResolvedValue({
        _sum: { amount: 500000 },
      })

      const { getPremiumStats } = await import('@/lib/actions/admin/premium')
      const result = await getPremiumStats()

      expect('totalPremiumUsers' in result && result.totalPremiumUsers).toBe(100)
      expect('expiringIn7Days' in result && result.expiringIn7Days).toBe(5)
      expect('newThisMonth' in result && result.newThisMonth).toBe(20)
      expect('totalRevenue' in result && result.totalRevenue).toBe(500000)
    })

    it('支払いがない場合は売上0を返す', async () => {
      mockPrisma.user.count.mockResolvedValue(0)
      mockPrisma.payment.aggregate.mockResolvedValue({
        _sum: { amount: null },
      })

      const { getPremiumStats } = await import('@/lib/actions/admin/premium')
      const result = await getPremiumStats()

      expect('totalRevenue' in result && result.totalRevenue).toBe(0)
    })
  })

  // ============================================================
  // searchUserForPremium
  // ============================================================

  describe('searchUserForPremium', () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { searchUserForPremium } = await import('@/lib/actions/admin/premium')
      const result = await searchUserForPremium('test')

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)

      const { searchUserForPremium } = await import('@/lib/actions/admin/premium')
      const result = await searchUserForPremium('test')

      expect(result).toEqual({ error: '管理者権限が必要です' })
    })

    it('2文字未満のクエリは空配列を返す', async () => {
      const { searchUserForPremium } = await import('@/lib/actions/admin/premium')
      const result = await searchUserForPremium('a')

      expect(result).toEqual({ users: [] })
    })

    it('空のクエリは空配列を返す', async () => {
      const { searchUserForPremium } = await import('@/lib/actions/admin/premium')
      const result = await searchUserForPremium('')

      expect(result).toEqual({ users: [] })
    })

    it('ユーザーを検索できる', async () => {
      const mockSearchResults = [
        {
          id: 'user-1',
          email: 'test@example.com',
          nickname: 'テストユーザー',
          avatarUrl: null,
          isPremium: false,
          premiumExpiresAt: null,
        },
      ]
      mockPrisma.user.findMany.mockResolvedValue(mockSearchResults)

      const { searchUserForPremium } = await import('@/lib/actions/admin/premium')
      const result = await searchUserForPremium('test')

      expect('users' in result && result.users).toHaveLength(1)
      expect('users' in result && result.users[0].email).toBe('test@example.com')
    })

    it('最大10件まで取得する', async () => {
      mockPrisma.user.findMany.mockResolvedValue([])

      const { searchUserForPremium } = await import('@/lib/actions/admin/premium')
      await searchUserForPremium('test')

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
        })
      )
    })
  })
})
