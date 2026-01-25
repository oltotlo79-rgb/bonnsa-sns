/**
 * @jest-environment node
 */
import { createMockPrismaClient, mockUser, mockDraft } from '../../utils/test-utils'

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

// ロガーモック
jest.mock('@/lib/logger', () => ({
  __esModule: true,
  default: {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
  logger: {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}))

describe('Draft Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
  })

  // ============================================================
  // getDrafts
  // ============================================================

  describe('getDrafts', () => {
    it('下書き一覧を取得できる', async () => {
      const mockDrafts = [
        { ...mockDraft, media: [], genres: [] },
      ]
      mockPrisma.draftPost.findMany.mockResolvedValueOnce(mockDrafts)

      const { getDrafts } = await import('@/lib/actions/draft')
      const result = await getDrafts()

      expect(result.drafts).toHaveLength(1)
      expect(result.drafts?.[0].content).toBe(mockDraft.content)
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { getDrafts } = await import('@/lib/actions/draft')
      const result = await getDrafts()

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('取得に失敗した場合、エラーを返す', async () => {
      mockPrisma.draftPost.findMany.mockRejectedValueOnce(new Error('Database error'))

      const { getDrafts } = await import('@/lib/actions/draft')
      const result = await getDrafts()

      expect(result).toEqual({ error: '下書きの取得に失敗しました' })
    })
  })

  // ============================================================
  // getDraftCount
  // ============================================================

  describe('getDraftCount', () => {
    it('下書きの件数を取得できる', async () => {
      mockPrisma.draftPost.count.mockResolvedValueOnce(5)

      const { getDraftCount } = await import('@/lib/actions/draft')
      const result = await getDraftCount()

      expect(result).toBe(5)
    })

    it('未認証の場合、0を返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { getDraftCount } = await import('@/lib/actions/draft')
      const result = await getDraftCount()

      expect(result).toBe(0)
    })

    it('エラー時は0を返す', async () => {
      mockPrisma.draftPost.count.mockRejectedValueOnce(new Error('Database error'))

      const { getDraftCount } = await import('@/lib/actions/draft')
      const result = await getDraftCount()

      expect(result).toBe(0)
    })
  })

  // ============================================================
  // saveDraft (新規作成)
  // ============================================================

  describe('saveDraft - 新規作成', () => {
    it('新規下書きを作成できる', async () => {
      const newDraft = { ...mockDraft, media: [], genres: [] }
      mockPrisma.draftPost.create.mockResolvedValueOnce(newDraft)

      const { saveDraft } = await import('@/lib/actions/draft')
      const result = await saveDraft({
        content: '下書きの内容',
        mediaUrls: [],
        genreIds: [],
      })

      expect(result.draft).toBeDefined()
      expect(mockPrisma.draftPost.create).toHaveBeenCalled()
    })

    it('メディアとジャンル付きで作成できる', async () => {
      const newDraft = {
        ...mockDraft,
        media: [{ url: '/image.jpg', type: 'image', sortOrder: 0 }],
        genres: [{ genreId: 'genre-1', genre: { id: 'genre-1', name: '黒松' } }],
      }
      mockPrisma.draftPost.create.mockResolvedValueOnce(newDraft)

      const { saveDraft } = await import('@/lib/actions/draft')
      const result = await saveDraft({
        content: '下書きの内容',
        mediaUrls: ['/image.jpg'],
        genreIds: ['genre-1'],
      })

      expect(result.draft).toBeDefined()
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { saveDraft } = await import('@/lib/actions/draft')
      const result = await saveDraft({ content: 'テスト' })

      expect(result).toEqual({ error: '認証が必要です' })
    })
  })

  // ============================================================
  // saveDraft (更新)
  // ============================================================

  describe('saveDraft - 更新', () => {
    it('既存の下書きを更新できる', async () => {
      mockPrisma.draftPost.findFirst.mockResolvedValueOnce(mockDraft)
      mockPrisma.$transaction.mockResolvedValueOnce([{ count: 0 }, { count: 0 }])
      mockPrisma.draftPost.update.mockResolvedValueOnce({
        ...mockDraft,
        content: '更新された内容',
        media: [],
        genres: [],
      })

      const { saveDraft } = await import('@/lib/actions/draft')
      const result = await saveDraft({
        id: mockDraft.id,
        content: '更新された内容',
      })

      expect(result.draft).toBeDefined()
      expect(result.draft?.content).toBe('更新された内容')
    })

    it('存在しない下書きの更新はエラーを返す', async () => {
      mockPrisma.draftPost.findFirst.mockResolvedValueOnce(null)

      const { saveDraft } = await import('@/lib/actions/draft')
      const result = await saveDraft({
        id: 'nonexistent-id',
        content: '更新',
      })

      expect(result).toEqual({ error: '下書きが見つかりません' })
    })
  })

  // ============================================================
  // publishDraft
  // ============================================================

  describe('publishDraft', () => {
    it('下書きから投稿を作成できる', async () => {
      mockPrisma.draftPost.findFirst.mockResolvedValueOnce({
        ...mockDraft,
        media: [],
        genres: [],
      })
      mockPrisma.post.create.mockResolvedValueOnce({ id: 'new-post-id' })
      mockPrisma.draftPost.delete.mockResolvedValueOnce(mockDraft)

      const { publishDraft } = await import('@/lib/actions/draft')
      const result = await publishDraft(mockDraft.id)

      expect(result).toEqual({ postId: 'new-post-id' })
      expect(mockPrisma.draftPost.delete).toHaveBeenCalled()
    })

    it('メディアとジャンル付きで投稿できる', async () => {
      mockPrisma.draftPost.findFirst.mockResolvedValueOnce({
        ...mockDraft,
        media: [{ url: '/image.jpg', type: 'image', sortOrder: 0 }],
        genres: [{ genreId: 'genre-1' }],
      })
      mockPrisma.post.create.mockResolvedValueOnce({ id: 'new-post-id' })
      mockPrisma.draftPost.delete.mockResolvedValueOnce(mockDraft)

      const { publishDraft } = await import('@/lib/actions/draft')
      const result = await publishDraft(mockDraft.id)

      expect(result).toEqual({ postId: 'new-post-id' })
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { publishDraft } = await import('@/lib/actions/draft')
      const result = await publishDraft(mockDraft.id)

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('下書きが見つからない場合、エラーを返す', async () => {
      mockPrisma.draftPost.findFirst.mockResolvedValueOnce(null)

      const { publishDraft } = await import('@/lib/actions/draft')
      const result = await publishDraft('nonexistent-id')

      expect(result).toEqual({ error: '下書きが見つかりません' })
    })

    it('投稿作成に失敗した場合、エラーを返す', async () => {
      mockPrisma.draftPost.findFirst.mockResolvedValueOnce({
        ...mockDraft,
        media: [],
        genres: [],
      })
      mockPrisma.post.create.mockRejectedValueOnce(new Error('Database error'))

      const { publishDraft } = await import('@/lib/actions/draft')
      const result = await publishDraft(mockDraft.id)

      expect(result).toEqual({ error: '投稿の作成に失敗しました' })
    })
  })

  // ============================================================
  // deleteDraft
  // ============================================================

  describe('deleteDraft', () => {
    it('下書きを削除できる', async () => {
      mockPrisma.draftPost.findFirst.mockResolvedValueOnce(mockDraft)
      mockPrisma.draftPost.delete.mockResolvedValueOnce(mockDraft)

      const { deleteDraft } = await import('@/lib/actions/draft')
      const result = await deleteDraft(mockDraft.id)

      expect(result).toEqual({ success: true })
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { deleteDraft } = await import('@/lib/actions/draft')
      const result = await deleteDraft(mockDraft.id)

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('下書きが見つからない場合、エラーを返す', async () => {
      mockPrisma.draftPost.findFirst.mockResolvedValueOnce(null)

      const { deleteDraft } = await import('@/lib/actions/draft')
      const result = await deleteDraft('nonexistent-id')

      expect(result).toEqual({ error: '下書きが見つかりません' })
    })

    it('削除に失敗した場合、エラーを返す', async () => {
      mockPrisma.draftPost.findFirst.mockResolvedValueOnce(mockDraft)
      mockPrisma.draftPost.delete.mockRejectedValueOnce(new Error('Database error'))

      const { deleteDraft } = await import('@/lib/actions/draft')
      const result = await deleteDraft(mockDraft.id)

      expect(result).toEqual({ error: '下書きの削除に失敗しました' })
    })
  })

  // ============================================================
  // getDraft
  // ============================================================

  describe('getDraft', () => {
    it('下書き詳細を取得できる', async () => {
      mockPrisma.draftPost.findFirst.mockResolvedValueOnce({
        ...mockDraft,
        media: [],
        genres: [],
      })

      const { getDraft } = await import('@/lib/actions/draft')
      const result = await getDraft(mockDraft.id)

      expect(result.draft).toBeDefined()
      expect(result.draft?.content).toBe(mockDraft.content)
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { getDraft } = await import('@/lib/actions/draft')
      const result = await getDraft(mockDraft.id)

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('下書きが見つからない場合、エラーを返す', async () => {
      mockPrisma.draftPost.findFirst.mockResolvedValueOnce(null)

      const { getDraft } = await import('@/lib/actions/draft')
      const result = await getDraft('nonexistent-id')

      expect(result).toEqual({ error: '下書きが見つかりません' })
    })

    it('取得に失敗した場合、エラーを返す', async () => {
      mockPrisma.draftPost.findFirst.mockRejectedValueOnce(new Error('Database error'))

      const { getDraft } = await import('@/lib/actions/draft')
      const result = await getDraft(mockDraft.id)

      expect(result).toEqual({ error: '下書きの取得に失敗しました' })
    })
  })
})
