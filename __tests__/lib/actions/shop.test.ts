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

    it('存在しない盆栽園は削除できない', async () => {
      mockPrisma.bonsaiShop.findUnique.mockResolvedValue(null)

      const { deleteShop } = await import('@/lib/actions/shop')
      const result = await deleteShop('non-existent')

      expect(result).toEqual({ error: '盆栽園が見つかりません' })
    })
  })

  describe('getShops - 追加テスト', () => {
    it('ジャンルでフィルタリングできる', async () => {
      mockPrisma.bonsaiShop.findMany.mockResolvedValue([])

      const { getShops } = await import('@/lib/actions/shop')
      await getShops({ genreId: 'genre-1' })

      expect(mockPrisma.bonsaiShop.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            genres: {
              some: { genreId: 'genre-1' },
            },
          }),
        })
      )
    })

    it('名前順でソートできる', async () => {
      mockPrisma.bonsaiShop.findMany.mockResolvedValue([])

      const { getShops } = await import('@/lib/actions/shop')
      await getShops({ sortBy: 'name' })

      expect(mockPrisma.bonsaiShop.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { name: 'asc' },
        })
      )
    })

    it('評価順でソートできる', async () => {
      mockPrisma.bonsaiShop.findMany.mockResolvedValue([
        {
          ...mockShop,
          id: 'shop-1',
          genres: [],
          reviews: [{ rating: 3 }],
        },
        {
          ...mockShop,
          id: 'shop-2',
          genres: [],
          reviews: [{ rating: 5 }],
        },
      ])

      const { getShops } = await import('@/lib/actions/shop')
      const result = await getShops({ sortBy: 'rating' })

      // 評価の高い方が先
      expect(result.shops[0].averageRating).toBe(5)
      expect(result.shops[1].averageRating).toBe(3)
    })

    it('レビューがない盆栽園は評価順ソートで後ろになる', async () => {
      mockPrisma.bonsaiShop.findMany.mockResolvedValue([
        {
          ...mockShop,
          id: 'shop-1',
          genres: [],
          reviews: [],
        },
        {
          ...mockShop,
          id: 'shop-2',
          genres: [],
          reviews: [{ rating: 3 }],
        },
      ])

      const { getShops } = await import('@/lib/actions/shop')
      const result = await getShops({ sortBy: 'rating' })

      expect(result.shops[0].averageRating).toBe(3)
      expect(result.shops[1].averageRating).toBeNull()
    })
  })

  describe('updateShop - 追加テスト', () => {
    it('正常に盆栽園を更新できる', async () => {
      mockPrisma.bonsaiShop.findUnique.mockResolvedValue({
        ...mockShop,
        createdBy: mockUser.id,
      })
      mockPrisma.shopGenre.deleteMany.mockResolvedValue({})
      mockPrisma.bonsaiShop.update.mockResolvedValue(mockShop)

      const { updateShop } = await import('@/lib/actions/shop')
      const formData = new FormData()
      formData.append('name', '新しい名前')
      formData.append('address', '新しい住所')

      const result = await updateShop('shop-id', formData)

      expect(result).toEqual({ success: true })
      expect(mockPrisma.bonsaiShop.update).toHaveBeenCalled()
    })

    it('名称が空の場合はエラーを返す', async () => {
      mockPrisma.bonsaiShop.findUnique.mockResolvedValue({
        ...mockShop,
        createdBy: mockUser.id,
      })

      const { updateShop } = await import('@/lib/actions/shop')
      const formData = new FormData()
      formData.append('name', '')
      formData.append('address', '東京都渋谷区')

      const result = await updateShop('shop-id', formData)

      expect(result).toEqual({ error: '名称を入力してください' })
    })

    it('住所が空の場合はエラーを返す', async () => {
      mockPrisma.bonsaiShop.findUnique.mockResolvedValue({
        ...mockShop,
        createdBy: mockUser.id,
      })

      const { updateShop } = await import('@/lib/actions/shop')
      const formData = new FormData()
      formData.append('name', 'テスト盆栽園')
      formData.append('address', '')

      const result = await updateShop('shop-id', formData)

      expect(result).toEqual({ error: '住所を入力してください' })
    })
  })

  describe('geocodeAddress', () => {
    it('住所から緯度経度を取得できる', async () => {
      // fetchのモック
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([
          {
            geometry: { coordinates: [139.6503, 35.6762] },
            properties: { title: '東京都渋谷区代々木1-1-1' },
          },
        ]),
      })

      const { geocodeAddress } = await import('@/lib/actions/shop')
      const result = await geocodeAddress('東京都渋谷区')

      expect(result.latitude).toBe(35.6762)
      expect(result.longitude).toBe(139.6503)
      expect(result.displayName).toBe('東京都渋谷区代々木1-1-1')
    })

    it('住所が見つからない場合はエラーを返す', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      })

      const { geocodeAddress } = await import('@/lib/actions/shop')
      const result = await geocodeAddress('存在しない住所')

      expect(result.error).toBe('住所が見つかりませんでした')
    })

    it('APIエラーの場合はエラーを返す', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
      })

      const { geocodeAddress } = await import('@/lib/actions/shop')
      const result = await geocodeAddress('東京都')

      expect(result.error).toBe('住所の検索に失敗しました')
    })

    it('例外発生時はエラーを返す', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'))

      const { geocodeAddress } = await import('@/lib/actions/shop')
      const result = await geocodeAddress('東京都')

      expect(result.error).toBe('住所の検索中にエラーが発生しました')
    })
  })

  describe('searchAddressSuggestions', () => {
    it('住所候補を検索できる', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([
          {
            geometry: { coordinates: [139.6503, 35.6762] },
            properties: { title: '東京都渋谷区' },
          },
          {
            geometry: { coordinates: [139.7454, 35.6585] },
            properties: { title: '東京都港区' },
          },
        ]),
      })

      const { searchAddressSuggestions } = await import('@/lib/actions/shop')
      const result = await searchAddressSuggestions('東京都')

      expect(result.suggestions).toHaveLength(2)
      expect(result.suggestions[0].displayName).toBe('東京都渋谷区')
    })

    it('クエリが2文字未満の場合は空を返す', async () => {
      const { searchAddressSuggestions } = await import('@/lib/actions/shop')
      const result = await searchAddressSuggestions('東')

      expect(result.suggestions).toEqual([])
    })

    it('空のクエリの場合は空を返す', async () => {
      const { searchAddressSuggestions } = await import('@/lib/actions/shop')
      const result = await searchAddressSuggestions('')

      expect(result.suggestions).toEqual([])
    })

    it('APIエラーの場合は空を返す', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
      })

      const { searchAddressSuggestions } = await import('@/lib/actions/shop')
      const result = await searchAddressSuggestions('東京都')

      expect(result.suggestions).toEqual([])
      expect(result.originalQuery).toBe('東京都')
    })

    it('結果がない場合は空を返す', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      })

      const { searchAddressSuggestions } = await import('@/lib/actions/shop')
      const result = await searchAddressSuggestions('存在しない地名')

      expect(result.suggestions).toEqual([])
    })

    it('最大5件の候補を返す', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(
          Array(10).fill(null).map((_, i) => ({
            geometry: { coordinates: [139.0 + i, 35.0 + i] },
            properties: { title: `地名${i}` },
          }))
        ),
      })

      const { searchAddressSuggestions } = await import('@/lib/actions/shop')
      const result = await searchAddressSuggestions('東京')

      expect(result.suggestions).toHaveLength(5)
    })
  })

  describe('getShopGenres', () => {
    it('盆栽園のジャンル一覧を取得できる', async () => {
      mockPrisma.genre.findMany.mockResolvedValue([
        { id: 'genre-1', name: '販売店', category: 'shop', sortOrder: 1, type: 'shop' },
        { id: 'genre-2', name: '展示園', category: 'shop', sortOrder: 2, type: 'shop' },
      ])

      const { getShopGenres } = await import('@/lib/actions/shop')
      const result = await getShopGenres()

      expect(result.genres).toHaveLength(2)
      expect(mockPrisma.genre.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { type: 'shop' },
        })
      )
    })
  })

  describe('updateShopGenres', () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { updateShopGenres } = await import('@/lib/actions/shop')
      const result = await updateShopGenres('shop-id', ['genre-1'])

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('ジャンルの形式が不正な場合はエラーを返す', async () => {
      const { updateShopGenres } = await import('@/lib/actions/shop')
      // @ts-expect-error - 意図的に不正な値を渡す
      const result = await updateShopGenres('shop-id', 'not-an-array')

      expect(result).toEqual({ error: 'ジャンルの形式が不正です' })
    })

    it('ジャンルが5つを超える場合はエラーを返す', async () => {
      const { updateShopGenres } = await import('@/lib/actions/shop')
      const result = await updateShopGenres('shop-id', ['g1', 'g2', 'g3', 'g4', 'g5', 'g6'])

      expect(result).toEqual({ error: 'ジャンルは5つまで選択できます' })
    })

    it('盆栽園が存在しない場合はエラーを返す', async () => {
      mockPrisma.bonsaiShop.findUnique.mockResolvedValue(null)

      const { updateShopGenres } = await import('@/lib/actions/shop')
      const result = await updateShopGenres('non-existent', ['genre-1'])

      expect(result).toEqual({ error: '盆栽園が見つかりません' })
    })

    it('無効なジャンルIDが含まれる場合はエラーを返す', async () => {
      mockPrisma.bonsaiShop.findUnique.mockResolvedValue({ id: 'shop-id' })
      mockPrisma.genre.findMany.mockResolvedValue([
        { id: 'genre-1' },
      ])

      const { updateShopGenres } = await import('@/lib/actions/shop')
      const result = await updateShopGenres('shop-id', ['genre-1', 'invalid-genre'])

      expect(result).toEqual({ error: '無効なジャンルが含まれています' })
    })

    it('正常にジャンルを更新できる', async () => {
      mockPrisma.bonsaiShop.findUnique.mockResolvedValue({ id: 'shop-id' })
      mockPrisma.genre.findMany.mockResolvedValue([
        { id: 'genre-1' },
        { id: 'genre-2' },
      ])

      const { updateShopGenres } = await import('@/lib/actions/shop')
      const result = await updateShopGenres('shop-id', ['genre-1', 'genre-2'])

      expect(result).toEqual({ success: true })
      expect(mockPrisma.$transaction).toHaveBeenCalled()
    })

    it('空のジャンル配列で更新できる', async () => {
      mockPrisma.bonsaiShop.findUnique.mockResolvedValue({ id: 'shop-id' })

      const { updateShopGenres } = await import('@/lib/actions/shop')
      const result = await updateShopGenres('shop-id', [])

      expect(result).toEqual({ success: true })
    })
  })

  describe('createShopChangeRequest', () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { createShopChangeRequest } = await import('@/lib/actions/shop')
      const result = await createShopChangeRequest('shop-id', { name: '新しい名前' })

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('盆栽園が存在しない場合はエラーを返す', async () => {
      mockPrisma.bonsaiShop.findUnique.mockResolvedValue(null)

      const { createShopChangeRequest } = await import('@/lib/actions/shop')
      const result = await createShopChangeRequest('non-existent', { name: '新しい名前' })

      expect(result).toEqual({ error: '盆栽園が見つかりません' })
    })

    it('登録者は変更リクエストを作成できない', async () => {
      mockPrisma.bonsaiShop.findUnique.mockResolvedValue({
        id: 'shop-id',
        createdBy: mockUser.id,
      })

      const { createShopChangeRequest } = await import('@/lib/actions/shop')
      const result = await createShopChangeRequest('shop-id', { name: '新しい名前' })

      expect(result).toEqual({ error: '登録者は直接編集できます' })
    })

    it('変更内容がない場合はエラーを返す', async () => {
      mockPrisma.bonsaiShop.findUnique.mockResolvedValue({
        id: 'shop-id',
        createdBy: 'other-user-id',
      })

      const { createShopChangeRequest } = await import('@/lib/actions/shop')
      const result = await createShopChangeRequest('shop-id', {})

      expect(result).toEqual({ error: '変更内容を入力してください' })
    })

    it('既に保留中のリクエストがある場合はエラーを返す', async () => {
      mockPrisma.bonsaiShop.findUnique.mockResolvedValue({
        id: 'shop-id',
        createdBy: 'other-user-id',
      })
      mockPrisma.shopChangeRequest.findFirst.mockResolvedValue({ id: 'existing-request' })

      const { createShopChangeRequest } = await import('@/lib/actions/shop')
      const result = await createShopChangeRequest('shop-id', { name: '新しい名前' })

      expect(result).toEqual({ error: '既に保留中のリクエストがあります。承認/却下を待ってください。' })
    })

    it('正常に変更リクエストを作成できる', async () => {
      mockPrisma.bonsaiShop.findUnique.mockResolvedValue({
        id: 'shop-id',
        createdBy: 'other-user-id',
      })
      mockPrisma.shopChangeRequest.findFirst.mockResolvedValue(null)
      mockPrisma.shopChangeRequest.create.mockResolvedValue({ id: 'new-request-id' })

      const { createShopChangeRequest } = await import('@/lib/actions/shop')
      const result = await createShopChangeRequest('shop-id', { name: '新しい名前' }, '名前が間違っていたため')

      expect(result.success).toBe(true)
      expect(result.requestId).toBe('new-request-id')
    })
  })

  describe('getShopChangeRequests', () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { getShopChangeRequests } = await import('@/lib/actions/shop')
      const result = await getShopChangeRequests()

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('管理者でない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)

      const { getShopChangeRequests } = await import('@/lib/actions/shop')
      const result = await getShopChangeRequests()

      expect(result).toEqual({ error: '管理者権限が必要です' })
    })

    it('管理者は変更リクエスト一覧を取得できる', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue({ userId: mockUser.id })
      mockPrisma.shopChangeRequest.findMany.mockResolvedValue([
        { id: 'request-1', shop: mockShop, user: mockUser },
      ])

      const { getShopChangeRequests } = await import('@/lib/actions/shop')
      const result = await getShopChangeRequests()

      expect(result.requests).toHaveLength(1)
    })

    it('ステータスでフィルタリングできる', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue({ userId: mockUser.id })
      mockPrisma.shopChangeRequest.findMany.mockResolvedValue([])

      const { getShopChangeRequests } = await import('@/lib/actions/shop')
      await getShopChangeRequests({ status: 'approved' })

      expect(mockPrisma.shopChangeRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'approved',
          }),
        })
      )
    })

    it('status=allの場合はステータスフィルタなし', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue({ userId: mockUser.id })
      mockPrisma.shopChangeRequest.findMany.mockResolvedValue([])

      const { getShopChangeRequests } = await import('@/lib/actions/shop')
      await getShopChangeRequests({ status: 'all' })

      expect(mockPrisma.shopChangeRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({
            status: expect.anything(),
          }),
        })
      )
    })
  })

  describe('approveShopChangeRequest', () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { approveShopChangeRequest } = await import('@/lib/actions/shop')
      const result = await approveShopChangeRequest('request-id')

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('管理者でない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)

      const { approveShopChangeRequest } = await import('@/lib/actions/shop')
      const result = await approveShopChangeRequest('request-id')

      expect(result).toEqual({ error: '管理者権限が必要です' })
    })

    it('リクエストが存在しない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue({ userId: mockUser.id })
      mockPrisma.shopChangeRequest.findUnique.mockResolvedValue(null)

      const { approveShopChangeRequest } = await import('@/lib/actions/shop')
      const result = await approveShopChangeRequest('non-existent')

      expect(result).toEqual({ error: 'リクエストが見つかりません' })
    })

    it('既に処理済みのリクエストはエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue({ userId: mockUser.id })
      mockPrisma.shopChangeRequest.findUnique.mockResolvedValue({
        id: 'request-id',
        status: 'approved',
        shop: mockShop,
      })

      const { approveShopChangeRequest } = await import('@/lib/actions/shop')
      const result = await approveShopChangeRequest('request-id')

      expect(result).toEqual({ error: 'このリクエストは既に処理済みです' })
    })

    it('正常にリクエストを承認できる', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue({ userId: mockUser.id })
      mockPrisma.shopChangeRequest.findUnique.mockResolvedValue({
        id: 'request-id',
        status: 'pending',
        shopId: 'shop-id',
        requestedChanges: { name: '新しい名前' },
        shop: mockShop,
      })

      const { approveShopChangeRequest } = await import('@/lib/actions/shop')
      const result = await approveShopChangeRequest('request-id', '承認しました')

      expect(result).toEqual({ success: true })
      expect(mockPrisma.$transaction).toHaveBeenCalled()
    })
  })

  describe('rejectShopChangeRequest', () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { rejectShopChangeRequest } = await import('@/lib/actions/shop')
      const result = await rejectShopChangeRequest('request-id')

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('管理者でない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)

      const { rejectShopChangeRequest } = await import('@/lib/actions/shop')
      const result = await rejectShopChangeRequest('request-id')

      expect(result).toEqual({ error: '管理者権限が必要です' })
    })

    it('リクエストが存在しない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue({ userId: mockUser.id })
      mockPrisma.shopChangeRequest.findUnique.mockResolvedValue(null)

      const { rejectShopChangeRequest } = await import('@/lib/actions/shop')
      const result = await rejectShopChangeRequest('non-existent')

      expect(result).toEqual({ error: 'リクエストが見つかりません' })
    })

    it('既に処理済みのリクエストはエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue({ userId: mockUser.id })
      mockPrisma.shopChangeRequest.findUnique.mockResolvedValue({
        id: 'request-id',
        status: 'rejected',
      })

      const { rejectShopChangeRequest } = await import('@/lib/actions/shop')
      const result = await rejectShopChangeRequest('request-id')

      expect(result).toEqual({ error: 'このリクエストは既に処理済みです' })
    })

    it('正常にリクエストを却下できる', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue({ userId: mockUser.id })
      mockPrisma.shopChangeRequest.findUnique.mockResolvedValue({
        id: 'request-id',
        status: 'pending',
        shopId: 'shop-id',
      })

      const { rejectShopChangeRequest } = await import('@/lib/actions/shop')
      const result = await rejectShopChangeRequest('request-id', '却下理由')

      expect(result).toEqual({ success: true })
      expect(mockPrisma.$transaction).toHaveBeenCalled()
    })
  })

  describe('getPendingShopChangeRequestCount', () => {
    it('未認証の場合は0を返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { getPendingShopChangeRequestCount } = await import('@/lib/actions/shop')
      const result = await getPendingShopChangeRequestCount()

      expect(result).toEqual({ count: 0 })
    })

    it('管理者でない場合は0を返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)

      const { getPendingShopChangeRequestCount } = await import('@/lib/actions/shop')
      const result = await getPendingShopChangeRequestCount()

      expect(result).toEqual({ count: 0 })
    })

    it('管理者は未対応リクエスト数を取得できる', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue({ userId: mockUser.id })
      mockPrisma.shopChangeRequest.count.mockResolvedValue(5)

      const { getPendingShopChangeRequestCount } = await import('@/lib/actions/shop')
      const result = await getPendingShopChangeRequestCount()

      expect(result).toEqual({ count: 5 })
    })
  })

  describe('getShopChangeRequest', () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { getShopChangeRequest } = await import('@/lib/actions/shop')
      const result = await getShopChangeRequest('request-id')

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('管理者でない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)

      const { getShopChangeRequest } = await import('@/lib/actions/shop')
      const result = await getShopChangeRequest('request-id')

      expect(result).toEqual({ error: '管理者権限が必要です' })
    })

    it('リクエストが存在しない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue({ userId: mockUser.id })
      mockPrisma.shopChangeRequest.findUnique.mockResolvedValue(null)

      const { getShopChangeRequest } = await import('@/lib/actions/shop')
      const result = await getShopChangeRequest('non-existent')

      expect(result).toEqual({ error: 'リクエストが見つかりません' })
    })

    it('正常にリクエスト詳細を取得できる', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue({ userId: mockUser.id })
      mockPrisma.shopChangeRequest.findUnique.mockResolvedValue({
        id: 'request-id',
        shop: mockShop,
        user: mockUser,
      })

      const { getShopChangeRequest } = await import('@/lib/actions/shop')
      const result = await getShopChangeRequest('request-id')

      expect(result.request).toBeDefined()
      expect(result.request?.id).toBe('request-id')
    })
  })
})
