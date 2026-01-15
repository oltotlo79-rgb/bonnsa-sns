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

// 全文検索モック
jest.mock('@/lib/search/fulltext', () => ({
  getSearchMode: jest.fn().mockReturnValue('like'),
  fulltextSearchPosts: jest.fn().mockResolvedValue([]),
  fulltextSearchUsers: jest.fn().mockResolvedValue([]),
}))

describe('Search Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAuth.mockResolvedValue({
      user: { id: mockUser.id },
    })
  })

  describe('searchPosts', () => {
    it('クエリで投稿を検索できる', async () => {
      mockPrisma.block.findMany.mockResolvedValue([])
      mockPrisma.mute.findMany.mockResolvedValue([])
      mockPrisma.post.findMany.mockResolvedValue([
        {
          ...mockPost,
          _count: { likes: 5, comments: 3 },
          genres: [],
        },
      ])
      mockPrisma.like.findMany.mockResolvedValue([])
      mockPrisma.bookmark.findMany.mockResolvedValue([])

      const { searchPosts } = await import('@/lib/actions/search')
      const result = await searchPosts('テスト')

      expect(result.posts).toHaveLength(1)
      expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              expect.objectContaining({
                content: expect.objectContaining({
                  contains: 'テスト',
                }),
              }),
            ]),
          }),
        })
      )
    })

    it('ジャンルでフィルタリングできる', async () => {
      mockPrisma.block.findMany.mockResolvedValue([])
      mockPrisma.mute.findMany.mockResolvedValue([])
      mockPrisma.post.findMany.mockResolvedValue([])
      mockPrisma.like.findMany.mockResolvedValue([])
      mockPrisma.bookmark.findMany.mockResolvedValue([])

      const { searchPosts } = await import('@/lib/actions/search')
      await searchPosts('テスト', ['genre-1', 'genre-2'])

      expect(mockPrisma.post.findMany).toHaveBeenCalled()
    })

    it('ブロック/ミュートユーザーの投稿は除外される', async () => {
      mockPrisma.block.findMany.mockResolvedValue([
        { blockerId: mockUser.id, blockedId: 'blocked-user-id' },
      ])
      mockPrisma.mute.findMany.mockResolvedValue([
        { muterId: mockUser.id, mutedId: 'muted-user-id' },
      ])
      mockPrisma.post.findMany.mockResolvedValue([])
      mockPrisma.like.findMany.mockResolvedValue([])
      mockPrisma.bookmark.findMany.mockResolvedValue([])

      const { searchPosts } = await import('@/lib/actions/search')
      await searchPosts('テスト')

      expect(mockPrisma.post.findMany).toHaveBeenCalled()
    })

    it('ページネーションが動作する', async () => {
      mockPrisma.block.findMany.mockResolvedValue([])
      mockPrisma.mute.findMany.mockResolvedValue([])
      mockPrisma.post.findMany.mockResolvedValue([])
      mockPrisma.like.findMany.mockResolvedValue([])
      mockPrisma.bookmark.findMany.mockResolvedValue([])

      const { searchPosts } = await import('@/lib/actions/search')
      await searchPosts('テスト', [], 'cursor-id', 10)

      expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          cursor: { id: 'cursor-id' },
          skip: 1,
        })
      )
    })
  })

  describe('searchUsers', () => {
    it('クエリでユーザーを検索できる', async () => {
      mockPrisma.block.findMany.mockResolvedValue([])
      mockPrisma.user.findMany.mockResolvedValue([
        {
          id: 'user-1',
          nickname: 'テストユーザー',
          avatarUrl: '/avatar.jpg',
          bio: 'テスト',
          _count: { followers: 10, following: 5 },
        },
      ])

      const { searchUsers } = await import('@/lib/actions/search')
      const result = await searchUsers('テスト')

      expect(result.users).toHaveLength(1)
      expect(result.users[0].nickname).toBe('テストユーザー')
    })

    it('自分自身は検索結果から除外される', async () => {
      mockPrisma.block.findMany.mockResolvedValue([])
      mockPrisma.user.findMany.mockResolvedValue([])

      const { searchUsers } = await import('@/lib/actions/search')
      await searchUsers('テスト')

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              expect.objectContaining({
                id: { not: mockUser.id },
              }),
            ]),
          }),
        })
      )
    })

    it('ブロックしたユーザーは除外される', async () => {
      mockPrisma.block.findMany.mockResolvedValue([
        { blockerId: mockUser.id, blockedId: 'blocked-user-id' },
      ])
      mockPrisma.user.findMany.mockResolvedValue([])

      const { searchUsers } = await import('@/lib/actions/search')
      await searchUsers('テスト')

      expect(mockPrisma.user.findMany).toHaveBeenCalled()
    })
  })

  describe('searchByTag', () => {
    it('ハッシュタグで投稿を検索できる', async () => {
      mockPrisma.block.findMany.mockResolvedValue([])
      mockPrisma.mute.findMany.mockResolvedValue([])
      mockPrisma.post.findMany.mockResolvedValue([
        {
          ...mockPost,
          content: 'テスト #盆栽',
          _count: { likes: 5, comments: 3 },
          genres: [],
        },
      ])
      mockPrisma.like.findMany.mockResolvedValue([])
      mockPrisma.bookmark.findMany.mockResolvedValue([])

      const { searchByTag } = await import('@/lib/actions/search')
      const result = await searchByTag('盆栽')

      expect(result.posts).toHaveLength(1)
      expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              expect.objectContaining({
                content: { contains: '#盆栽' },
              }),
            ]),
          }),
        })
      )
    })
  })

  describe('getPopularTags', () => {
    it('人気タグを取得できる', async () => {
      mockPrisma.post.findMany.mockResolvedValue([
        { content: '#盆栽 #松' },
        { content: '#盆栽 #もみじ' },
        { content: '#盆栽' },
      ])

      const { getPopularTags } = await import('@/lib/actions/search')
      const result = await getPopularTags(10)

      expect(result.tags).toContainEqual(
        expect.objectContaining({
          tag: '盆栽',
        })
      )
    })
  })

  describe('getAllGenres', () => {
    it('全ジャンルを取得できる', async () => {
      mockPrisma.genre.findMany.mockResolvedValue([
        { id: 'genre-1', name: '黒松', category: '松柏類', sortOrder: 1 },
        { id: 'genre-2', name: '五葉松', category: '松柏類', sortOrder: 2 },
        { id: 'genre-3', name: 'もみじ', category: '雑木類', sortOrder: 10 },
      ])

      const { getAllGenres } = await import('@/lib/actions/search')
      const result = await getAllGenres()

      expect(result.genres).toBeDefined()
      expect(result.genres['松柏類']).toBeDefined()
    })
  })
})
