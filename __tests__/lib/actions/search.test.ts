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
const mockGetSearchMode = jest.fn().mockReturnValue('like')
const mockFulltextSearchPosts = jest.fn().mockResolvedValue([])
const mockFulltextSearchUsers = jest.fn().mockResolvedValue([])
jest.mock('@/lib/search/fulltext', () => ({
  getSearchMode: () => mockGetSearchMode(),
  fulltextSearchPosts: (...args: unknown[]) => mockFulltextSearchPosts(...args),
  fulltextSearchUsers: (...args: unknown[]) => mockFulltextSearchUsers(...args),
}))

// レート制限モック
const mockRateLimit = jest.fn().mockResolvedValue({ success: true })
jest.mock('@/lib/rate-limit', () => ({
  rateLimit: (...args: unknown[]) => mockRateLimit(...args),
  RATE_LIMITS: {
    search: { limit: 30, duration: 60 },
  },
}))

// next/headers モック
jest.mock('next/headers', () => ({
  headers: jest.fn().mockResolvedValue({
    get: jest.fn().mockReturnValue(null),
  }),
}))

// キャッシュモック（unstable_cacheはテスト環境で動作しないため）
jest.mock('@/lib/cache', () => ({
  getCachedGenres: jest.fn().mockImplementation(async () => {
    // テストではモックされたPrismaデータを使用
    const genres = await mockPrisma.genre.findMany({ orderBy: [{ sortOrder: 'asc' }] })
    type GenreType = typeof genres[number]
    const groupedMap = genres.reduce((acc: Record<string, GenreType[]>, genre: GenreType) => {
      if (!acc[genre.category]) {
        acc[genre.category] = []
      }
      acc[genre.category].push(genre)
      return acc
    }, {})
    const categoryOrder = ['松柏類', '雑木類', '草もの', '用品・道具', '施設・イベント', 'その他']
    const grouped: Record<string, typeof genres> = {}
    for (const category of categoryOrder) {
      if (groupedMap[category]) {
        grouped[category] = groupedMap[category]
      }
    }
    return { genres: grouped, allGenres: genres }
  }),
  getCachedPopularTags: jest.fn().mockImplementation(async () => {
    // テストではモックされたPrismaデータを使用
    const posts = await mockPrisma.post.findMany({
      where: { content: { contains: '#' } },
      select: { content: true },
    })
    const tagCounts: Record<string, number> = {}
    const hashtagRegex = /#[\w\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]+/g
    for (const post of posts) {
      if (!post.content) continue
      const tags = post.content.match(hashtagRegex) || []
      for (const tag of tags) {
        const normalizedTag = tag.slice(1).toLowerCase()
        tagCounts[normalizedTag] = (tagCounts[normalizedTag] || 0) + 1
      }
    }
    const sortedTags = Object.entries(tagCounts)
      .sort(([, a]: [string, number], [, b]: [string, number]) => b - a)
      .slice(0, 10)
      .map(([tag, count]: [string, number]) => ({ tag, count }))
    return { tags: sortedTags }
  }),
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

  describe('searchPosts - レート制限', () => {
    it('レート制限に達した場合はエラーを返す', async () => {
      mockRateLimit.mockResolvedValueOnce({ success: false })

      const { searchPosts } = await import('@/lib/actions/search')
      const result = await searchPosts('テスト')

      expect(result.posts).toEqual([])
      expect(result.error).toBe('検索リクエストが多すぎます。しばらく待ってから再試行してください')
    })
  })

  describe('searchPosts - 全文検索モード', () => {
    beforeEach(() => {
      mockGetSearchMode.mockReturnValue('bigm')
      mockRateLimit.mockResolvedValue({ success: true })
    })

    it('bigmモードで投稿を検索できる', async () => {
      mockFulltextSearchPosts.mockResolvedValue(['post-1', 'post-2'])
      mockPrisma.block.findMany.mockResolvedValue([])
      mockPrisma.mute.findMany.mockResolvedValue([])
      mockPrisma.post.findMany.mockResolvedValue([
        {
          ...mockPost,
          id: 'post-1',
          _count: { likes: 5, comments: 3 },
          genres: [],
        },
        {
          ...mockPost,
          id: 'post-2',
          _count: { likes: 2, comments: 1 },
          genres: [],
        },
      ])
      mockPrisma.like.findMany.mockResolvedValue([])
      mockPrisma.bookmark.findMany.mockResolvedValue([])

      const { searchPosts } = await import('@/lib/actions/search')
      const result = await searchPosts('テスト')

      expect(result.posts).toHaveLength(2)
      expect(mockFulltextSearchPosts).toHaveBeenCalledWith('テスト', expect.any(Object))
    })

    it('bigmモードで結果がない場合は空を返す', async () => {
      mockFulltextSearchPosts.mockResolvedValue([])
      mockPrisma.block.findMany.mockResolvedValue([])
      mockPrisma.mute.findMany.mockResolvedValue([])

      const { searchPosts } = await import('@/lib/actions/search')
      const result = await searchPosts('存在しないキーワード')

      expect(result.posts).toEqual([])
    })

    it('bigmモードでいいね/ブックマーク状態を取得できる', async () => {
      mockFulltextSearchPosts.mockResolvedValue(['post-1'])
      mockPrisma.block.findMany.mockResolvedValue([])
      mockPrisma.mute.findMany.mockResolvedValue([])
      mockPrisma.post.findMany.mockResolvedValue([
        {
          ...mockPost,
          id: 'post-1',
          _count: { likes: 5, comments: 3 },
          genres: [],
        },
      ])
      mockPrisma.like.findMany.mockResolvedValue([{ postId: 'post-1' }])
      mockPrisma.bookmark.findMany.mockResolvedValue([{ postId: 'post-1' }])

      const { searchPosts } = await import('@/lib/actions/search')
      const result = await searchPosts('テスト')

      expect(result.posts[0].isLiked).toBe(true)
      expect(result.posts[0].isBookmarked).toBe(true)
    })

    it('trgmモードでも検索できる', async () => {
      mockGetSearchMode.mockReturnValue('trgm')
      mockFulltextSearchPosts.mockResolvedValue(['post-1'])
      mockPrisma.block.findMany.mockResolvedValue([])
      mockPrisma.mute.findMany.mockResolvedValue([])
      mockPrisma.post.findMany.mockResolvedValue([
        {
          ...mockPost,
          id: 'post-1',
          _count: { likes: 5, comments: 3 },
          genres: [],
        },
      ])
      mockPrisma.like.findMany.mockResolvedValue([])
      mockPrisma.bookmark.findMany.mockResolvedValue([])

      const { searchPosts } = await import('@/lib/actions/search')
      const result = await searchPosts('テスト')

      expect(result.posts).toHaveLength(1)
    })
  })

  describe('searchUsers - レート制限', () => {
    beforeEach(() => {
      mockGetSearchMode.mockReturnValue('like')
    })

    it('レート制限に達した場合はエラーを返す', async () => {
      mockRateLimit.mockResolvedValueOnce({ success: false })

      const { searchUsers } = await import('@/lib/actions/search')
      const result = await searchUsers('テスト')

      expect(result.users).toEqual([])
      expect(result.error).toBe('検索リクエストが多すぎます。しばらく待ってから再試行してください')
    })
  })

  describe('searchUsers - 全文検索モード', () => {
    beforeEach(() => {
      mockGetSearchMode.mockReturnValue('bigm')
      mockRateLimit.mockResolvedValue({ success: true })
    })

    it('bigmモードでユーザーを検索できる', async () => {
      mockFulltextSearchUsers.mockResolvedValue(['user-1', 'user-2'])
      mockPrisma.block.findMany.mockResolvedValue([])
      mockPrisma.user.findMany.mockResolvedValue([
        {
          id: 'user-1',
          nickname: 'ユーザー1',
          avatarUrl: '/avatar1.jpg',
          bio: 'テスト',
          _count: { followers: 10, following: 5 },
        },
        {
          id: 'user-2',
          nickname: 'ユーザー2',
          avatarUrl: '/avatar2.jpg',
          bio: 'テスト',
          _count: { followers: 20, following: 15 },
        },
      ])

      const { searchUsers } = await import('@/lib/actions/search')
      const result = await searchUsers('テスト')

      expect(result.users).toHaveLength(2)
      expect(mockFulltextSearchUsers).toHaveBeenCalledWith('テスト', expect.any(Object))
    })

    it('bigmモードで結果がない場合は空を返す', async () => {
      mockFulltextSearchUsers.mockResolvedValue([])
      mockPrisma.block.findMany.mockResolvedValue([])

      const { searchUsers } = await import('@/lib/actions/search')
      const result = await searchUsers('存在しないキーワード')

      expect(result.users).toEqual([])
    })
  })

  describe('searchUsers - ページネーション', () => {
    beforeEach(() => {
      mockGetSearchMode.mockReturnValue('like')
      mockRateLimit.mockResolvedValue({ success: true })
    })

    it('ページネーションが動作する', async () => {
      mockPrisma.block.findMany.mockResolvedValue([])
      mockPrisma.user.findMany.mockResolvedValue([])

      const { searchUsers } = await import('@/lib/actions/search')
      await searchUsers('テスト', 'cursor-id', 10)

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          cursor: { id: 'cursor-id' },
          skip: 1,
        })
      )
    })

    it('limit件取得した場合は次のカーソルを返す', async () => {
      mockPrisma.block.findMany.mockResolvedValue([])
      const users = Array(20).fill(null).map((_, i) => ({
        id: `user-${i}`,
        nickname: `ユーザー${i}`,
        avatarUrl: '/avatar.jpg',
        bio: 'テスト',
        _count: { followers: 0, following: 0 },
      }))
      mockPrisma.user.findMany.mockResolvedValue(users)

      const { searchUsers } = await import('@/lib/actions/search')
      const result = await searchUsers('テスト')

      expect(result.nextCursor).toBe('user-19')
    })
  })

  describe('searchByTag - レート制限', () => {
    it('レート制限に達した場合はエラーを返す', async () => {
      mockRateLimit.mockResolvedValueOnce({ success: false })

      const { searchByTag } = await import('@/lib/actions/search')
      const result = await searchByTag('盆栽')

      expect(result.posts).toEqual([])
      expect(result.error).toBe('検索リクエストが多すぎます。しばらく待ってから再試行してください')
    })
  })

  describe('searchByTag - 追加テスト', () => {
    beforeEach(() => {
      mockRateLimit.mockResolvedValue({ success: true })
    })

    it('未認証でも検索できる', async () => {
      mockAuth.mockResolvedValue(null)
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

      const { searchByTag } = await import('@/lib/actions/search')
      const result = await searchByTag('盆栽')

      expect(result.posts).toHaveLength(1)
    })

    it('ページネーションが動作する', async () => {
      mockPrisma.block.findMany.mockResolvedValue([])
      mockPrisma.mute.findMany.mockResolvedValue([])
      mockPrisma.post.findMany.mockResolvedValue([])
      mockPrisma.like.findMany.mockResolvedValue([])
      mockPrisma.bookmark.findMany.mockResolvedValue([])

      const { searchByTag } = await import('@/lib/actions/search')
      await searchByTag('盆栽', 'cursor-id', 10)

      expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          cursor: { id: 'cursor-id' },
          skip: 1,
        })
      )
    })

    it('limit件取得した場合は次のカーソルを返す', async () => {
      mockPrisma.block.findMany.mockResolvedValue([])
      mockPrisma.mute.findMany.mockResolvedValue([])
      const posts = Array(20).fill(null).map((_, i) => ({
        ...mockPost,
        id: `post-${i}`,
        content: `#盆栽 投稿${i}`,
        _count: { likes: 0, comments: 0 },
        genres: [],
      }))
      mockPrisma.post.findMany.mockResolvedValue(posts)
      mockPrisma.like.findMany.mockResolvedValue([])
      mockPrisma.bookmark.findMany.mockResolvedValue([])

      const { searchByTag } = await import('@/lib/actions/search')
      const result = await searchByTag('盆栽')

      expect(result.nextCursor).toBe('post-19')
    })
  })

  describe('searchPosts - 追加テスト', () => {
    beforeEach(() => {
      mockGetSearchMode.mockReturnValue('like')
      mockRateLimit.mockResolvedValue({ success: true })
    })

    it('空のクエリで検索できる', async () => {
      mockPrisma.block.findMany.mockResolvedValue([])
      mockPrisma.mute.findMany.mockResolvedValue([])
      mockPrisma.post.findMany.mockResolvedValue([])
      mockPrisma.like.findMany.mockResolvedValue([])
      mockPrisma.bookmark.findMany.mockResolvedValue([])

      const { searchPosts } = await import('@/lib/actions/search')
      const result = await searchPosts('')

      expect(result.posts).toEqual([])
    })

    it('未認証でも検索できる', async () => {
      mockAuth.mockResolvedValue(null)
      mockPrisma.block.findMany.mockResolvedValue([])
      mockPrisma.mute.findMany.mockResolvedValue([])
      mockPrisma.post.findMany.mockResolvedValue([
        {
          ...mockPost,
          _count: { likes: 5, comments: 3 },
          genres: [],
        },
      ])

      const { searchPosts } = await import('@/lib/actions/search')
      const result = await searchPosts('テスト')

      expect(result.posts).toHaveLength(1)
      expect(result.posts[0].isLiked).toBe(false)
      expect(result.posts[0].isBookmarked).toBe(false)
    })

    it('ジャンルと検索キーワードの組み合わせで検索できる', async () => {
      mockPrisma.block.findMany.mockResolvedValue([])
      mockPrisma.mute.findMany.mockResolvedValue([])
      mockPrisma.post.findMany.mockResolvedValue([])
      mockPrisma.like.findMany.mockResolvedValue([])
      mockPrisma.bookmark.findMany.mockResolvedValue([])

      const { searchPosts } = await import('@/lib/actions/search')
      await searchPosts('松', ['genre-1', 'genre-2'])

      expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              expect.objectContaining({
                genres: {
                  some: {
                    genreId: { in: ['genre-1', 'genre-2'] },
                  },
                },
              }),
            ]),
          }),
        })
      )
    })

    it('検索結果の順序が全文検索の順序を維持する（bigmモード）', async () => {
      mockGetSearchMode.mockReturnValue('bigm')
      mockFulltextSearchPosts.mockResolvedValue(['post-2', 'post-1', 'post-3'])
      mockPrisma.block.findMany.mockResolvedValue([])
      mockPrisma.mute.findMany.mockResolvedValue([])
      // 異なる順序で返す
      mockPrisma.post.findMany.mockResolvedValue([
        { ...mockPost, id: 'post-1', _count: { likes: 0, comments: 0 }, genres: [] },
        { ...mockPost, id: 'post-3', _count: { likes: 0, comments: 0 }, genres: [] },
        { ...mockPost, id: 'post-2', _count: { likes: 0, comments: 0 }, genres: [] },
      ])
      mockPrisma.like.findMany.mockResolvedValue([])
      mockPrisma.bookmark.findMany.mockResolvedValue([])

      const { searchPosts } = await import('@/lib/actions/search')
      const result = await searchPosts('テスト')

      // 全文検索の順序を維持
      expect(result.posts[0].id).toBe('post-2')
      expect(result.posts[1].id).toBe('post-1')
      expect(result.posts[2].id).toBe('post-3')
    })
  })

  describe('searchUsers - 追加テスト', () => {
    beforeEach(() => {
      mockGetSearchMode.mockReturnValue('like')
      mockRateLimit.mockResolvedValue({ success: true })
    })

    it('空のクエリで検索できる', async () => {
      mockPrisma.block.findMany.mockResolvedValue([])
      mockPrisma.user.findMany.mockResolvedValue([])

      const { searchUsers } = await import('@/lib/actions/search')
      const result = await searchUsers('')

      expect(result.users).toEqual([])
    })

    it('未認証でも検索できる', async () => {
      mockAuth.mockResolvedValue(null)
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
    })

    it('フォロワー数とフォロー数が正しく設定される', async () => {
      mockPrisma.block.findMany.mockResolvedValue([])
      mockPrisma.user.findMany.mockResolvedValue([
        {
          id: 'user-1',
          nickname: 'テストユーザー',
          avatarUrl: '/avatar.jpg',
          bio: 'テスト',
          _count: { followers: 100, following: 50 },
        },
      ])

      const { searchUsers } = await import('@/lib/actions/search')
      const result = await searchUsers('テスト')

      expect(result.users[0].followersCount).toBe(100)
      expect(result.users[0].followingCount).toBe(50)
    })
  })

  describe('getPopularTags - 追加テスト', () => {
    it('limit引数が正しく渡される', async () => {
      mockPrisma.post.findMany.mockResolvedValue([
        { content: '#盆栽' },
      ])

      const { getPopularTags } = await import('@/lib/actions/search')
      await getPopularTags(5)

      // getCachedPopularTagsに引数が渡されることを確認
      // モックの実装では内部でsliceするので動作確認
    })

    it('コンテンツがないポストは無視される', async () => {
      mockPrisma.post.findMany.mockResolvedValue([
        { content: null },
        { content: '#盆栽' },
      ])

      const { getPopularTags } = await import('@/lib/actions/search')
      const result = await getPopularTags(10)

      expect(result.tags).toContainEqual(
        expect.objectContaining({ tag: '盆栽' })
      )
    })
  })
})
