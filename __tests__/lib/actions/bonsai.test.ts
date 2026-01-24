/**
 * @jest-environment node
 */
import { createMockPrismaClient, mockUser, mockBonsai, mockBonsaiRecord } from '../../utils/test-utils'

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
}))

// レート制限モック
jest.mock('@/lib/rate-limit', () => ({
  rateLimit: jest.fn().mockResolvedValue({ success: true }),
  RATE_LIMITS: { search: { limit: 20, window: 60 } },
}))

// headersモック
jest.mock('next/headers', () => ({
  headers: jest.fn().mockResolvedValue({
    get: jest.fn().mockReturnValue('127.0.0.1'),
  }),
}))

describe('Bonsai Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
  })

  // ============================================================
  // getBonsais
  // ============================================================

  describe('getBonsais', () => {
    it('盆栽一覧を取得できる', async () => {
      const mockBonsais = [
        { ...mockBonsai, records: [], _count: { records: 5 } },
      ]
      mockPrisma.bonsai.findMany.mockResolvedValueOnce(mockBonsais)

      const { getBonsais } = await import('@/lib/actions/bonsai')
      const result = await getBonsais()

      expect(result.bonsais).toHaveLength(1)
      expect(result.bonsais?.[0].name).toBe(mockBonsai.name)
    })

    it('他ユーザーの盆栽一覧を取得できる', async () => {
      const mockBonsais = [{ ...mockBonsai, records: [], _count: { records: 3 } }]
      mockPrisma.bonsai.findMany.mockResolvedValueOnce(mockBonsais)

      const { getBonsais } = await import('@/lib/actions/bonsai')
      const result = await getBonsais('other-user-id')

      expect(result.bonsais).toBeDefined()
      expect(mockPrisma.bonsai.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'other-user-id' },
        })
      )
    })

    it('未認証でユーザーID指定なしの場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { getBonsais } = await import('@/lib/actions/bonsai')
      const result = await getBonsais()

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('取得に失敗した場合、エラーを返す', async () => {
      mockPrisma.bonsai.findMany.mockRejectedValueOnce(new Error('Database error'))

      const { getBonsais } = await import('@/lib/actions/bonsai')
      const result = await getBonsais()

      expect(result).toEqual({ error: '盆栽一覧の取得に失敗しました' })
    })
  })

  // ============================================================
  // getBonsai
  // ============================================================

  describe('getBonsai', () => {
    it('盆栽詳細を取得できる', async () => {
      mockPrisma.bonsai.findUnique.mockResolvedValueOnce({
        ...mockBonsai,
        user: { id: mockUser.id, nickname: mockUser.nickname, avatarUrl: mockUser.avatarUrl },
        records: [],
        _count: { records: 0 },
      })

      const { getBonsai } = await import('@/lib/actions/bonsai')
      const result = await getBonsai(mockBonsai.id)

      expect(result.bonsai?.name).toBe(mockBonsai.name)
    })

    it('盆栽が見つからない場合、エラーを返す', async () => {
      mockPrisma.bonsai.findUnique.mockResolvedValueOnce(null)

      const { getBonsai } = await import('@/lib/actions/bonsai')
      const result = await getBonsai('nonexistent-id')

      expect(result).toEqual({ error: '盆栽が見つかりません' })
    })

    it('取得に失敗した場合、エラーを返す', async () => {
      mockPrisma.bonsai.findUnique.mockRejectedValueOnce(new Error('Database error'))

      const { getBonsai } = await import('@/lib/actions/bonsai')
      const result = await getBonsai(mockBonsai.id)

      expect(result).toEqual({ error: '盆栽の取得に失敗しました' })
    })
  })

  // ============================================================
  // createBonsai
  // ============================================================

  describe('createBonsai', () => {
    it('盆栽を登録できる', async () => {
      mockPrisma.bonsai.create.mockResolvedValueOnce(mockBonsai)

      const { createBonsai } = await import('@/lib/actions/bonsai')
      const result = await createBonsai({
        name: '黒松',
        species: '黒松',
        description: 'テスト盆栽',
      })

      expect(result.bonsai).toBeDefined()
      expect(mockPrisma.bonsai.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockUser.id,
          name: '黒松',
        }),
      })
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { createBonsai } = await import('@/lib/actions/bonsai')
      const result = await createBonsai({ name: '黒松' })

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('登録に失敗した場合、エラーを返す', async () => {
      mockPrisma.bonsai.create.mockRejectedValueOnce(new Error('Database error'))

      const { createBonsai } = await import('@/lib/actions/bonsai')
      const result = await createBonsai({ name: '黒松' })

      expect(result).toEqual({ error: '盆栽の登録に失敗しました' })
    })
  })

  // ============================================================
  // updateBonsai
  // ============================================================

  describe('updateBonsai', () => {
    it('盆栽を更新できる', async () => {
      mockPrisma.bonsai.findFirst.mockResolvedValueOnce(mockBonsai)
      mockPrisma.bonsai.update.mockResolvedValueOnce({ ...mockBonsai, name: '更新後の名前' })

      const { updateBonsai } = await import('@/lib/actions/bonsai')
      const result = await updateBonsai(mockBonsai.id, { name: '更新後の名前' })

      expect(result.bonsai?.name).toBe('更新後の名前')
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { updateBonsai } = await import('@/lib/actions/bonsai')
      const result = await updateBonsai(mockBonsai.id, { name: '更新' })

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('盆栽が見つからない場合、エラーを返す', async () => {
      mockPrisma.bonsai.findFirst.mockResolvedValueOnce(null)

      const { updateBonsai } = await import('@/lib/actions/bonsai')
      const result = await updateBonsai('nonexistent-id', { name: '更新' })

      expect(result).toEqual({ error: '盆栽が見つかりません' })
    })
  })

  // ============================================================
  // deleteBonsai
  // ============================================================

  describe('deleteBonsai', () => {
    it('盆栽を削除できる', async () => {
      mockPrisma.bonsai.findFirst.mockResolvedValueOnce(mockBonsai)
      mockPrisma.bonsai.delete.mockResolvedValueOnce(mockBonsai)

      const { deleteBonsai } = await import('@/lib/actions/bonsai')
      const result = await deleteBonsai(mockBonsai.id)

      expect(result).toEqual({ success: true })
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { deleteBonsai } = await import('@/lib/actions/bonsai')
      const result = await deleteBonsai(mockBonsai.id)

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('盆栽が見つからない場合、エラーを返す', async () => {
      mockPrisma.bonsai.findFirst.mockResolvedValueOnce(null)

      const { deleteBonsai } = await import('@/lib/actions/bonsai')
      const result = await deleteBonsai('nonexistent-id')

      expect(result).toEqual({ error: '盆栽が見つかりません' })
    })
  })

  // ============================================================
  // addBonsaiRecord
  // ============================================================

  describe('addBonsaiRecord', () => {
    it('成長記録を追加できる', async () => {
      mockPrisma.bonsai.findFirst.mockResolvedValueOnce(mockBonsai)
      mockPrisma.bonsaiRecord.create.mockResolvedValueOnce({
        ...mockBonsaiRecord,
        images: [],
      })

      const { addBonsaiRecord } = await import('@/lib/actions/bonsai')
      const result = await addBonsaiRecord({
        bonsaiId: mockBonsai.id,
        content: '水やりしました',
      })

      expect(result.record).toBeDefined()
    })

    it('画像付きで記録を追加できる', async () => {
      mockPrisma.bonsai.findFirst.mockResolvedValueOnce(mockBonsai)
      mockPrisma.bonsaiRecord.create.mockResolvedValueOnce({
        ...mockBonsaiRecord,
        images: [{ url: '/image.jpg', sortOrder: 0 }],
      })

      const { addBonsaiRecord } = await import('@/lib/actions/bonsai')
      const result = await addBonsaiRecord({
        bonsaiId: mockBonsai.id,
        content: '水やりしました',
        imageUrls: ['/image.jpg'],
      })

      expect(result.record).toBeDefined()
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { addBonsaiRecord } = await import('@/lib/actions/bonsai')
      const result = await addBonsaiRecord({ bonsaiId: mockBonsai.id })

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('盆栽が見つからない場合、エラーを返す', async () => {
      mockPrisma.bonsai.findFirst.mockResolvedValueOnce(null)

      const { addBonsaiRecord } = await import('@/lib/actions/bonsai')
      const result = await addBonsaiRecord({ bonsaiId: 'nonexistent-id' })

      expect(result).toEqual({ error: '盆栽が見つかりません' })
    })
  })

  // ============================================================
  // updateBonsaiRecord
  // ============================================================

  describe('updateBonsaiRecord', () => {
    it('成長記録を更新できる', async () => {
      mockPrisma.bonsaiRecord.findFirst.mockResolvedValueOnce({
        ...mockBonsaiRecord,
        bonsai: { userId: mockUser.id },
      })
      mockPrisma.bonsaiRecord.update.mockResolvedValueOnce({
        ...mockBonsaiRecord,
        content: '更新された内容',
        images: [],
      })

      const { updateBonsaiRecord } = await import('@/lib/actions/bonsai')
      const result = await updateBonsaiRecord(mockBonsaiRecord.id, { content: '更新された内容' })

      expect(result.record?.content).toBe('更新された内容')
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { updateBonsaiRecord } = await import('@/lib/actions/bonsai')
      const result = await updateBonsaiRecord(mockBonsaiRecord.id, { content: '更新' })

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('記録が見つからない場合、エラーを返す', async () => {
      mockPrisma.bonsaiRecord.findFirst.mockResolvedValueOnce(null)

      const { updateBonsaiRecord } = await import('@/lib/actions/bonsai')
      const result = await updateBonsaiRecord('nonexistent-id', { content: '更新' })

      expect(result).toEqual({ error: '成長記録が見つかりません' })
    })
  })

  // ============================================================
  // deleteBonsaiRecord
  // ============================================================

  describe('deleteBonsaiRecord', () => {
    it('成長記録を削除できる', async () => {
      mockPrisma.bonsaiRecord.findFirst.mockResolvedValueOnce({
        ...mockBonsaiRecord,
        bonsai: { userId: mockUser.id },
        bonsaiId: mockBonsai.id,
      })
      mockPrisma.bonsaiRecord.delete.mockResolvedValueOnce(mockBonsaiRecord)

      const { deleteBonsaiRecord } = await import('@/lib/actions/bonsai')
      const result = await deleteBonsaiRecord(mockBonsaiRecord.id)

      expect(result).toEqual({ success: true })
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { deleteBonsaiRecord } = await import('@/lib/actions/bonsai')
      const result = await deleteBonsaiRecord(mockBonsaiRecord.id)

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('記録が見つからない場合、エラーを返す', async () => {
      mockPrisma.bonsaiRecord.findFirst.mockResolvedValueOnce(null)

      const { deleteBonsaiRecord } = await import('@/lib/actions/bonsai')
      const result = await deleteBonsaiRecord('nonexistent-id')

      expect(result).toEqual({ error: '成長記録が見つかりません' })
    })
  })

  // ============================================================
  // getBonsaiTimeline
  // ============================================================

  describe('getBonsaiTimeline', () => {
    it('盆栽タイムラインを取得できる', async () => {
      const mockRecords = [
        {
          ...mockBonsaiRecord,
          bonsai: {
            ...mockBonsai,
            user: { id: mockUser.id, nickname: mockUser.nickname, avatarUrl: mockUser.avatarUrl },
          },
          images: [],
        },
      ]
      mockPrisma.bonsaiRecord.findMany.mockResolvedValueOnce(mockRecords)

      const { getBonsaiTimeline } = await import('@/lib/actions/bonsai')
      const result = await getBonsaiTimeline()

      expect(result.records).toHaveLength(1)
    })

    it('エラー時は空配列を返す', async () => {
      mockPrisma.bonsaiRecord.findMany.mockRejectedValueOnce(new Error('Database error'))

      const { getBonsaiTimeline } = await import('@/lib/actions/bonsai')
      const result = await getBonsaiTimeline()

      expect(result).toEqual({ records: [], nextCursor: undefined })
    })
  })

  // ============================================================
  // getBonsaiRecords
  // ============================================================

  describe('getBonsaiRecords', () => {
    it('特定盆栽の成長記録一覧を取得できる', async () => {
      const mockRecords = [{ ...mockBonsaiRecord, images: [] }]
      mockPrisma.bonsaiRecord.findMany.mockResolvedValueOnce(mockRecords)

      const { getBonsaiRecords } = await import('@/lib/actions/bonsai')
      const result = await getBonsaiRecords(mockBonsai.id)

      expect(result.records).toHaveLength(1)
    })

    it('エラー時は空配列を返す', async () => {
      mockPrisma.bonsaiRecord.findMany.mockRejectedValueOnce(new Error('Database error'))

      const { getBonsaiRecords } = await import('@/lib/actions/bonsai')
      const result = await getBonsaiRecords(mockBonsai.id)

      expect(result).toEqual({ records: [], nextCursor: undefined })
    })
  })

  // ============================================================
  // searchBonsais
  // ============================================================

  describe('searchBonsais', () => {
    it('盆栽を検索できる', async () => {
      const mockBonsais = [{ ...mockBonsai, records: [], _count: { records: 0 } }]
      mockPrisma.bonsai.findMany.mockResolvedValueOnce(mockBonsais)

      const { searchBonsais } = await import('@/lib/actions/bonsai')
      const result = await searchBonsais('黒松')

      expect(result.bonsais).toHaveLength(1)
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { searchBonsais } = await import('@/lib/actions/bonsai')
      const result = await searchBonsais('黒松')

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('クエリが長すぎる場合、エラーを返す', async () => {
      const { searchBonsais } = await import('@/lib/actions/bonsai')
      const result = await searchBonsais('a'.repeat(101))

      expect(result).toEqual({ bonsais: [], error: '検索キーワードが長すぎます' })
    })
  })
})
