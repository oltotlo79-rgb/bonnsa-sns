/**
 * @jest-environment node
 */

import { createMockPrismaClient, mockUser, mockShop } from '../../utils/test-utils'

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

describe('Shop Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAuth.mockResolvedValue({
      user: { id: mockUser.id },
    })
  })

  describe('getShops', () => {
    it('盆栽園一覧を取得できる', async () => {
      mockPrisma.bonsaiShop.findMany.mockResolvedValue([
        {
          ...mockShop,
          genres: [],
          reviews: [{ rating: 5 }, { rating: 4 }],
        },
      ])

      const { getShops } = await import('@/lib/actions/shop')
      const result = await getShops()

      expect(result.shops).toHaveLength(1)
      expect(result.shops[0].name).toBe('テスト盆栽園')
      expect(result.shops[0].averageRating).toBe(4.5)
    })

    it('非表示盆栽園は除外される', async () => {
      mockPrisma.bonsaiShop.findMany.mockResolvedValue([])

      const { getShops } = await import('@/lib/actions/shop')
      await getShops()

      expect(mockPrisma.bonsaiShop.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isHidden: false,
          }),
        })
      )
    })

    it('検索キーワードでフィルタリングできる', async () => {
      mockPrisma.bonsaiShop.findMany.mockResolvedValue([])

      const { getShops } = await import('@/lib/actions/shop')
      await getShops({ search: 'テスト' })

      expect(mockPrisma.bonsaiShop.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { name: { contains: 'テスト', mode: 'insensitive' } },
              { address: { contains: 'テスト', mode: 'insensitive' } },
            ],
          }),
        })
      )
    })
  })

  describe('getShop', () => {
    it('盆栽園詳細を取得できる', async () => {
      mockPrisma.bonsaiShop.findUnique.mockResolvedValue({
        ...mockShop,
        genres: [],
        reviews: [{ rating: 5, user: mockUser, images: [] }],
      })

      const { getShop } = await import('@/lib/actions/shop')
      const result = await getShop('test-shop-id')

      expect(result.shop).toBeDefined()
      expect(result.shop?.name).toBe('テスト盆栽園')
    })

    it('存在しない盆栽園はエラーを返す', async () => {
      mockPrisma.bonsaiShop.findUnique.mockResolvedValue(null)

      const { getShop } = await import('@/lib/actions/shop')
      const result = await getShop('non-existent')

      expect(result.error).toBe('盆栽園が見つかりません')
    })

    it('自分の盆栽園はisOwner=trueを返す', async () => {
      mockPrisma.bonsaiShop.findUnique.mockResolvedValue({
        ...mockShop,
        genres: [],
        reviews: [],
      })

      const { getShop } = await import('@/lib/actions/shop')
      const result = await getShop('test-shop-id')

      expect(result.shop?.isOwner).toBe(true)
    })
  })

  describe('createShop', () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { createShop } = await import('@/lib/actions/shop')
      const formData = new FormData()

      const result = await createShop(formData)

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('名称が空の場合はエラーを返す', async () => {
      const { createShop } = await import('@/lib/actions/shop')
      const formData = new FormData()
      formData.append('name', '')

      const result = await createShop(formData)

      expect(result).toEqual({ error: '名称を入力してください' })
    })

    it('住所が空の場合はエラーを返す', async () => {
      const { createShop } = await import('@/lib/actions/shop')
      const formData = new FormData()
      formData.append('name', 'テスト盆栽園')
      formData.append('address', '')

      const result = await createShop(formData)

      expect(result).toEqual({ error: '住所を入力してください' })
    })

    it('同じ住所の盆栽園が既に存在する場合はエラーを返す', async () => {
      mockPrisma.bonsaiShop.findFirst.mockResolvedValue({
        id: 'existing-shop-id',
        address: '東京都渋谷区',
      })

      const { createShop } = await import('@/lib/actions/shop')
      const formData = new FormData()
      formData.append('name', 'テスト盆栽園')
      formData.append('address', '東京都渋谷区')

      const result = await createShop(formData)

      expect(result.error).toBe('この住所の盆栽園は既に登録されています')
      expect(result.existingId).toBe('existing-shop-id')
    })

    it('正常に盆栽園を作成できる', async () => {
      mockPrisma.bonsaiShop.findFirst.mockResolvedValue(null)
      mockPrisma.bonsaiShop.create.mockResolvedValue({
        ...mockShop,
        id: 'new-shop-id',
      })

      const { createShop } = await import('@/lib/actions/shop')
      const formData = new FormData()
      formData.append('name', 'テスト盆栽園')
      formData.append('address', '東京都渋谷区代々木1-1-1')

      const result = await createShop(formData)

      expect(result.success).toBe(true)
      expect(result.shopId).toBe('new-shop-id')
    })
  })

  describe('updateShop', () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { updateShop } = await import('@/lib/actions/shop')
      const formData = new FormData()

      const result = await updateShop('shop-id', formData)

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('存在しない盆栽園はエラーを返す', async () => {
      mockPrisma.bonsaiShop.findUnique.mockResolvedValue(null)

      const { updateShop } = await import('@/lib/actions/shop')
      const formData = new FormData()

      const result = await updateShop('non-existent', formData)

      expect(result).toEqual({ error: '盆栽園が見つかりません' })
    })

    it('他人の盆栽園は編集できない', async () => {
      mockPrisma.bonsaiShop.findUnique.mockResolvedValue({
        ...mockShop,
        createdBy: 'other-user-id',
      })

      const { updateShop } = await import('@/lib/actions/shop')
      const formData = new FormData()

      const result = await updateShop('shop-id', formData)

      expect(result).toEqual({ error: '編集権限がありません' })
    })
  })

  describe('deleteShop', () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { deleteShop } = await import('@/lib/actions/shop')
      const result = await deleteShop('shop-id')

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('他人の盆栽園は削除できない', async () => {
      mockPrisma.bonsaiShop.findUnique.mockResolvedValue({
        ...mockShop,
        createdBy: 'other-user-id',
      })

      const { deleteShop } = await import('@/lib/actions/shop')
      const result = await deleteShop('shop-id')

      expect(result).toEqual({ error: '削除権限がありません' })
    })

    it('自分の盆栽園を削除できる', async () => {
      mockPrisma.bonsaiShop.findUnique.mockResolvedValue({
        ...mockShop,
        createdBy: mockUser.id,
      })
      mockPrisma.bonsaiShop.delete.mockResolvedValue(mockShop)

      const { deleteShop } = await import('@/lib/actions/shop')
      const result = await deleteShop('shop-id')

      expect(result).toEqual({ success: true })
    })
  })
})
