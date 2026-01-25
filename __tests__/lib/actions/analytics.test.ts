/**
 * @jest-environment node
 */
import { createMockPrismaClient, mockUser, mockPost, mockUserAnalytics } from '../../utils/test-utils'

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

// プレミアム判定モック
const mockIsPremiumUser = jest.fn()
jest.mock('@/lib/premium', () => ({
  isPremiumUser: () => mockIsPremiumUser(),
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

describe('Analytics Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
    mockIsPremiumUser.mockResolvedValue(true)
  })

  // ============================================================
  // getPostAnalytics
  // ============================================================

  describe('getPostAnalytics', () => {
    it('投稿パフォーマンス分析を取得できる', async () => {
      const mockPosts = [
        { id: 'post-1', content: 'テスト投稿1', createdAt: new Date(), _count: { likes: 10, comments: 5 } },
        { id: 'post-2', content: 'テスト投稿2', createdAt: new Date(), _count: { likes: 20, comments: 10 } },
      ]
      mockPrisma.post.findMany.mockResolvedValueOnce(mockPosts)

      const { getPostAnalytics } = await import('@/lib/actions/analytics')
      const result = await getPostAnalytics(30)

      expect(result.totalPosts).toBe(2)
      expect(result.totalLikes).toBe(30)
      expect(result.totalComments).toBe(15)
      expect(result.avgEngagement).toBe(22.5)
      expect(result.topPosts).toHaveLength(2)
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { getPostAnalytics } = await import('@/lib/actions/analytics')
      const result = await getPostAnalytics()

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('無料会員の場合、エラーを返す', async () => {
      mockIsPremiumUser.mockResolvedValueOnce(false)

      const { getPostAnalytics } = await import('@/lib/actions/analytics')
      const result = await getPostAnalytics()

      expect(result).toEqual({ error: '分析機能は有料会員限定です' })
    })

    it('投稿がない場合、0を返す', async () => {
      mockPrisma.post.findMany.mockResolvedValueOnce([])

      const { getPostAnalytics } = await import('@/lib/actions/analytics')
      const result = await getPostAnalytics()

      expect(result.totalPosts).toBe(0)
      expect(result.avgEngagement).toBe(0)
    })
  })

  // ============================================================
  // getLikeAnalytics
  // ============================================================

  describe('getLikeAnalytics', () => {
    it('いいね分析を取得できる', async () => {
      const now = new Date()
      const mockLikes = [
        { createdAt: new Date(now.setHours(10, 0, 0, 0)) },
        { createdAt: new Date(now.setHours(10, 0, 0, 0)) },
        { createdAt: new Date(now.setHours(14, 0, 0, 0)) },
      ]
      mockPrisma.like.findMany.mockResolvedValueOnce(mockLikes)

      const { getLikeAnalytics } = await import('@/lib/actions/analytics')
      const result = await getLikeAnalytics(30)

      expect(result.totalLikes).toBe(3)
      expect(result.hourlyData).toHaveLength(24)
      expect(result.weekdayData).toHaveLength(7)
      expect(result.peakHour).toBeDefined()
      expect(result.peakWeekday).toBeDefined()
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { getLikeAnalytics } = await import('@/lib/actions/analytics')
      const result = await getLikeAnalytics()

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('無料会員の場合、エラーを返す', async () => {
      mockIsPremiumUser.mockResolvedValueOnce(false)

      const { getLikeAnalytics } = await import('@/lib/actions/analytics')
      const result = await getLikeAnalytics()

      expect(result).toEqual({ error: '分析機能は有料会員限定です' })
    })
  })

  // ============================================================
  // getQuoteAnalytics
  // ============================================================

  describe('getQuoteAnalytics', () => {
    it('引用投稿分析を取得できる', async () => {
      const mockQuotes = [
        {
          id: 'quote-1',
          content: '引用コメント',
          user: { id: 'user-1', nickname: 'ユーザー1', avatarUrl: null },
          quotePost: { id: mockPost.id, content: '元投稿' },
          _count: { likes: 5, comments: 2 },
          createdAt: new Date(),
        },
      ]
      mockPrisma.post.findMany.mockResolvedValueOnce(mockQuotes)
      mockPrisma.post.count.mockResolvedValueOnce(10)

      const { getQuoteAnalytics } = await import('@/lib/actions/analytics')
      const result = await getQuoteAnalytics()

      expect(result.totalQuotes).toBe(1)
      expect(result.totalReposts).toBe(10)
      expect(result.quotes).toHaveLength(1)
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { getQuoteAnalytics } = await import('@/lib/actions/analytics')
      const result = await getQuoteAnalytics()

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('無料会員の場合、エラーを返す', async () => {
      mockIsPremiumUser.mockResolvedValueOnce(false)

      const { getQuoteAnalytics } = await import('@/lib/actions/analytics')
      const result = await getQuoteAnalytics()

      expect(result).toEqual({ error: '分析機能は有料会員限定です' })
    })
  })

  // ============================================================
  // getKeywordAnalytics
  // ============================================================

  describe('getKeywordAnalytics', () => {
    it('キーワード分析を取得できる', async () => {
      const mockPosts = [
        { content: '今日の盆栽は元気です' },
        { content: '盆栽の手入れをしました' },
      ]
      mockPrisma.post.findMany.mockResolvedValueOnce(mockPosts)

      const { getKeywordAnalytics } = await import('@/lib/actions/analytics')
      const result = await getKeywordAnalytics(30)

      expect(result.keywords).toBeDefined()
      expect(result.totalWords).toBeGreaterThanOrEqual(0)
      expect(result.uniqueWords).toBeGreaterThanOrEqual(0)
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { getKeywordAnalytics } = await import('@/lib/actions/analytics')
      const result = await getKeywordAnalytics()

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('無料会員の場合、エラーを返す', async () => {
      mockIsPremiumUser.mockResolvedValueOnce(false)

      const { getKeywordAnalytics } = await import('@/lib/actions/analytics')
      const result = await getKeywordAnalytics()

      expect(result).toEqual({ error: '分析機能は有料会員限定です' })
    })
  })

  // ============================================================
  // getEngagementTrend
  // ============================================================

  describe('getEngagementTrend', () => {
    it('エンゲージメント推移を取得できる', async () => {
      const mockPosts = [
        { createdAt: new Date(), _count: { likes: 10, comments: 5 } },
      ]
      mockPrisma.post.findMany.mockResolvedValueOnce(mockPosts)

      const { getEngagementTrend } = await import('@/lib/actions/analytics')
      const result = await getEngagementTrend(30)

      expect(result.trend).toBeDefined()
      expect(result.trend!.length).toBe(30)
      result.trend!.forEach((day: { date: string; posts: number; likes: number; comments: number; engagement: number }) => {
        expect(day).toHaveProperty('date')
        expect(day).toHaveProperty('posts')
        expect(day).toHaveProperty('likes')
        expect(day).toHaveProperty('comments')
        expect(day).toHaveProperty('engagement')
      })
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { getEngagementTrend } = await import('@/lib/actions/analytics')
      const result = await getEngagementTrend()

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('無料会員の場合、エラーを返す', async () => {
      mockIsPremiumUser.mockResolvedValueOnce(false)

      const { getEngagementTrend } = await import('@/lib/actions/analytics')
      const result = await getEngagementTrend()

      expect(result).toEqual({ error: '分析機能は有料会員限定です' })
    })
  })

  // ============================================================
  // getAnalyticsDashboard
  // ============================================================

  describe('getAnalyticsDashboard', () => {
    it('ダッシュボード全データを取得できる', async () => {
      // 各分析関数用のモック
      mockPrisma.post.findMany
        .mockResolvedValueOnce([]) // getPostAnalytics
        .mockResolvedValueOnce([]) // getQuoteAnalytics
        .mockResolvedValueOnce([]) // getKeywordAnalytics
        .mockResolvedValueOnce([]) // getEngagementTrend
      mockPrisma.like.findMany.mockResolvedValueOnce([])
      mockPrisma.post.count.mockResolvedValueOnce(0)

      const { getAnalyticsDashboard } = await import('@/lib/actions/analytics')
      const result = await getAnalyticsDashboard(30)

      expect(result.postAnalytics).toBeDefined()
      expect(result.likeAnalytics).toBeDefined()
      expect(result.quoteAnalytics).toBeDefined()
      expect(result.keywordAnalytics).toBeDefined()
      expect(result.engagementTrend).toBeDefined()
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { getAnalyticsDashboard } = await import('@/lib/actions/analytics')
      const result = await getAnalyticsDashboard()

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('無料会員の場合、エラーを返す', async () => {
      mockIsPremiumUser.mockResolvedValueOnce(false)

      const { getAnalyticsDashboard } = await import('@/lib/actions/analytics')
      const result = await getAnalyticsDashboard()

      expect(result).toEqual({ error: '分析機能は有料会員限定です' })
    })
  })

  // ============================================================
  // recordProfileView
  // ============================================================

  describe('recordProfileView', () => {
    it('プロフィール閲覧を記録できる', async () => {
      mockPrisma.userAnalytics.upsert.mockResolvedValueOnce(mockUserAnalytics)

      const { recordProfileView } = await import('@/lib/actions/analytics')
      await recordProfileView(mockUser.id)

      expect(mockPrisma.userAnalytics.upsert).toHaveBeenCalled()
    })

    it('エラーが発生しても例外をスローしない', async () => {
      mockPrisma.userAnalytics.upsert.mockRejectedValueOnce(new Error('Database error'))

      const { recordProfileView } = await import('@/lib/actions/analytics')
      await expect(recordProfileView(mockUser.id)).resolves.not.toThrow()
    })
  })

  // ============================================================
  // recordPostView
  // ============================================================

  describe('recordPostView', () => {
    it('投稿閲覧を記録できる', async () => {
      mockPrisma.userAnalytics.upsert.mockResolvedValueOnce(mockUserAnalytics)

      const { recordPostView } = await import('@/lib/actions/analytics')
      await recordPostView(mockUser.id)

      expect(mockPrisma.userAnalytics.upsert).toHaveBeenCalled()
    })

    it('エラーが発生しても例外をスローしない', async () => {
      mockPrisma.userAnalytics.upsert.mockRejectedValueOnce(new Error('Database error'))

      const { recordPostView } = await import('@/lib/actions/analytics')
      await expect(recordPostView(mockUser.id)).resolves.not.toThrow()
    })
  })

  // ============================================================
  // recordLikeReceived
  // ============================================================

  describe('recordLikeReceived', () => {
    it('いいね受信を記録できる', async () => {
      mockPrisma.userAnalytics.upsert.mockResolvedValueOnce(mockUserAnalytics)

      const { recordLikeReceived } = await import('@/lib/actions/analytics')
      await recordLikeReceived(mockUser.id)

      expect(mockPrisma.userAnalytics.upsert).toHaveBeenCalled()
    })

    it('エラーが発生しても例外をスローしない', async () => {
      mockPrisma.userAnalytics.upsert.mockRejectedValueOnce(new Error('Database error'))

      const { recordLikeReceived } = await import('@/lib/actions/analytics')
      await expect(recordLikeReceived(mockUser.id)).resolves.not.toThrow()
    })
  })

  // ============================================================
  // recordNewFollower
  // ============================================================

  describe('recordNewFollower', () => {
    it('フォロワー増加を記録できる', async () => {
      mockPrisma.userAnalytics.upsert.mockResolvedValueOnce(mockUserAnalytics)

      const { recordNewFollower } = await import('@/lib/actions/analytics')
      await recordNewFollower(mockUser.id)

      expect(mockPrisma.userAnalytics.upsert).toHaveBeenCalled()
    })

    it('エラーが発生しても例外をスローしない', async () => {
      mockPrisma.userAnalytics.upsert.mockRejectedValueOnce(new Error('Database error'))

      const { recordNewFollower } = await import('@/lib/actions/analytics')
      await expect(recordNewFollower(mockUser.id)).resolves.not.toThrow()
    })
  })

  // ============================================================
  // getDetailedAnalytics
  // ============================================================

  describe('getDetailedAnalytics', () => {
    it('詳細アナリティクスを取得できる', async () => {
      const mockAnalyticsData = [
        {
          date: new Date(),
          profileViews: 10,
          postViews: 100,
          likesReceived: 50,
          newFollowers: 5,
        },
      ]
      mockPrisma.userAnalytics.findMany.mockResolvedValueOnce(mockAnalyticsData)

      const { getDetailedAnalytics } = await import('@/lib/actions/analytics')
      const result = await getDetailedAnalytics(30)

      expect(result.totals).toEqual({
        profileViews: 10,
        postViews: 100,
        likesReceived: 50,
        newFollowers: 5,
      })
      expect(result.dailyData).toHaveLength(1)
      expect(result.period).toBeDefined()
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { getDetailedAnalytics } = await import('@/lib/actions/analytics')
      const result = await getDetailedAnalytics()

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('無料会員の場合、エラーを返す', async () => {
      mockIsPremiumUser.mockResolvedValueOnce(false)

      const { getDetailedAnalytics } = await import('@/lib/actions/analytics')
      const result = await getDetailedAnalytics()

      expect(result).toEqual({ error: 'プレミアム会員限定機能です' })
    })

    it('エラー時はエラーメッセージを返す', async () => {
      mockPrisma.userAnalytics.findMany.mockRejectedValueOnce(new Error('Database error'))

      const { getDetailedAnalytics } = await import('@/lib/actions/analytics')
      const result = await getDetailedAnalytics()

      expect(result).toEqual({ error: '分析データの取得に失敗しました' })
    })
  })

  // ============================================================
  // getBasicStats
  // ============================================================

  describe('getBasicStats', () => {
    it('基本統計を取得できる', async () => {
      mockPrisma.post.count.mockResolvedValueOnce(50)
      mockPrisma.follow.count
        .mockResolvedValueOnce(100) // followers
        .mockResolvedValueOnce(80)  // following
      mockPrisma.like.count.mockResolvedValueOnce(500)

      const { getBasicStats } = await import('@/lib/actions/analytics')
      const result = await getBasicStats()

      expect(result.postsCount).toBe(50)
      expect(result.followersCount).toBe(100)
      expect(result.followingCount).toBe(80)
      expect(result.totalLikesReceived).toBe(500)
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { getBasicStats } = await import('@/lib/actions/analytics')
      const result = await getBasicStats()

      expect(result).toEqual({ error: '認証が必要です' })
    })
  })
})
