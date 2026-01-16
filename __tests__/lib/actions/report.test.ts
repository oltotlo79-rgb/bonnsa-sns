/**
 * @jest-environment node
 */

import { createMockPrismaClient, mockUser, mockPost, mockReport } from '../../utils/test-utils'

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

describe('Report Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAuth.mockResolvedValue({
      user: { id: mockUser.id },
    })
  })

  describe('createReport', () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { createReport } = await import('@/lib/actions/report')
      const result = await createReport({
        targetType: 'post',
        targetId: 'test-post-id',
        reason: 'spam',
      })

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('存在しない投稿を通報するとエラーを返す', async () => {
      mockPrisma.post.findUnique.mockResolvedValue(null)

      const { createReport } = await import('@/lib/actions/report')
      const result = await createReport({
        targetType: 'post',
        targetId: 'non-existent',
        reason: 'spam',
      })

      expect(result).toEqual({ error: '対象が見つかりません' })
    })

    it('自分のコンテンツは通報できない', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({
        ...mockPost,
        userId: mockUser.id,
      })

      const { createReport } = await import('@/lib/actions/report')
      const result = await createReport({
        targetType: 'post',
        targetId: 'test-post-id',
        reason: 'spam',
      })

      expect(result).toEqual({ error: '自分自身のコンテンツは通報できません' })
    })

    it('既に通報済みの場合はエラーを返す', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({
        ...mockPost,
        userId: 'other-user-id',
      })
      mockPrisma.report.findFirst.mockResolvedValue(mockReport)

      const { createReport } = await import('@/lib/actions/report')
      const result = await createReport({
        targetType: 'post',
        targetId: 'test-post-id',
        reason: 'spam',
      })

      expect(result).toEqual({ error: '既に通報済みです' })
    })

    it('正常に通報を作成できる', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({
        ...mockPost,
        userId: 'other-user-id',
      })
      mockPrisma.report.findFirst.mockResolvedValue(null)
      mockPrisma.report.create.mockResolvedValue(mockReport)
      mockPrisma.report.count.mockResolvedValue(1)

      const { createReport } = await import('@/lib/actions/report')
      const result = await createReport({
        targetType: 'post',
        targetId: 'test-post-id',
        reason: 'spam',
        description: 'スパム投稿です',
      })

      expect(result).toEqual({ success: true })
    })

    it('コメントを通報できる', async () => {
      mockPrisma.comment.findUnique.mockResolvedValue({
        id: 'comment-id',
        userId: 'other-user-id',
      })
      mockPrisma.report.findFirst.mockResolvedValue(null)
      mockPrisma.report.create.mockResolvedValue(mockReport)
      mockPrisma.report.count.mockResolvedValue(1)

      const { createReport } = await import('@/lib/actions/report')
      const result = await createReport({
        targetType: 'comment',
        targetId: 'comment-id',
        reason: 'harassment',
      })

      expect(result).toEqual({ success: true })
    })

    it('イベントを通報できる', async () => {
      mockPrisma.event.findUnique.mockResolvedValue({
        id: 'event-id',
        createdBy: 'other-user-id',
      })
      mockPrisma.report.findFirst.mockResolvedValue(null)
      mockPrisma.report.create.mockResolvedValue(mockReport)
      mockPrisma.report.count.mockResolvedValue(1)

      const { createReport } = await import('@/lib/actions/report')
      const result = await createReport({
        targetType: 'event',
        targetId: 'event-id',
        reason: 'inappropriate',
      })

      expect(result).toEqual({ success: true })
    })

    it('盆栽園を通報できる', async () => {
      mockPrisma.bonsaiShop.findUnique.mockResolvedValue({
        id: 'shop-id',
        createdBy: 'other-user-id',
      })
      mockPrisma.report.findFirst.mockResolvedValue(null)
      mockPrisma.report.create.mockResolvedValue(mockReport)
      mockPrisma.report.count.mockResolvedValue(1)

      const { createReport } = await import('@/lib/actions/report')
      const result = await createReport({
        targetType: 'shop',
        targetId: 'shop-id',
        reason: 'other',
      })

      expect(result).toEqual({ success: true })
    })

    it('レビューを通報できる', async () => {
      mockPrisma.shopReview.findUnique.mockResolvedValue({
        id: 'review-id',
        userId: 'other-user-id',
      })
      mockPrisma.report.findFirst.mockResolvedValue(null)
      mockPrisma.report.create.mockResolvedValue(mockReport)
      mockPrisma.report.count.mockResolvedValue(1)

      const { createReport } = await import('@/lib/actions/report')
      const result = await createReport({
        targetType: 'review',
        targetId: 'review-id',
        reason: 'copyright',
      })

      expect(result).toEqual({ success: true })
    })

    it('ユーザーを通報できる', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'other-user-id',
      })
      mockPrisma.report.findFirst.mockResolvedValue(null)
      mockPrisma.report.create.mockResolvedValue(mockReport)
      mockPrisma.report.count.mockResolvedValue(1)

      const { createReport } = await import('@/lib/actions/report')
      const result = await createReport({
        targetType: 'user',
        targetId: 'other-user-id',
        reason: 'harassment',
      })

      expect(result).toEqual({ success: true })
    })

    it('10件の通報でコンテンツが自動非表示になる', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({
        ...mockPost,
        userId: 'other-user-id',
      })
      mockPrisma.report.findFirst.mockResolvedValue(null)
      mockPrisma.report.create.mockResolvedValue(mockReport)
      mockPrisma.report.count.mockResolvedValue(10) // 10件でしきい値に達する
      mockPrisma.post.update.mockResolvedValue(mockPost)
      mockPrisma.report.updateMany.mockResolvedValue({ count: 10 })
      mockPrisma.adminNotification.create.mockResolvedValue({})

      const { createReport } = await import('@/lib/actions/report')
      const result = await createReport({
        targetType: 'post',
        targetId: 'test-post-id',
        reason: 'spam',
      })

      expect(result).toEqual({ success: true })
      expect(mockPrisma.post.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'test-post-id' },
          data: expect.objectContaining({
            isHidden: true,
          }),
        })
      )
      expect(mockPrisma.adminNotification.create).toHaveBeenCalled()
    })
  })

  describe('getReports (管理者用)', () => {
    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)

      const { getReports } = await import('@/lib/actions/report')
      const result = await getReports()

      expect(result).toEqual({ error: '管理者権限が必要です' })
    })

    it('管理者は通報一覧を取得できる', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue({ userId: mockUser.id })
      mockPrisma.report.findMany.mockResolvedValue([mockReport])
      mockPrisma.report.count.mockResolvedValue(1)

      const { getReports } = await import('@/lib/actions/report')
      const result = await getReports()

      expect(result.reports).toHaveLength(1)
      expect(result.total).toBe(1)
    })

    it('ステータスでフィルタリングできる', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue({ userId: mockUser.id })
      mockPrisma.report.findMany.mockResolvedValue([])
      mockPrisma.report.count.mockResolvedValue(0)

      const { getReports } = await import('@/lib/actions/report')
      await getReports({ status: 'pending' })

      expect(mockPrisma.report.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'pending',
          }),
        })
      )
    })
  })

  describe('updateReportStatus (管理者用)', () => {
    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)

      const { updateReportStatus } = await import('@/lib/actions/report')
      const result = await updateReportStatus('report-id', 'resolved')

      expect(result).toEqual({ error: '管理者権限が必要です' })
    })

    it('存在しない通報はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue({ userId: mockUser.id })
      mockPrisma.report.findUnique.mockResolvedValue(null)

      const { updateReportStatus } = await import('@/lib/actions/report')
      const result = await updateReportStatus('non-existent', 'resolved')

      expect(result).toEqual({ error: '通報が見つかりません' })
    })

    it('通報ステータスを更新できる', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue({ userId: mockUser.id })
      mockPrisma.report.findUnique.mockResolvedValue(mockReport)
      mockPrisma.$transaction.mockResolvedValue([{}, {}])

      const { updateReportStatus } = await import('@/lib/actions/report')
      const result = await updateReportStatus('report-id', 'resolved', '対応完了')

      expect(result).toEqual({ success: true })
    })
  })

  describe('getReportStats (管理者用)', () => {
    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)

      const { getReportStats } = await import('@/lib/actions/report')
      const result = await getReportStats()

      expect(result).toEqual({ error: '管理者権限が必要です' })
    })

    it('通報統計を取得できる', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue({ userId: mockUser.id })
      mockPrisma.report.count.mockResolvedValueOnce(5) // pending
      mockPrisma.report.count.mockResolvedValueOnce(3) // reviewed
      mockPrisma.report.count.mockResolvedValueOnce(10) // resolved
      mockPrisma.report.count.mockResolvedValueOnce(2) // dismissed
      mockPrisma.report.groupBy.mockResolvedValue([
        { targetType: 'post', _count: 15 },
        { targetType: 'comment', _count: 5 },
      ])

      const { getReportStats } = await import('@/lib/actions/report')
      const result = await getReportStats()

      expect(result.stats).toBeDefined()
      expect(result.stats?.pending).toBe(5)
      expect(result.stats?.total).toBe(20)
    })
  })
})
