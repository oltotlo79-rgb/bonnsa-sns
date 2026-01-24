/**
 * @jest-environment node
 */
import { createMockPrismaClient, mockPost, mockHashtag } from '../../utils/test-utils'

// Prismaモック
const mockPrisma = createMockPrismaClient()
jest.mock('@/lib/db', () => ({
  prisma: mockPrisma,
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

describe('Hashtag Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // ============================================================
  // attachHashtagsToPost
  // ============================================================

  describe('attachHashtagsToPost', () => {
    it('投稿にハッシュタグを関連付けできる', async () => {
      mockPrisma.hashtag.upsert.mockResolvedValueOnce({ id: 'hashtag-1', name: '盆栽', count: 1 })
      mockPrisma.postHashtag.upsert.mockResolvedValueOnce({ postId: mockPost.id, hashtagId: 'hashtag-1' })

      const { attachHashtagsToPost } = await import('@/lib/actions/hashtag')
      await attachHashtagsToPost(mockPost.id, '今日の #盆栽 です')

      expect(mockPrisma.hashtag.upsert).toHaveBeenCalledWith({
        where: { name: '盆栽' },
        update: { count: { increment: 1 } },
        create: { name: '盆栽', count: 1 },
      })
      expect(mockPrisma.postHashtag.upsert).toHaveBeenCalled()
    })

    it('複数のハッシュタグを関連付けできる', async () => {
      mockPrisma.hashtag.upsert
        .mockResolvedValueOnce({ id: 'hashtag-1', name: '盆栽', count: 1 })
        .mockResolvedValueOnce({ id: 'hashtag-2', name: '黒松', count: 1 })
      mockPrisma.postHashtag.upsert
        .mockResolvedValueOnce({ postId: mockPost.id, hashtagId: 'hashtag-1' })
        .mockResolvedValueOnce({ postId: mockPost.id, hashtagId: 'hashtag-2' })

      const { attachHashtagsToPost } = await import('@/lib/actions/hashtag')
      await attachHashtagsToPost(mockPost.id, '#盆栽 #黒松 を育てています')

      expect(mockPrisma.hashtag.upsert).toHaveBeenCalledTimes(2)
    })

    it('contentがnullの場合、何もしない', async () => {
      const { attachHashtagsToPost } = await import('@/lib/actions/hashtag')
      await attachHashtagsToPost(mockPost.id, null)

      expect(mockPrisma.hashtag.upsert).not.toHaveBeenCalled()
    })

    it('ハッシュタグがない場合、何もしない', async () => {
      const { attachHashtagsToPost } = await import('@/lib/actions/hashtag')
      await attachHashtagsToPost(mockPost.id, 'ハッシュタグなしの投稿')

      expect(mockPrisma.hashtag.upsert).not.toHaveBeenCalled()
    })

    it('エラーが発生しても投稿作成をブロックしない', async () => {
      mockPrisma.hashtag.upsert.mockRejectedValueOnce(new Error('Database error'))

      const { attachHashtagsToPost } = await import('@/lib/actions/hashtag')
      // エラーがスローされないことを確認
      await expect(attachHashtagsToPost(mockPost.id, '#盆栽')).resolves.not.toThrow()
    })
  })

  // ============================================================
  // detachHashtagsFromPost
  // ============================================================

  describe('detachHashtagsFromPost', () => {
    it('投稿からハッシュタグの関連付けを削除できる', async () => {
      mockPrisma.postHashtag.findMany.mockResolvedValueOnce([
        { postId: mockPost.id, hashtagId: 'hashtag-1', hashtag: { id: 'hashtag-1', name: '盆栽' } },
      ])
      mockPrisma.postHashtag.deleteMany.mockResolvedValueOnce({ count: 1 })
      mockPrisma.hashtag.update.mockResolvedValueOnce({ id: 'hashtag-1', name: '盆栽', count: 0 })
      mockPrisma.hashtag.deleteMany.mockResolvedValueOnce({ count: 1 })

      const { detachHashtagsFromPost } = await import('@/lib/actions/hashtag')
      await detachHashtagsFromPost(mockPost.id)

      expect(mockPrisma.postHashtag.deleteMany).toHaveBeenCalledWith({ where: { postId: mockPost.id } })
      expect(mockPrisma.hashtag.update).toHaveBeenCalledWith({
        where: { id: 'hashtag-1' },
        data: { count: { decrement: 1 } },
      })
    })

    it('エラーが発生しても例外をスローしない', async () => {
      mockPrisma.postHashtag.findMany.mockRejectedValueOnce(new Error('Database error'))

      const { detachHashtagsFromPost } = await import('@/lib/actions/hashtag')
      await expect(detachHashtagsFromPost(mockPost.id)).resolves.not.toThrow()
    })
  })

  // ============================================================
  // getTrendingHashtags
  // ============================================================

  describe('getTrendingHashtags', () => {
    it('トレンドハッシュタグを取得できる', async () => {
      const mockHashtags = [
        { id: 'hashtag-1', name: '盆栽', count: 100 },
        { id: 'hashtag-2', name: '黒松', count: 50 },
      ]
      mockPrisma.hashtag.findMany.mockResolvedValueOnce(mockHashtags)

      const { getTrendingHashtags } = await import('@/lib/actions/hashtag')
      const result = await getTrendingHashtags(5)

      expect(result).toHaveLength(2)
      expect(result[0].name).toBe('盆栽')
    })

    it('デフォルトで10件取得する', async () => {
      mockPrisma.hashtag.findMany.mockResolvedValueOnce([])

      const { getTrendingHashtags } = await import('@/lib/actions/hashtag')
      await getTrendingHashtags()

      expect(mockPrisma.hashtag.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 })
      )
    })

    it('エラー時は空配列を返す', async () => {
      mockPrisma.hashtag.findMany.mockRejectedValueOnce(new Error('Database error'))

      const { getTrendingHashtags } = await import('@/lib/actions/hashtag')
      const result = await getTrendingHashtags()

      expect(result).toEqual([])
    })
  })

  // ============================================================
  // getPostsByHashtag
  // ============================================================

  describe('getPostsByHashtag', () => {
    it('ハッシュタグで投稿を検索できる', async () => {
      const mockPosts = [
        {
          ...mockPost,
          user: { id: 'user-1', nickname: 'ユーザー', avatarUrl: null },
          media: [],
          genres: [],
          _count: { likes: 10, comments: 5 },
        },
      ]
      mockPrisma.post.findMany.mockResolvedValueOnce(mockPosts)

      const { getPostsByHashtag } = await import('@/lib/actions/hashtag')
      const result = await getPostsByHashtag('盆栽')

      expect(result.posts).toHaveLength(1)
      expect(result.hashtag.name).toBe('盆栽')
    })

    it('指定した件数で取得できる', async () => {
      mockPrisma.post.findMany.mockResolvedValueOnce([])

      const { getPostsByHashtag } = await import('@/lib/actions/hashtag')
      await getPostsByHashtag('盆栽', { limit: 10 })

      expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 })
      )
    })
  })

  // ============================================================
  // searchHashtags
  // ============================================================

  describe('searchHashtags', () => {
    it('ハッシュタグを検索できる', async () => {
      const mockHashtags = [
        { id: 'hashtag-1', name: '盆栽', count: 100 },
        { id: 'hashtag-2', name: '盆栽入門', count: 50 },
      ]
      mockPrisma.hashtag.findMany.mockResolvedValueOnce(mockHashtags)

      const { searchHashtags } = await import('@/lib/actions/hashtag')
      const result = await searchHashtags('盆')

      expect(result).toHaveLength(2)
    })

    it('空のクエリの場合、空配列を返す', async () => {
      const { searchHashtags } = await import('@/lib/actions/hashtag')
      const result = await searchHashtags('')

      expect(result).toEqual([])
      expect(mockPrisma.hashtag.findMany).not.toHaveBeenCalled()
    })

    it('デフォルトで10件取得する', async () => {
      mockPrisma.hashtag.findMany.mockResolvedValueOnce([])

      const { searchHashtags } = await import('@/lib/actions/hashtag')
      await searchHashtags('盆')

      expect(mockPrisma.hashtag.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 })
      )
    })

    it('エラー時は空配列を返す', async () => {
      mockPrisma.hashtag.findMany.mockRejectedValueOnce(new Error('Database error'))

      const { searchHashtags } = await import('@/lib/actions/hashtag')
      const result = await searchHashtags('盆')

      expect(result).toEqual([])
    })
  })
})
