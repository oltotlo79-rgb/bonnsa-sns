/**
 * @jest-environment node
 */

import { createMockPrismaClient } from '../utils/test-utils'

// Prismaモック
const mockPrisma = createMockPrismaClient()
jest.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}))

// Next.js cache mock
const mockRevalidateTag = jest.fn()
jest.mock('next/cache', () => ({
  unstable_cache: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
  revalidateTag: (...args: unknown[]) => mockRevalidateTag(...args),
}))

describe('Cache Module', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('CACHE_TAGS', () => {
    it('キャッシュタグ定数が定義されている', async () => {
      const { CACHE_TAGS } = await import('@/lib/cache')

      expect(CACHE_TAGS.GENRES).toBe('genres')
      expect(CACHE_TAGS.TRENDING_GENRES).toBe('trending-genres')
      expect(CACHE_TAGS.POPULAR_TAGS).toBe('popular-tags')
    })
  })

  describe('getCachedGenres', () => {
    it('ジャンル一覧をカテゴリごとにグループ化して返す', async () => {
      const mockGenres = [
        { id: '1', name: '黒松', category: '松柏類', sortOrder: 1 },
        { id: '2', name: '五葉松', category: '松柏類', sortOrder: 2 },
        { id: '3', name: 'もみじ', category: '雑木類', sortOrder: 10 },
        { id: '4', name: '用品', category: '用品・道具', sortOrder: 20 },
      ]
      mockPrisma.genre.findMany.mockResolvedValue(mockGenres)

      const { getCachedGenres } = await import('@/lib/cache')
      const result = await getCachedGenres()

      expect(result.genres['松柏類']).toHaveLength(2)
      expect(result.genres['雑木類']).toHaveLength(1)
      expect(result.genres['用品・道具']).toHaveLength(1)
      expect(result.allGenres).toHaveLength(4)
    })

    it('カテゴリ順序を正しく適用する', async () => {
      const mockGenres = [
        { id: '1', name: 'その他アイテム', category: 'その他', sortOrder: 100 },
        { id: '2', name: '黒松', category: '松柏類', sortOrder: 1 },
        { id: '3', name: '草もの', category: '草もの', sortOrder: 30 },
      ]
      mockPrisma.genre.findMany.mockResolvedValue(mockGenres)

      const { getCachedGenres } = await import('@/lib/cache')
      const result = await getCachedGenres()

      const categoryOrder = Object.keys(result.genres)
      expect(categoryOrder).toEqual(['松柏類', '草もの', 'その他'])
    })

    it('空のジャンルリストを処理できる', async () => {
      mockPrisma.genre.findMany.mockResolvedValue([])

      const { getCachedGenres } = await import('@/lib/cache')
      const result = await getCachedGenres()

      expect(result.genres).toEqual({})
      expect(result.allGenres).toEqual([])
    })
  })

  describe('getCachedTrendingGenres', () => {
    it('トレンドジャンルを投稿数順に返す', async () => {
      const mockTrendingGenres = [
        { genreId: 'genre-1', _count: { genreId: 25 } },
        { genreId: 'genre-2', _count: { genreId: 18 } },
      ]
      const mockGenreDetails = [
        { id: 'genre-1', name: '黒松', category: '松柏類' },
        { id: 'genre-2', name: 'もみじ', category: '雑木類' },
      ]
      mockPrisma.postGenre.groupBy.mockResolvedValue(mockTrendingGenres)
      mockPrisma.genre.findMany.mockResolvedValue(mockGenreDetails)

      const { getCachedTrendingGenres } = await import('@/lib/cache')
      const result = await getCachedTrendingGenres(5)

      expect(result.genres).toHaveLength(2)
      expect(result.genres[0].postCount).toBe(25)
      expect(result.genres[0].name).toBe('黒松')
    })

    it('デフォルトのlimit値（5）を使用する', async () => {
      mockPrisma.postGenre.groupBy.mockResolvedValue([])
      mockPrisma.genre.findMany.mockResolvedValue([])

      const { getCachedTrendingGenres } = await import('@/lib/cache')
      await getCachedTrendingGenres()

      expect(mockPrisma.postGenre.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 5,
        })
      )
    })

    it('ジャンル詳細が見つからない場合は除外する', async () => {
      const mockTrendingGenres = [
        { genreId: 'genre-1', _count: { genreId: 25 } },
        { genreId: 'deleted-genre', _count: { genreId: 10 } },
      ]
      const mockGenreDetails = [
        { id: 'genre-1', name: '黒松', category: '松柏類' },
      ]
      mockPrisma.postGenre.groupBy.mockResolvedValue(mockTrendingGenres)
      mockPrisma.genre.findMany.mockResolvedValue(mockGenreDetails)

      const { getCachedTrendingGenres } = await import('@/lib/cache')
      const result = await getCachedTrendingGenres()

      expect(result.genres).toHaveLength(1)
    })
  })

  describe('getCachedPopularTags', () => {
    it('人気タグを出現回数順に返す', async () => {
      const mockPosts = [
        { content: '新しい盆栽です #盆栽 #黒松' },
        { content: '今日の水やり #盆栽' },
        { content: '紅葉が綺麗 #もみじ #盆栽' },
      ]
      mockPrisma.post.findMany.mockResolvedValue(mockPosts)

      const { getCachedPopularTags } = await import('@/lib/cache')
      const result = await getCachedPopularTags(10)

      expect(result.tags[0].tag).toBe('盆栽')
      expect(result.tags[0].count).toBe(3)
      expect(result.tags).toHaveLength(3)
    })

    it('タグを小文字に正規化する', async () => {
      const mockPosts = [
        { content: '#Bonsai is great' },
        { content: '#BONSAI love it' },
        { content: '#bonsai every day' },
      ]
      mockPrisma.post.findMany.mockResolvedValue(mockPosts)

      const { getCachedPopularTags } = await import('@/lib/cache')
      const result = await getCachedPopularTags()

      expect(result.tags).toHaveLength(1)
      expect(result.tags[0].tag).toBe('bonsai')
      expect(result.tags[0].count).toBe(3)
    })

    it('日本語タグを正しく抽出する', async () => {
      const mockPosts = [
        { content: '#盆栽好き がいます' },
        { content: '#カタカナタグ もOK' },
        { content: 'ハッシュタグなし' },
      ]
      mockPrisma.post.findMany.mockResolvedValue(mockPosts)

      const { getCachedPopularTags } = await import('@/lib/cache')
      const result = await getCachedPopularTags()

      expect(result.tags.map((t: { tag: string }) => t.tag)).toContain('盆栽好き')
      expect(result.tags.map((t: { tag: string }) => t.tag)).toContain('カタカナタグ')
    })

    it('contentがnullの投稿をスキップする', async () => {
      const mockPosts = [
        { content: null },
        { content: '#盆栽' },
      ]
      mockPrisma.post.findMany.mockResolvedValue(mockPosts)

      const { getCachedPopularTags } = await import('@/lib/cache')
      const result = await getCachedPopularTags()

      expect(result.tags).toHaveLength(1)
    })

    it('limit引数で取得数を制限する', async () => {
      const mockPosts = [
        { content: '#tag1 #tag2 #tag3 #tag4 #tag5 #tag6' },
      ]
      mockPrisma.post.findMany.mockResolvedValue(mockPosts)

      const { getCachedPopularTags } = await import('@/lib/cache')
      const result = await getCachedPopularTags(3)

      expect(result.tags).toHaveLength(3)
    })
  })

  describe('revalidateGenresCache', () => {
    it('ジャンルキャッシュを無効化する', async () => {
      const { revalidateGenresCache, CACHE_TAGS } = await import('@/lib/cache')
      revalidateGenresCache()

      expect(mockRevalidateTag).toHaveBeenCalledWith(CACHE_TAGS.GENRES, { expire: 0 })
    })
  })

  describe('revalidateTrendingGenresCache', () => {
    it('トレンドジャンルキャッシュを無効化する', async () => {
      const { revalidateTrendingGenresCache, CACHE_TAGS } = await import('@/lib/cache')
      revalidateTrendingGenresCache()

      expect(mockRevalidateTag).toHaveBeenCalledWith(CACHE_TAGS.TRENDING_GENRES, { expire: 0 })
    })
  })

  describe('revalidatePopularTagsCache', () => {
    it('人気タグキャッシュを無効化する', async () => {
      const { revalidatePopularTagsCache, CACHE_TAGS } = await import('@/lib/cache')
      revalidatePopularTagsCache()

      expect(mockRevalidateTag).toHaveBeenCalledWith(CACHE_TAGS.POPULAR_TAGS, { expire: 0 })
    })
  })
})
