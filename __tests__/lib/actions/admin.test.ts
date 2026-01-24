/**
 * @jest-environment node
 */
import { createMockPrismaClient, mockUser, mockPost } from '../../utils/test-utils'

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

describe('Admin Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
    // 管理者権限チェック用
    mockPrisma.adminUser.findUnique.mockResolvedValue(mockAdminUser)
  })

  // ============================================================
  // getAdminStats
  // ============================================================

  describe('getAdminStats', () => {
    it('統計情報を取得できる', async () => {
      mockPrisma.user.count
        .mockResolvedValueOnce(1000) // totalUsers
        .mockResolvedValueOnce(10)   // todayUsers
        .mockResolvedValueOnce(100)  // activeUsersWeek
      mockPrisma.post.count
        .mockResolvedValueOnce(5000) // totalPosts
        .mockResolvedValueOnce(50)   // todayPosts
      mockPrisma.report.count.mockResolvedValueOnce(5) // pendingReports
      mockPrisma.event.count.mockResolvedValueOnce(20) // totalEvents
      mockPrisma.bonsaiShop.count.mockResolvedValueOnce(30) // totalShops

      const { getAdminStats } = await import('@/lib/actions/admin')
      const result = await getAdminStats()

      expect(result.totalUsers).toBe(1000)
      expect(result.todayUsers).toBe(10)
      expect(result.totalPosts).toBe(5000)
      expect(result.todayPosts).toBe(50)
      expect(result.pendingReports).toBe(5)
      expect(result.totalEvents).toBe(20)
      expect(result.totalShops).toBe(30)
    })

    it('未認証の場合、エラーを投げる', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { getAdminStats } = await import('@/lib/actions/admin')
      await expect(getAdminStats()).rejects.toThrow('認証が必要です')
    })

    it('管理者でない場合、エラーを投げる', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValueOnce(null)

      const { getAdminStats } = await import('@/lib/actions/admin')
      await expect(getAdminStats()).rejects.toThrow('管理者権限が必要です')
    })
  })

  // ============================================================
  // getAdminUsers
  // ============================================================

  describe('getAdminUsers', () => {
    it('ユーザー一覧を取得できる', async () => {
      const mockUsers = [
        {
          id: 'user-1',
          email: 'user1@example.com',
          nickname: 'ユーザー1',
          avatarUrl: null,
          createdAt: new Date(),
          isSuspended: false,
          suspendedAt: null,
          _count: { posts: 10 },
        },
      ]
      mockPrisma.user.findMany.mockResolvedValueOnce(mockUsers)
      mockPrisma.user.count.mockResolvedValueOnce(1)

      const { getAdminUsers } = await import('@/lib/actions/admin')
      const result = await getAdminUsers()

      expect(result.users).toHaveLength(1)
      expect(result.total).toBe(1)
    })

    it('検索とフィルターが適用される', async () => {
      mockPrisma.user.findMany.mockResolvedValueOnce([])
      mockPrisma.user.count.mockResolvedValueOnce(0)

      const { getAdminUsers } = await import('@/lib/actions/admin')
      await getAdminUsers({
        search: 'test',
        status: 'suspended',
        sortBy: 'postCount',
        sortOrder: 'desc',
        limit: 10,
        offset: 0,
      })

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { nickname: { contains: 'test' } },
              { email: { contains: 'test' } },
            ]),
            isSuspended: true,
          }),
          take: 10,
          skip: 0,
        })
      )
    })
  })

  // ============================================================
  // getAdminUserDetail
  // ============================================================

  describe('getAdminUserDetail', () => {
    it('ユーザー詳細を取得できる', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        ...mockUser,
        _count: { posts: 10, comments: 20, followers: 30, following: 40 },
      })
      mockPrisma.post.findMany.mockResolvedValueOnce([])
      mockPrisma.report.count.mockResolvedValueOnce(2)

      const { getAdminUserDetail } = await import('@/lib/actions/admin')
      const result = await getAdminUserDetail(mockUser.id)

      expect(result.user).toBeDefined()
      expect(result.reportCount).toBe(2)
    })

    it('ユーザーが見つからない場合、エラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null)

      const { getAdminUserDetail } = await import('@/lib/actions/admin')
      const result = await getAdminUserDetail('nonexistent-id')

      expect(result).toEqual({ error: 'ユーザーが見つかりません' })
    })
  })

  // ============================================================
  // suspendUser
  // ============================================================

  describe('suspendUser', () => {
    it('ユーザーを停止できる', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        ...mockUser,
        isSuspended: false,
      })
      mockPrisma.$transaction.mockResolvedValueOnce([])

      const { suspendUser } = await import('@/lib/actions/admin')
      const result = await suspendUser(mockUser.id, '利用規約違反')

      expect(result).toEqual({ success: true })
    })

    it('ユーザーが見つからない場合、エラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null)

      const { suspendUser } = await import('@/lib/actions/admin')
      const result = await suspendUser('nonexistent-id', '理由')

      expect(result).toEqual({ error: 'ユーザーが見つかりません' })
    })

    it('既に停止中の場合、エラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        ...mockUser,
        isSuspended: true,
      })

      const { suspendUser } = await import('@/lib/actions/admin')
      const result = await suspendUser(mockUser.id, '理由')

      expect(result).toEqual({ error: 'このユーザーは既に停止されています' })
    })
  })

  // ============================================================
  // activateUser
  // ============================================================

  describe('activateUser', () => {
    it('ユーザーを復帰できる', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        ...mockUser,
        isSuspended: true,
      })
      mockPrisma.$transaction.mockResolvedValueOnce([])

      const { activateUser } = await import('@/lib/actions/admin')
      const result = await activateUser(mockUser.id)

      expect(result).toEqual({ success: true })
    })

    it('ユーザーが見つからない場合、エラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null)

      const { activateUser } = await import('@/lib/actions/admin')
      const result = await activateUser('nonexistent-id')

      expect(result).toEqual({ error: 'ユーザーが見つかりません' })
    })

    it('停止中でない場合、エラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        ...mockUser,
        isSuspended: false,
      })

      const { activateUser } = await import('@/lib/actions/admin')
      const result = await activateUser(mockUser.id)

      expect(result).toEqual({ error: 'このユーザーは停止されていません' })
    })
  })

  // ============================================================
  // getAdminPosts
  // ============================================================

  describe('getAdminPosts', () => {
    it('投稿一覧を取得できる', async () => {
      const mockPosts = [
        {
          id: mockPost.id,
          content: mockPost.content,
          createdAt: new Date(),
          user: { id: mockUser.id, nickname: mockUser.nickname, avatarUrl: null },
          _count: { likes: 10, comments: 5 },
        },
      ]
      mockPrisma.post.findMany.mockResolvedValueOnce(mockPosts)
      mockPrisma.post.count.mockResolvedValueOnce(1)
      mockPrisma.report.count.mockResolvedValueOnce(2)

      const { getAdminPosts } = await import('@/lib/actions/admin')
      const result = await getAdminPosts()

      expect(result.posts).toHaveLength(1)
      expect(result.posts[0].reportCount).toBe(2)
    })

    it('通報された投稿のみフィルターできる', async () => {
      mockPrisma.report.findMany.mockResolvedValueOnce([
        { targetId: 'reported-post-1' },
        { targetId: 'reported-post-2' },
      ])
      mockPrisma.post.findMany.mockResolvedValueOnce([])
      mockPrisma.post.count.mockResolvedValueOnce(0)

      const { getAdminPosts } = await import('@/lib/actions/admin')
      await getAdminPosts({ hasReports: true })

      expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { in: ['reported-post-1', 'reported-post-2'] },
          }),
        })
      )
    })
  })

  // ============================================================
  // deletePostByAdmin
  // ============================================================

  describe('deletePostByAdmin', () => {
    it('投稿を削除できる', async () => {
      mockPrisma.post.findUnique.mockResolvedValueOnce(mockPost)
      mockPrisma.$transaction.mockResolvedValueOnce([])

      const { deletePostByAdmin } = await import('@/lib/actions/admin')
      const result = await deletePostByAdmin(mockPost.id, '不適切な内容')

      expect(result).toEqual({ success: true })
    })

    it('投稿が見つからない場合、エラーを返す', async () => {
      mockPrisma.post.findUnique.mockResolvedValueOnce(null)

      const { deletePostByAdmin } = await import('@/lib/actions/admin')
      const result = await deletePostByAdmin('nonexistent-id', '理由')

      expect(result).toEqual({ error: '投稿が見つかりません' })
    })
  })

  // ============================================================
  // deleteEventByAdmin
  // ============================================================

  describe('deleteEventByAdmin', () => {
    it('イベントを削除できる', async () => {
      mockPrisma.event.findUnique.mockResolvedValueOnce({ id: 'event-1' })
      mockPrisma.$transaction.mockResolvedValueOnce([])

      const { deleteEventByAdmin } = await import('@/lib/actions/admin')
      const result = await deleteEventByAdmin('event-1', '不適切な内容')

      expect(result).toEqual({ success: true })
    })

    it('イベントが見つからない場合、エラーを返す', async () => {
      mockPrisma.event.findUnique.mockResolvedValueOnce(null)

      const { deleteEventByAdmin } = await import('@/lib/actions/admin')
      const result = await deleteEventByAdmin('nonexistent-id', '理由')

      expect(result).toEqual({ error: 'イベントが見つかりません' })
    })
  })

  // ============================================================
  // deleteShopByAdmin
  // ============================================================

  describe('deleteShopByAdmin', () => {
    it('盆栽園を削除できる', async () => {
      mockPrisma.bonsaiShop.findUnique.mockResolvedValueOnce({ id: 'shop-1' })
      mockPrisma.$transaction.mockResolvedValueOnce([])

      const { deleteShopByAdmin } = await import('@/lib/actions/admin')
      const result = await deleteShopByAdmin('shop-1', '不適切な内容')

      expect(result).toEqual({ success: true })
    })

    it('盆栽園が見つからない場合、エラーを返す', async () => {
      mockPrisma.bonsaiShop.findUnique.mockResolvedValueOnce(null)

      const { deleteShopByAdmin } = await import('@/lib/actions/admin')
      const result = await deleteShopByAdmin('nonexistent-id', '理由')

      expect(result).toEqual({ error: '盆栽園が見つかりません' })
    })
  })

  // ============================================================
  // getAdminLogs
  // ============================================================

  describe('getAdminLogs', () => {
    it('管理者ログを取得できる', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          action: 'suspend_user',
          targetType: 'user',
          targetId: 'user-1',
          createdAt: new Date(),
          admin: {
            user: { id: mockUser.id, nickname: mockUser.nickname },
          },
        },
      ]
      mockPrisma.adminLog.findMany.mockResolvedValueOnce(mockLogs)
      mockPrisma.adminLog.count.mockResolvedValueOnce(1)

      const { getAdminLogs } = await import('@/lib/actions/admin')
      const result = await getAdminLogs()

      expect(result.logs).toHaveLength(1)
      expect(result.total).toBe(1)
    })

    it('アクションでフィルターできる', async () => {
      mockPrisma.adminLog.findMany.mockResolvedValueOnce([])
      mockPrisma.adminLog.count.mockResolvedValueOnce(0)

      const { getAdminLogs } = await import('@/lib/actions/admin')
      await getAdminLogs({ action: 'suspend_user' })

      expect(mockPrisma.adminLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { action: 'suspend_user' },
        })
      )
    })
  })

  // ============================================================
  // isAdmin
  // ============================================================

  describe('isAdmin', () => {
    it('管理者の場合、trueを返す', async () => {
      const { isAdmin } = await import('@/lib/actions/admin')
      const result = await isAdmin()

      expect(result).toBe(true)
    })

    it('未認証の場合、falseを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { isAdmin } = await import('@/lib/actions/admin')
      const result = await isAdmin()

      expect(result).toBe(false)
    })

    it('管理者でない場合、falseを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValueOnce(null)

      const { isAdmin } = await import('@/lib/actions/admin')
      const result = await isAdmin()

      expect(result).toBe(false)
    })
  })

  // ============================================================
  // getAdminInfo
  // ============================================================

  describe('getAdminInfo', () => {
    it('管理者情報を取得できる', async () => {
      const { getAdminInfo } = await import('@/lib/actions/admin')
      const result = await getAdminInfo()

      expect(result).toEqual({
        userId: mockUser.id,
        role: 'admin',
      })
    })

    it('未認証の場合、nullを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { getAdminInfo } = await import('@/lib/actions/admin')
      const result = await getAdminInfo()

      expect(result).toBeNull()
    })

    it('管理者でない場合、nullを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValueOnce(null)

      const { getAdminInfo } = await import('@/lib/actions/admin')
      const result = await getAdminInfo()

      expect(result).toBeNull()
    })
  })

  // ============================================================
  // deleteUserByAdmin
  // ============================================================

  describe('deleteUserByAdmin', () => {
    it('ユーザーを削除できる', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        ...mockUser,
        id: 'other-user-id',
      })
      mockPrisma.adminUser.findUnique
        .mockResolvedValueOnce(mockAdminUser) // checkAdminPermission
        .mockResolvedValueOnce(null) // 対象が管理者かチェック
      mockPrisma.$transaction.mockResolvedValueOnce([])

      const { deleteUserByAdmin } = await import('@/lib/actions/admin')
      const result = await deleteUserByAdmin('other-user-id', 'スパム行為')

      expect(result).toEqual({ success: true })
    })

    it('ユーザーが見つからない場合、エラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null)

      const { deleteUserByAdmin } = await import('@/lib/actions/admin')
      const result = await deleteUserByAdmin('nonexistent-id', '理由')

      expect(result).toEqual({ error: 'ユーザーが見つかりません' })
    })

    it('自分自身は削除できない', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockUser)

      const { deleteUserByAdmin } = await import('@/lib/actions/admin')
      const result = await deleteUserByAdmin(mockUser.id, '理由')

      expect(result).toEqual({ error: '自分自身を削除することはできません' })
    })

    it('管理者ユーザーは削除できない', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        ...mockUser,
        id: 'other-admin-id',
      })
      mockPrisma.adminUser.findUnique
        .mockResolvedValueOnce(mockAdminUser) // checkAdminPermission
        .mockResolvedValueOnce({ id: 'admin-2', userId: 'other-admin-id' }) // 対象が管理者

      const { deleteUserByAdmin } = await import('@/lib/actions/admin')
      const result = await deleteUserByAdmin('other-admin-id', '理由')

      expect(result).toEqual({ error: '管理者ユーザーは削除できません' })
    })
  })

  // ============================================================
  // getDailyActiveUsers
  // ============================================================

  describe('getDailyActiveUsers', () => {
    it('今日のアクティブユーザー数を取得できる', async () => {
      mockPrisma.user.count.mockResolvedValueOnce(50)

      const { getDailyActiveUsers } = await import('@/lib/actions/admin')
      const result = await getDailyActiveUsers()

      expect(result).toBe(50)
    })
  })

  // ============================================================
  // getStatsHistory
  // ============================================================

  describe('getStatsHistory', () => {
    it('統計履歴を取得できる', async () => {
      mockPrisma.user.count.mockResolvedValue(100)
      mockPrisma.post.count.mockResolvedValue(10)
      mockPrisma.comment.count.mockResolvedValue(5)

      const { getStatsHistory } = await import('@/lib/actions/admin')
      const result = await getStatsHistory(7)

      expect(result).toHaveLength(7)
      result.forEach((day: { date: string; users: number; posts: number; comments: number }) => {
        expect(day).toHaveProperty('date')
        expect(day).toHaveProperty('users')
        expect(day).toHaveProperty('posts')
        expect(day).toHaveProperty('comments')
      })
    })
  })

  // ============================================================
  // getAdminReviews
  // ============================================================

  describe('getAdminReviews', () => {
    it('レビュー一覧を取得できる', async () => {
      const mockReviews = [
        {
          id: 'review-1',
          content: 'レビュー内容',
          rating: 5,
          isHidden: false,
          createdAt: new Date(),
          user: { id: mockUser.id, nickname: mockUser.nickname, avatarUrl: null },
          shop: { id: 'shop-1', name: '盆栽園' },
        },
      ]
      mockPrisma.shopReview.findMany.mockResolvedValueOnce(mockReviews)
      mockPrisma.shopReview.count.mockResolvedValueOnce(1)
      mockPrisma.report.count.mockResolvedValueOnce(0)

      const { getAdminReviews } = await import('@/lib/actions/admin')
      const result = await getAdminReviews()

      expect(result.reviews).toHaveLength(1)
      expect(result.total).toBe(1)
    })
  })

  // ============================================================
  // deleteReviewByAdmin
  // ============================================================

  describe('deleteReviewByAdmin', () => {
    it('レビューを削除できる', async () => {
      mockPrisma.shopReview.findUnique.mockResolvedValueOnce({ id: 'review-1' })
      mockPrisma.$transaction.mockResolvedValueOnce([])

      const { deleteReviewByAdmin } = await import('@/lib/actions/admin')
      const result = await deleteReviewByAdmin('review-1', '不適切な内容')

      expect(result).toEqual({ success: true })
    })

    it('レビューが見つからない場合、エラーを返す', async () => {
      mockPrisma.shopReview.findUnique.mockResolvedValueOnce(null)

      const { deleteReviewByAdmin } = await import('@/lib/actions/admin')
      const result = await deleteReviewByAdmin('nonexistent-id', '理由')

      expect(result).toEqual({ error: 'レビューが見つかりません' })
    })
  })

  // ============================================================
  // getStatsSummary
  // ============================================================

  describe('getStatsSummary', () => {
    it('期間別統計サマリーを取得できる', async () => {
      mockPrisma.user.count
        .mockResolvedValueOnce(1000) // total
        .mockResolvedValueOnce(5)    // today
        .mockResolvedValueOnce(30)   // week
        .mockResolvedValueOnce(100)  // month
      mockPrisma.post.count
        .mockResolvedValueOnce(5000) // total
        .mockResolvedValueOnce(25)   // today
        .mockResolvedValueOnce(180)  // week
        .mockResolvedValueOnce(800)  // month
      mockPrisma.comment.count
        .mockResolvedValueOnce(15000) // total
        .mockResolvedValueOnce(80)    // today
        .mockResolvedValueOnce(550)   // week
        .mockResolvedValueOnce(2400)  // month

      const { getStatsSummary } = await import('@/lib/actions/admin')
      const result = await getStatsSummary()

      expect(result.users).toEqual({ total: 1000, today: 5, week: 30, month: 100 })
      expect(result.posts).toEqual({ total: 5000, today: 25, week: 180, month: 800 })
      expect(result.comments).toEqual({ total: 15000, today: 80, week: 550, month: 2400 })
    })
  })
})
