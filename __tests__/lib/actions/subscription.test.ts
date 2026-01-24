/**
 * @jest-environment node
 */
import { createMockPrismaClient, mockUser } from '../../utils/test-utils'

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

// Stripeモック
const mockStripe = {
  customers: {
    create: jest.fn(),
  },
  checkout: {
    sessions: {
      create: jest.fn(),
    },
  },
  billingPortal: {
    sessions: {
      create: jest.fn(),
    },
  },
  subscriptions: {
    retrieve: jest.fn(),
    cancel: jest.fn(),
  },
}
jest.mock('@/lib/stripe', () => ({
  stripe: mockStripe,
  STRIPE_PRICE_ID_MONTHLY: 'price_monthly',
  STRIPE_PRICE_ID_YEARLY: 'price_yearly',
}))

// ロガーモック
jest.mock('@/lib/logger', () => ({
  __esModule: true,
  default: {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}))

describe('Subscription Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
  })

  // ============================================================
  // createCheckoutSession
  // ============================================================

  describe('createCheckoutSession', () => {
    it('Checkout Sessionを作成できる', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        email: mockUser.email,
        stripeCustomerId: 'cus_existing',
        isPremium: false,
      })
      mockStripe.checkout.sessions.create.mockResolvedValueOnce({
        url: 'https://checkout.stripe.com/session',
      })

      const { createCheckoutSession } = await import('@/lib/actions/subscription')
      const result = await createCheckoutSession('monthly')

      expect(result.url).toBe('https://checkout.stripe.com/session')
      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: 'cus_existing',
          mode: 'subscription',
          line_items: [{ price: 'price_monthly', quantity: 1 }],
        })
      )
    })

    it('新規Stripe顧客を作成する', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        email: mockUser.email,
        stripeCustomerId: null,
        isPremium: false,
      })
      mockStripe.customers.create.mockResolvedValueOnce({
        id: 'cus_new',
      })
      mockPrisma.user.update.mockResolvedValueOnce({})
      mockStripe.checkout.sessions.create.mockResolvedValueOnce({
        url: 'https://checkout.stripe.com/session',
      })

      const { createCheckoutSession } = await import('@/lib/actions/subscription')
      const result = await createCheckoutSession('monthly')

      expect(mockStripe.customers.create).toHaveBeenCalledWith({
        email: mockUser.email,
        metadata: { userId: mockUser.id },
      })
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { stripeCustomerId: 'cus_new' },
      })
      expect(result.url).toBeDefined()
    })

    it('年額プランを選択できる', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        email: mockUser.email,
        stripeCustomerId: 'cus_existing',
        isPremium: false,
      })
      mockStripe.checkout.sessions.create.mockResolvedValueOnce({
        url: 'https://checkout.stripe.com/session',
      })

      const { createCheckoutSession } = await import('@/lib/actions/subscription')
      await createCheckoutSession('yearly')

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          line_items: [{ price: 'price_yearly', quantity: 1 }],
        })
      )
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { createCheckoutSession } = await import('@/lib/actions/subscription')
      const result = await createCheckoutSession('monthly')

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('ユーザーが見つからない場合、エラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null)

      const { createCheckoutSession } = await import('@/lib/actions/subscription')
      const result = await createCheckoutSession('monthly')

      expect(result).toEqual({ error: 'ユーザーが見つかりません' })
    })

    it('すでに有料会員の場合、エラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        email: mockUser.email,
        stripeCustomerId: 'cus_existing',
        isPremium: true,
      })

      const { createCheckoutSession } = await import('@/lib/actions/subscription')
      const result = await createCheckoutSession('monthly')

      expect(result).toEqual({ error: 'すでに有料会員です' })
    })
  })

  // ============================================================
  // createCustomerPortalSession
  // ============================================================

  describe('createCustomerPortalSession', () => {
    it('カスタマーポータルSessionを作成できる', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        stripeCustomerId: 'cus_existing',
      })
      mockStripe.billingPortal.sessions.create.mockResolvedValueOnce({
        url: 'https://billing.stripe.com/portal',
      })

      const { createCustomerPortalSession } = await import('@/lib/actions/subscription')
      const result = await createCustomerPortalSession()

      expect(result.url).toBe('https://billing.stripe.com/portal')
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { createCustomerPortalSession } = await import('@/lib/actions/subscription')
      const result = await createCustomerPortalSession()

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('Stripe顧客IDがない場合、エラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        stripeCustomerId: null,
      })

      const { createCustomerPortalSession } = await import('@/lib/actions/subscription')
      const result = await createCustomerPortalSession()

      expect(result).toEqual({ error: 'サブスクリプション情報が見つかりません' })
    })
  })

  // ============================================================
  // getSubscriptionStatus
  // ============================================================

  describe('getSubscriptionStatus', () => {
    it('サブスクリプション状態を取得できる', async () => {
      const futureDate = new Date()
      futureDate.setMonth(futureDate.getMonth() + 1)

      mockPrisma.user.findUnique.mockResolvedValueOnce({
        isPremium: true,
        premiumExpiresAt: futureDate,
        stripeSubscriptionId: 'sub_123',
        stripeCustomerId: 'cus_existing',
      })
      mockStripe.subscriptions.retrieve.mockResolvedValueOnce({
        status: 'active',
        current_period_end: Math.floor(futureDate.getTime() / 1000),
        cancel_at_period_end: false,
      })

      const { getSubscriptionStatus } = await import('@/lib/actions/subscription')
      const result = await getSubscriptionStatus()

      expect(result.isPremium).toBe(true)
      expect(result.subscription?.status).toBe('active')
      expect(result.subscription?.cancelAtPeriodEnd).toBe(false)
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { getSubscriptionStatus } = await import('@/lib/actions/subscription')
      const result = await getSubscriptionStatus()

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('ユーザーが見つからない場合、エラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null)

      const { getSubscriptionStatus } = await import('@/lib/actions/subscription')
      const result = await getSubscriptionStatus()

      expect(result).toEqual({ error: 'ユーザーが見つかりません' })
    })

    it('サブスクリプションIDがない場合、subscriptionはnull', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        isPremium: false,
        premiumExpiresAt: null,
        stripeSubscriptionId: null,
        stripeCustomerId: null,
      })

      const { getSubscriptionStatus } = await import('@/lib/actions/subscription')
      const result = await getSubscriptionStatus()

      expect(result.isPremium).toBe(false)
      expect(result.subscription).toBeNull()
    })
  })

  // ============================================================
  // getPaymentHistory
  // ============================================================

  describe('getPaymentHistory', () => {
    it('支払い履歴を取得できる', async () => {
      const mockPayments = [
        { id: 'pay-1', amount: 980, status: 'succeeded', createdAt: new Date() },
        { id: 'pay-2', amount: 980, status: 'succeeded', createdAt: new Date() },
      ]
      mockPrisma.payment.findMany.mockResolvedValueOnce(mockPayments)

      const { getPaymentHistory } = await import('@/lib/actions/subscription')
      const result = await getPaymentHistory()

      expect(result.payments).toHaveLength(2)
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { getPaymentHistory } = await import('@/lib/actions/subscription')
      const result = await getPaymentHistory()

      expect(result).toEqual({ error: '認証が必要です' })
    })
  })

  // ============================================================
  // cancelSubscriptionImmediately
  // ============================================================

  describe('cancelSubscriptionImmediately', () => {
    it('サブスクリプションを即時解約できる', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        stripeSubscriptionId: 'sub_123',
      })
      mockStripe.subscriptions.cancel.mockResolvedValueOnce({})
      mockPrisma.user.update.mockResolvedValueOnce({})

      const { cancelSubscriptionImmediately } = await import('@/lib/actions/subscription')
      const result = await cancelSubscriptionImmediately()

      expect(result).toEqual({ success: true })
      expect(mockStripe.subscriptions.cancel).toHaveBeenCalledWith('sub_123')
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: {
          isPremium: false,
          stripeSubscriptionId: null,
          premiumExpiresAt: null,
        },
      })
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { cancelSubscriptionImmediately } = await import('@/lib/actions/subscription')
      const result = await cancelSubscriptionImmediately()

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('サブスクリプションがない場合、エラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        stripeSubscriptionId: null,
      })

      const { cancelSubscriptionImmediately } = await import('@/lib/actions/subscription')
      const result = await cancelSubscriptionImmediately()

      expect(result).toEqual({ error: 'サブスクリプションが見つかりません' })
    })

    it('Stripeエラー時はエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        stripeSubscriptionId: 'sub_123',
      })
      mockStripe.subscriptions.cancel.mockRejectedValueOnce(new Error('Stripe error'))

      const { cancelSubscriptionImmediately } = await import('@/lib/actions/subscription')
      const result = await cancelSubscriptionImmediately()

      expect(result).toEqual({ error: 'サブスクリプションのキャンセルに失敗しました' })
    })
  })

  // ============================================================
  // getMembershipInfo
  // ============================================================

  describe('getMembershipInfo', () => {
    it('プレミアム会員の制限を取得できる', async () => {
      const futureDate = new Date()
      futureDate.setMonth(futureDate.getMonth() + 1)

      mockPrisma.user.findUnique.mockResolvedValueOnce({
        isPremium: true,
        premiumExpiresAt: futureDate,
      })

      const { getMembershipInfo } = await import('@/lib/actions/subscription')
      const result = await getMembershipInfo()

      expect(result.isPremium).toBe(true)
      expect(result.limits.maxPostLength).toBe(2000)
      expect(result.limits.maxImages).toBe(6)
      expect(result.limits.maxVideos).toBe(3)
      expect(result.limits.canSchedulePost).toBe(true)
      expect(result.limits.canViewAnalytics).toBe(true)
    })

    it('無料会員の制限を取得できる', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        isPremium: false,
        premiumExpiresAt: null,
      })

      const { getMembershipInfo } = await import('@/lib/actions/subscription')
      const result = await getMembershipInfo()

      expect(result.isPremium).toBe(false)
      expect(result.limits.maxPostLength).toBe(500)
      expect(result.limits.maxImages).toBe(4)
      expect(result.limits.maxVideos).toBe(2)
      expect(result.limits.canSchedulePost).toBe(false)
      expect(result.limits.canViewAnalytics).toBe(false)
    })

    it('未ログイン時は無料会員の制限を返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { getMembershipInfo } = await import('@/lib/actions/subscription')
      const result = await getMembershipInfo()

      expect(result.isPremium).toBe(false)
      expect(result.limits.maxPostLength).toBe(500)
    })

    it('有効期限切れの場合は無料会員として扱う', async () => {
      const pastDate = new Date()
      pastDate.setMonth(pastDate.getMonth() - 1)

      mockPrisma.user.findUnique.mockResolvedValueOnce({
        isPremium: true,
        premiumExpiresAt: pastDate,
      })

      const { getMembershipInfo } = await import('@/lib/actions/subscription')
      const result = await getMembershipInfo()

      expect(result.isPremium).toBe(false)
      expect(result.limits.maxPostLength).toBe(500)
    })
  })
})
