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

describe('Bookmark Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAuth.mockResolvedValue({
      user: { id: mockUser.id },
    })
  })

  describe('toggleBookmark', () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { toggleBookmark } = await import('@/lib/actions/bookmark')
      const result = await toggleBookmark('post-id')

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('ブックマークしていない場合は追加する', async () => {
      mockPrisma.bookmark.findFirst.mockResolvedValue(null)
      mockPrisma.bookmark.create.mockResolvedValue({
        id: 'bookmark-1',
        postId: 'post-id',
        userId: mockUser.id,
      })

      const { toggleBookmark } = await import('@/lib/actions/bookmark')
      const result = await toggleBookmark('post-id')

      expect(result).toEqual({ success: true, bookmarked: true })
      expect(mockPrisma.bookmark.create).toHaveBeenCalled()
    })

    it('ブックマーク済みの場合は解除する', async () => {
      mockPrisma.bookmark.findFirst.mockResolvedValue({
        id: 'bookmark-1',
        postId: 'post-id',
        userId: mockUser.id,
      })
      mockPrisma.bookmark.delete.mockResolvedValue({})

      const { toggleBookmark } = await import('@/lib/actions/bookmark')
      const result = await toggleBookmark('post-id')

      expect(result).toEqual({ success: true, bookmarked: false })
      expect(mockPrisma.bookmark.delete).toHaveBeenCalled()
    })
  })

  describe('getBookmarkStatus', () => {
    it('ブックマーク状態を取得できる（ブックマーク済み）', async () => {
      mockPrisma.bookmark.findFirst.mockResolvedValue({
        id: 'bookmark-1',
        postId: 'post-id',
        userId: mockUser.id,
      })

      const { getBookmarkStatus } = await import('@/lib/actions/bookmark')
      const result = await getBookmarkStatus('post-id')

      expect(result.bookmarked).toBe(true)
    })

    it('ブックマーク状態を取得できる（未ブックマーク）', async () => {
      mockPrisma.bookmark.findFirst.mockResolvedValue(null)

      const { getBookmarkStatus } = await import('@/lib/actions/bookmark')
      const result = await getBookmarkStatus('post-id')

      expect(result.bookmarked).toBe(false)
    })

    it('未認証の場合はfalseを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { getBookmarkStatus } = await import('@/lib/actions/bookmark')
      const result = await getBookmarkStatus('post-id')

      expect(result.bookmarked).toBe(false)
    })
  })

  describe('getBookmarkedPosts', () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { getBookmarkedPosts } = await import('@/lib/actions/bookmark')
      const result = await getBookmarkedPosts()

      expect(result.error).toBe('認証が必要です')
      expect(result.posts).toEqual([])
    })

    it('ブックマーク一覧を取得できる', async () => {
      const mockBookmarks = [
        {
          id: 'bookmark-1',
          postId: mockPost.id,
          userId: mockUser.id,
          post: {
            ...mockPost,
            _count: { likes: 5, comments: 3 },
            genres: [{ genre: { id: 'genre-1', name: '松柏類', category: '松柏類' } }],
          },
        },
      ]
      mockPrisma.bookmark.findMany.mockResolvedValue(mockBookmarks)
      mockPrisma.like.findMany.mockResolvedValue([])

      const { getBookmarkedPosts } = await import('@/lib/actions/bookmark')
      const result = await getBookmarkedPosts()

      expect(result.posts).toHaveLength(1)
      expect(result.posts[0].id).toBe(mockPost.id)
      expect(result.posts[0].isBookmarked).toBe(true)
    })

    it('空のブックマーク一覧を取得できる', async () => {
      mockPrisma.bookmark.findMany.mockResolvedValue([])

      const { getBookmarkedPosts } = await import('@/lib/actions/bookmark')
      const result = await getBookmarkedPosts()

      expect(result.posts).toHaveLength(0)
    })
  })
})
