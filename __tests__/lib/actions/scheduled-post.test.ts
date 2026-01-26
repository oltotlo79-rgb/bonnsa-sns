/**
 * @jest-environment node
 */
import { createMockPrismaClient, mockUser, mockScheduledPost } from '../../utils/test-utils'

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
const mockGetMembershipLimits = jest.fn()
jest.mock('@/lib/premium', () => ({
  isPremiumUser: () => mockIsPremiumUser(),
  getMembershipLimits: () => mockGetMembershipLimits(),
}))

// revalidatePathモック
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
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

describe('Scheduled Post Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
    mockIsPremiumUser.mockResolvedValue(true)
    mockGetMembershipLimits.mockResolvedValue({
      maxPostLength: 2000,
      maxImages: 6,
      maxVideos: 3,
    })
  })

  // ============================================================
  // createScheduledPost
  // ============================================================

  describe('createScheduledPost', () => {
    it('予約投稿を作成できる', async () => {
      mockPrisma.scheduledPost.count.mockResolvedValueOnce(0)
      mockPrisma.scheduledPost.create.mockResolvedValueOnce(mockScheduledPost)

      const formData = new FormData()
      formData.set('content', '予約投稿テスト')
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 1)
      formData.set('scheduledAt', futureDate.toISOString())

      const { createScheduledPost } = await import('@/lib/actions/scheduled-post')
      const result = await createScheduledPost(formData)

      expect(result.success).toBe(true)
      expect(result.scheduledPostId).toBeDefined()
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const formData = new FormData()
      formData.set('content', 'テスト')
      formData.set('scheduledAt', new Date().toISOString())

      const { createScheduledPost } = await import('@/lib/actions/scheduled-post')
      const result = await createScheduledPost(formData)

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('無料会員の場合、エラーを返す', async () => {
      mockIsPremiumUser.mockResolvedValueOnce(false)

      const formData = new FormData()
      formData.set('content', 'テスト')
      formData.set('scheduledAt', new Date().toISOString())

      const { createScheduledPost } = await import('@/lib/actions/scheduled-post')
      const result = await createScheduledPost(formData)

      expect(result).toEqual({ error: '予約投稿は有料会員限定の機能です' })
    })

    it('予約日時が指定されていない場合、エラーを返す', async () => {
      const formData = new FormData()
      formData.set('content', 'テスト')

      const { createScheduledPost } = await import('@/lib/actions/scheduled-post')
      const result = await createScheduledPost(formData)

      expect(result).toEqual({ error: '予約日時を指定してください' })
    })

    it('過去の日時を指定した場合、エラーを返す', async () => {
      const formData = new FormData()
      formData.set('content', 'テスト')
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 1)
      formData.set('scheduledAt', pastDate.toISOString())

      const { createScheduledPost } = await import('@/lib/actions/scheduled-post')
      const result = await createScheduledPost(formData)

      expect(result).toEqual({ error: '予約日時は未来の日時を指定してください' })
    })

    it('30日以上先の日時を指定した場合、エラーを返す', async () => {
      const formData = new FormData()
      formData.set('content', 'テスト')
      const farFutureDate = new Date()
      farFutureDate.setDate(farFutureDate.getDate() + 31)
      formData.set('scheduledAt', farFutureDate.toISOString())

      const { createScheduledPost } = await import('@/lib/actions/scheduled-post')
      const result = await createScheduledPost(formData)

      expect(result).toEqual({ error: '予約日時は30日以内で指定してください' })
    })

    it('コンテンツもメディアも空の場合、エラーを返す', async () => {
      const formData = new FormData()
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 1)
      formData.set('scheduledAt', futureDate.toISOString())

      const { createScheduledPost } = await import('@/lib/actions/scheduled-post')
      const result = await createScheduledPost(formData)

      expect(result).toEqual({ error: 'テキストまたはメディアを入力してください' })
    })

    it('予約投稿が10件を超える場合、エラーを返す', async () => {
      mockPrisma.scheduledPost.count.mockResolvedValueOnce(10)

      const formData = new FormData()
      formData.set('content', 'テスト')
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 1)
      formData.set('scheduledAt', futureDate.toISOString())

      const { createScheduledPost } = await import('@/lib/actions/scheduled-post')
      const result = await createScheduledPost(formData)

      expect(result).toEqual({ error: '予約投稿は10件までです。既存の予約を削除してください。' })
    })

    it('投稿文字数が上限を超える場合、エラーを返す', async () => {
      mockGetMembershipLimits.mockResolvedValueOnce({
        maxPostLength: 100,
        maxImages: 6,
        maxVideos: 3,
      })

      const formData = new FormData()
      formData.set('content', 'a'.repeat(101)) // 上限を超える
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 1)
      formData.set('scheduledAt', futureDate.toISOString())

      const { createScheduledPost } = await import('@/lib/actions/scheduled-post')
      const result = await createScheduledPost(formData)

      expect(result).toEqual({ error: '投稿は100文字以内で入力してください' })
    })

    it('ジャンルが3つを超える場合、エラーを返す', async () => {
      const formData = new FormData()
      formData.set('content', 'テスト')
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 1)
      formData.set('scheduledAt', futureDate.toISOString())
      formData.append('genreIds', 'genre-1')
      formData.append('genreIds', 'genre-2')
      formData.append('genreIds', 'genre-3')
      formData.append('genreIds', 'genre-4')

      const { createScheduledPost } = await import('@/lib/actions/scheduled-post')
      const result = await createScheduledPost(formData)

      expect(result).toEqual({ error: 'ジャンルは3つまで選択できます' })
    })

    it('画像枚数が上限を超える場合、エラーを返す', async () => {
      mockGetMembershipLimits.mockResolvedValueOnce({
        maxPostLength: 2000,
        maxImages: 2,
        maxVideos: 3,
      })

      const formData = new FormData()
      formData.set('content', 'テスト')
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 1)
      formData.set('scheduledAt', futureDate.toISOString())
      formData.append('mediaUrls', 'https://example.com/1.jpg')
      formData.append('mediaUrls', 'https://example.com/2.jpg')
      formData.append('mediaUrls', 'https://example.com/3.jpg')
      formData.append('mediaTypes', 'image')
      formData.append('mediaTypes', 'image')
      formData.append('mediaTypes', 'image')

      const { createScheduledPost } = await import('@/lib/actions/scheduled-post')
      const result = await createScheduledPost(formData)

      expect(result).toEqual({ error: '画像は2枚までです' })
    })

    it('動画本数が上限を超える場合、エラーを返す', async () => {
      mockGetMembershipLimits.mockResolvedValueOnce({
        maxPostLength: 2000,
        maxImages: 6,
        maxVideos: 1,
      })

      const formData = new FormData()
      formData.set('content', 'テスト')
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 1)
      formData.set('scheduledAt', futureDate.toISOString())
      formData.append('mediaUrls', 'https://example.com/1.mp4')
      formData.append('mediaUrls', 'https://example.com/2.mp4')
      formData.append('mediaTypes', 'video')
      formData.append('mediaTypes', 'video')

      const { createScheduledPost } = await import('@/lib/actions/scheduled-post')
      const result = await createScheduledPost(formData)

      expect(result).toEqual({ error: '動画は1本までです' })
    })

    it('メディア付きで予約投稿を作成できる', async () => {
      mockPrisma.scheduledPost.count.mockResolvedValueOnce(0)
      mockPrisma.scheduledPost.create.mockResolvedValueOnce({
        ...mockScheduledPost,
        id: 'new-scheduled-id',
      })

      const formData = new FormData()
      formData.set('content', 'メディア付き投稿')
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 1)
      formData.set('scheduledAt', futureDate.toISOString())
      formData.append('mediaUrls', 'https://example.com/image.jpg')
      formData.append('mediaTypes', 'image')
      formData.append('genreIds', 'genre-1')

      const { createScheduledPost } = await import('@/lib/actions/scheduled-post')
      const result = await createScheduledPost(formData)

      expect(result.success).toBe(true)
      expect(mockPrisma.scheduledPost.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            content: 'メディア付き投稿',
          }),
        })
      )
    })
  })

  // ============================================================
  // getScheduledPosts
  // ============================================================

  describe('getScheduledPosts', () => {
    it('予約投稿一覧を取得できる', async () => {
      const mockScheduledPosts = [{
        ...mockScheduledPost,
        media: [],
        genres: [{ genre: { id: 'genre-1', name: '黒松' } }],
      }]
      mockPrisma.scheduledPost.findMany.mockResolvedValueOnce(mockScheduledPosts)

      const { getScheduledPosts } = await import('@/lib/actions/scheduled-post')
      const result = await getScheduledPosts()

      expect(result.scheduledPosts).toHaveLength(1)
      expect(result.scheduledPosts![0].genres[0].name).toBe('黒松')
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { getScheduledPosts } = await import('@/lib/actions/scheduled-post')
      const result = await getScheduledPosts()

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('無料会員の場合、エラーを返す', async () => {
      mockIsPremiumUser.mockResolvedValueOnce(false)

      const { getScheduledPosts } = await import('@/lib/actions/scheduled-post')
      const result = await getScheduledPosts()

      expect(result).toEqual({ error: '予約投稿は有料会員限定の機能です', scheduledPosts: [] })
    })
  })

  // ============================================================
  // getScheduledPost
  // ============================================================

  describe('getScheduledPost', () => {
    it('予約投稿詳細を取得できる', async () => {
      mockPrisma.scheduledPost.findUnique.mockResolvedValueOnce({
        ...mockScheduledPost,
        media: [],
        genres: [],
      })

      const { getScheduledPost } = await import('@/lib/actions/scheduled-post')
      const result = await getScheduledPost(mockScheduledPost.id)

      expect(result.scheduledPost).toBeDefined()
      expect(result.scheduledPost?.content).toBe(mockScheduledPost.content)
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { getScheduledPost } = await import('@/lib/actions/scheduled-post')
      const result = await getScheduledPost(mockScheduledPost.id)

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('存在しない予約投稿の場合、エラーを返す', async () => {
      mockPrisma.scheduledPost.findUnique.mockResolvedValueOnce(null)

      const { getScheduledPost } = await import('@/lib/actions/scheduled-post')
      const result = await getScheduledPost('nonexistent-id')

      expect(result).toEqual({ error: '予約投稿が見つかりません' })
    })

    it('他人の予約投稿にはアクセスできない', async () => {
      mockPrisma.scheduledPost.findUnique.mockResolvedValueOnce({
        ...mockScheduledPost,
        userId: 'other-user-id',
        media: [],
        genres: [],
      })

      const { getScheduledPost } = await import('@/lib/actions/scheduled-post')
      const result = await getScheduledPost(mockScheduledPost.id)

      expect(result).toEqual({ error: 'アクセス権限がありません' })
    })
  })

  // ============================================================
  // updateScheduledPost
  // ============================================================

  describe('updateScheduledPost', () => {
    it('予約投稿を更新できる', async () => {
      mockPrisma.scheduledPost.findUnique.mockResolvedValueOnce({
        userId: mockUser.id,
        status: 'pending',
      })
      mockPrisma.$transaction.mockResolvedValueOnce([])

      const formData = new FormData()
      formData.set('content', '更新された内容')
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 1)
      formData.set('scheduledAt', futureDate.toISOString())

      const { updateScheduledPost } = await import('@/lib/actions/scheduled-post')
      const result = await updateScheduledPost(mockScheduledPost.id, formData)

      expect(result).toEqual({ success: true })
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const formData = new FormData()
      formData.set('content', '更新')
      formData.set('scheduledAt', new Date().toISOString())

      const { updateScheduledPost } = await import('@/lib/actions/scheduled-post')
      const result = await updateScheduledPost(mockScheduledPost.id, formData)

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('存在しない予約投稿の場合、エラーを返す', async () => {
      mockPrisma.scheduledPost.findUnique.mockResolvedValueOnce(null)

      const formData = new FormData()
      formData.set('content', '更新')
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 1)
      formData.set('scheduledAt', futureDate.toISOString())

      const { updateScheduledPost } = await import('@/lib/actions/scheduled-post')
      const result = await updateScheduledPost('nonexistent-id', formData)

      expect(result).toEqual({ error: '予約投稿が見つかりません' })
    })

    it('他人の予約投稿は更新できない', async () => {
      mockPrisma.scheduledPost.findUnique.mockResolvedValueOnce({
        userId: 'other-user-id',
        status: 'pending',
      })

      const formData = new FormData()
      formData.set('content', '更新')
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 1)
      formData.set('scheduledAt', futureDate.toISOString())

      const { updateScheduledPost } = await import('@/lib/actions/scheduled-post')
      const result = await updateScheduledPost(mockScheduledPost.id, formData)

      expect(result).toEqual({ error: '更新権限がありません' })
    })

    it('公開済みの予約投稿は更新できない', async () => {
      mockPrisma.scheduledPost.findUnique.mockResolvedValueOnce({
        userId: mockUser.id,
        status: 'published',
      })

      const formData = new FormData()
      formData.set('content', '更新')
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 1)
      formData.set('scheduledAt', futureDate.toISOString())

      const { updateScheduledPost } = await import('@/lib/actions/scheduled-post')
      const result = await updateScheduledPost(mockScheduledPost.id, formData)

      expect(result).toEqual({ error: '公開済みまたはキャンセル済みの予約投稿は編集できません' })
    })
  })

  // ============================================================
  // deleteScheduledPost
  // ============================================================

  describe('deleteScheduledPost', () => {
    it('予約投稿を削除できる', async () => {
      mockPrisma.scheduledPost.findUnique.mockResolvedValueOnce({
        userId: mockUser.id,
        status: 'pending',
      })
      mockPrisma.scheduledPost.delete.mockResolvedValueOnce(mockScheduledPost)

      const { deleteScheduledPost } = await import('@/lib/actions/scheduled-post')
      const result = await deleteScheduledPost(mockScheduledPost.id)

      expect(result).toEqual({ success: true })
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { deleteScheduledPost } = await import('@/lib/actions/scheduled-post')
      const result = await deleteScheduledPost(mockScheduledPost.id)

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('存在しない予約投稿の場合、エラーを返す', async () => {
      mockPrisma.scheduledPost.findUnique.mockResolvedValueOnce(null)

      const { deleteScheduledPost } = await import('@/lib/actions/scheduled-post')
      const result = await deleteScheduledPost('nonexistent-id')

      expect(result).toEqual({ error: '予約投稿が見つかりません' })
    })

    it('公開済みの予約投稿は削除できない', async () => {
      mockPrisma.scheduledPost.findUnique.mockResolvedValueOnce({
        userId: mockUser.id,
        status: 'published',
      })

      const { deleteScheduledPost } = await import('@/lib/actions/scheduled-post')
      const result = await deleteScheduledPost(mockScheduledPost.id)

      expect(result).toEqual({ error: '公開済みの予約投稿は削除できません' })
    })
  })

  // ============================================================
  // cancelScheduledPost
  // ============================================================

  describe('cancelScheduledPost', () => {
    it('予約投稿をキャンセルできる', async () => {
      mockPrisma.scheduledPost.findUnique.mockResolvedValueOnce({
        userId: mockUser.id,
        status: 'pending',
      })
      mockPrisma.scheduledPost.update.mockResolvedValueOnce({
        ...mockScheduledPost,
        status: 'cancelled',
      })

      const { cancelScheduledPost } = await import('@/lib/actions/scheduled-post')
      const result = await cancelScheduledPost(mockScheduledPost.id)

      expect(result).toEqual({ success: true })
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { cancelScheduledPost } = await import('@/lib/actions/scheduled-post')
      const result = await cancelScheduledPost(mockScheduledPost.id)

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('pending以外のステータスはキャンセルできない', async () => {
      mockPrisma.scheduledPost.findUnique.mockResolvedValueOnce({
        userId: mockUser.id,
        status: 'published',
      })

      const { cancelScheduledPost } = await import('@/lib/actions/scheduled-post')
      const result = await cancelScheduledPost(mockScheduledPost.id)

      expect(result).toEqual({ error: '予約中の投稿のみキャンセルできます' })
    })
  })

  // ============================================================
  // publishScheduledPosts
  // ============================================================

  describe('publishScheduledPosts', () => {
    it('予約投稿を公開できる', async () => {
      const now = new Date()
      const pastDate = new Date(now.getTime() - 60000) // 1分前

      mockPrisma.scheduledPost.findMany.mockResolvedValueOnce([{
        id: mockScheduledPost.id,
        userId: mockUser.id,
        content: '予約投稿の内容',
        scheduledAt: pastDate,
        status: 'pending',
        media: [],
        genres: [],
      }])
      mockPrisma.post.create.mockResolvedValueOnce({ id: 'new-post-id' })
      mockPrisma.scheduledPost.update.mockResolvedValueOnce({
        ...mockScheduledPost,
        status: 'published',
      })

      const { publishScheduledPosts } = await import('@/lib/actions/scheduled-post')
      const result = await publishScheduledPosts()

      expect(result.published).toBe(1)
      expect(result.failed).toBe(0)
    })

    it('公開対象がない場合、0件を返す', async () => {
      mockPrisma.scheduledPost.findMany.mockResolvedValueOnce([])

      const { publishScheduledPosts } = await import('@/lib/actions/scheduled-post')
      const result = await publishScheduledPosts()

      expect(result).toEqual({ published: 0, failed: 0 })
    })

    it('エラーが発生した場合、failedをカウントする', async () => {
      const now = new Date()
      const pastDate = new Date(now.getTime() - 60000)

      mockPrisma.scheduledPost.findMany.mockResolvedValueOnce([{
        id: mockScheduledPost.id,
        userId: mockUser.id,
        content: '予約投稿の内容',
        scheduledAt: pastDate,
        status: 'pending',
        media: [],
        genres: [],
      }])
      mockPrisma.post.create.mockRejectedValueOnce(new Error('Database error'))
      mockPrisma.scheduledPost.update.mockResolvedValueOnce({
        ...mockScheduledPost,
        status: 'failed',
      })

      const { publishScheduledPosts } = await import('@/lib/actions/scheduled-post')
      const result = await publishScheduledPosts()

      expect(result.published).toBe(0)
      expect(result.failed).toBe(1)
    })

    it('メディアとジャンル付きの予約投稿を公開できる', async () => {
      const now = new Date()
      const pastDate = new Date(now.getTime() - 60000)

      mockPrisma.scheduledPost.findMany.mockResolvedValueOnce([{
        id: mockScheduledPost.id,
        userId: mockUser.id,
        content: '予約投稿の内容',
        scheduledAt: pastDate,
        status: 'pending',
        media: [
          { url: 'https://example.com/image.jpg', type: 'image', sortOrder: 0 },
        ],
        genres: [
          { genreId: 'genre-1' },
        ],
      }])
      mockPrisma.post.create.mockResolvedValueOnce({ id: 'new-post-id' })
      mockPrisma.scheduledPost.update.mockResolvedValueOnce({
        ...mockScheduledPost,
        status: 'published',
      })

      const { publishScheduledPosts } = await import('@/lib/actions/scheduled-post')
      const result = await publishScheduledPosts()

      expect(result.published).toBe(1)
      expect(result.failed).toBe(0)
      expect(mockPrisma.post.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            content: '予約投稿の内容',
            media: expect.objectContaining({
              create: expect.arrayContaining([
                expect.objectContaining({ url: 'https://example.com/image.jpg' }),
              ]),
            }),
            genres: expect.objectContaining({
              create: expect.arrayContaining([
                expect.objectContaining({ genreId: 'genre-1' }),
              ]),
            }),
          }),
        })
      )
    })
  })

  // ============================================================
  // deleteScheduledPost - 追加テスト
  // ============================================================

  describe('deleteScheduledPost - additional', () => {
    it('他人の予約投稿は削除できない', async () => {
      mockPrisma.scheduledPost.findUnique.mockResolvedValueOnce({
        userId: 'other-user-id',
        status: 'pending',
      })

      const { deleteScheduledPost } = await import('@/lib/actions/scheduled-post')
      const result = await deleteScheduledPost(mockScheduledPost.id)

      expect(result).toEqual({ error: '削除権限がありません' })
    })

    it('キャンセル済みの予約投稿も削除できる', async () => {
      mockPrisma.scheduledPost.findUnique.mockResolvedValueOnce({
        userId: mockUser.id,
        status: 'cancelled',
      })
      mockPrisma.scheduledPost.delete.mockResolvedValueOnce(mockScheduledPost)

      const { deleteScheduledPost } = await import('@/lib/actions/scheduled-post')
      const result = await deleteScheduledPost(mockScheduledPost.id)

      expect(result).toEqual({ success: true })
    })
  })

  // ============================================================
  // cancelScheduledPost - 追加テスト
  // ============================================================

  describe('cancelScheduledPost - additional', () => {
    it('存在しない予約投稿はキャンセルできない', async () => {
      mockPrisma.scheduledPost.findUnique.mockResolvedValueOnce(null)

      const { cancelScheduledPost } = await import('@/lib/actions/scheduled-post')
      const result = await cancelScheduledPost('nonexistent-id')

      expect(result).toEqual({ error: '予約投稿が見つかりません' })
    })

    it('他人の予約投稿はキャンセルできない', async () => {
      mockPrisma.scheduledPost.findUnique.mockResolvedValueOnce({
        userId: 'other-user-id',
        status: 'pending',
      })

      const { cancelScheduledPost } = await import('@/lib/actions/scheduled-post')
      const result = await cancelScheduledPost(mockScheduledPost.id)

      expect(result).toEqual({ error: 'キャンセル権限がありません' })
    })
  })

  // ============================================================
  // updateScheduledPost - 追加テスト
  // ============================================================

  describe('updateScheduledPost - additional', () => {
    it('予約日時が指定されていない場合、エラーを返す', async () => {
      mockPrisma.scheduledPost.findUnique.mockResolvedValueOnce({
        userId: mockUser.id,
        status: 'pending',
      })

      const formData = new FormData()
      formData.set('content', '更新内容')

      const { updateScheduledPost } = await import('@/lib/actions/scheduled-post')
      const result = await updateScheduledPost(mockScheduledPost.id, formData)

      expect(result).toEqual({ error: '予約日時を指定してください' })
    })

    it('過去の日時に更新しようとするとエラー', async () => {
      mockPrisma.scheduledPost.findUnique.mockResolvedValueOnce({
        userId: mockUser.id,
        status: 'pending',
      })

      const formData = new FormData()
      formData.set('content', '更新内容')
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 1)
      formData.set('scheduledAt', pastDate.toISOString())

      const { updateScheduledPost } = await import('@/lib/actions/scheduled-post')
      const result = await updateScheduledPost(mockScheduledPost.id, formData)

      expect(result).toEqual({ error: '予約日時は未来の日時を指定してください' })
    })

    it('コンテンツもメディアもない場合、エラーを返す', async () => {
      mockPrisma.scheduledPost.findUnique.mockResolvedValueOnce({
        userId: mockUser.id,
        status: 'pending',
      })

      const formData = new FormData()
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 1)
      formData.set('scheduledAt', futureDate.toISOString())

      const { updateScheduledPost } = await import('@/lib/actions/scheduled-post')
      const result = await updateScheduledPost(mockScheduledPost.id, formData)

      expect(result).toEqual({ error: 'テキストまたはメディアを入力してください' })
    })
  })
})
