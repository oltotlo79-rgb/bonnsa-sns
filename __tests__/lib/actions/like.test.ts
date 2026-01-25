/**
 * @jest-environment node
 */

import { createMockPrismaClient, mockUser, mockPost, mockComment } from '../../utils/test-utils'

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

// レート制限モック
const mockCheckUserRateLimit = jest.fn().mockResolvedValue({ success: true })
jest.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: (...args: unknown[]) => mockCheckUserRateLimit(...args),
}))

// analyticsモック
jest.mock('@/lib/actions/analytics', () => ({
  recordLikeReceived: jest.fn().mockResolvedValue(undefined),
}))

describe('Like Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAuth.mockResolvedValue({
      user: { id: mockUser.id },
    })
  })

  describe('togglePostLike (投稿)', () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { togglePostLike } = await import('@/lib/actions/like')
      const result = await togglePostLike('post-id')

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('いいねしていない場合は追加する', async () => {
      mockPrisma.like.findFirst.mockResolvedValue(null)
      mockPrisma.like.create.mockResolvedValue({
        id: 'like-1',
        userId: mockUser.id,
        postId: mockPost.id,
        commentId: null,
      })
      mockPrisma.post.findUnique.mockResolvedValue({
        ...mockPost,
        userId: mockUser.id,
      })

      const { togglePostLike } = await import('@/lib/actions/like')
      const result = await togglePostLike('post-id')

      expect(result).toEqual({ success: true, liked: true })
      expect(mockPrisma.like.create).toHaveBeenCalled()
    })

    it('いいね済みの場合は削除する', async () => {
      mockPrisma.like.findFirst.mockResolvedValue({
        id: 'like-1',
        userId: mockUser.id,
        postId: mockPost.id,
        commentId: null,
      })
      mockPrisma.like.delete.mockResolvedValue({})

      const { togglePostLike } = await import('@/lib/actions/like')
      const result = await togglePostLike('post-id')

      expect(result).toEqual({ success: true, liked: false })
      expect(mockPrisma.like.delete).toHaveBeenCalled()
    })

    it('他人の投稿にいいねすると通知が作成される', async () => {
      mockPrisma.like.findFirst.mockResolvedValue(null)
      mockPrisma.like.create.mockResolvedValue({
        id: 'like-1',
        userId: mockUser.id,
        postId: mockPost.id,
        commentId: null,
      })
      mockPrisma.post.findUnique.mockResolvedValue({
        ...mockPost,
        userId: 'other-user-id',
      })
      mockPrisma.notification.create.mockResolvedValue({})

      const { togglePostLike } = await import('@/lib/actions/like')
      await togglePostLike('post-id')

      expect(mockPrisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'other-user-id',
            actorId: mockUser.id,
            type: 'like',
          }),
        })
      )
    })

    it('自分の投稿にいいねしても通知は作成されない', async () => {
      mockPrisma.like.findFirst.mockResolvedValue(null)
      mockPrisma.like.create.mockResolvedValue({})
      mockPrisma.post.findUnique.mockResolvedValue({
        ...mockPost,
        userId: mockUser.id,
      })

      const { togglePostLike } = await import('@/lib/actions/like')
      await togglePostLike('post-id')

      expect(mockPrisma.notification.create).not.toHaveBeenCalled()
    })
  })

  describe('toggleCommentLike (コメント)', () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { toggleCommentLike } = await import('@/lib/actions/like')
      const result = await toggleCommentLike('comment-id', 'post-id')

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('コメントにいいねを追加できる', async () => {
      mockPrisma.like.findFirst.mockResolvedValue(null)
      mockPrisma.like.create.mockResolvedValue({
        id: 'like-1',
        userId: mockUser.id,
        postId: null,
        commentId: mockComment.id,
      })
      mockPrisma.comment.findUnique.mockResolvedValue({
        ...mockComment,
        userId: mockUser.id,
      })

      const { toggleCommentLike } = await import('@/lib/actions/like')
      const result = await toggleCommentLike('comment-id', 'post-id')

      expect(result).toEqual({ success: true, liked: true })
    })

    it('コメントのいいねを削除できる', async () => {
      mockPrisma.like.findFirst.mockResolvedValue({
        id: 'like-1',
        userId: mockUser.id,
        commentId: mockComment.id,
      })
      mockPrisma.like.delete.mockResolvedValue({})

      const { toggleCommentLike } = await import('@/lib/actions/like')
      const result = await toggleCommentLike('comment-id', 'post-id')

      expect(result).toEqual({ success: true, liked: false })
    })

    it('他人のコメントにいいねすると通知が作成される', async () => {
      mockPrisma.like.findFirst.mockResolvedValue(null)
      mockPrisma.like.create.mockResolvedValue({
        id: 'like-1',
        userId: mockUser.id,
        postId: null,
        commentId: mockComment.id,
      })
      mockPrisma.comment.findUnique.mockResolvedValue({
        ...mockComment,
        userId: 'other-user-id',
      })
      mockPrisma.notification.create.mockResolvedValue({})

      const { toggleCommentLike } = await import('@/lib/actions/like')
      await toggleCommentLike('comment-id', 'post-id')

      expect(mockPrisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'other-user-id',
            actorId: mockUser.id,
            type: 'comment_like',
          }),
        })
      )
    })
  })

  describe('getPostLikeStatus', () => {
    it('いいね状態を取得できる（いいね済み）', async () => {
      mockPrisma.like.findFirst.mockResolvedValue({
        id: 'like-1',
        userId: mockUser.id,
        postId: 'post-id',
      })

      const { getPostLikeStatus } = await import('@/lib/actions/like')
      const result = await getPostLikeStatus('post-id')

      expect(result.liked).toBe(true)
    })

    it('いいね状態を取得できる（未いいね）', async () => {
      mockPrisma.like.findFirst.mockResolvedValue(null)

      const { getPostLikeStatus } = await import('@/lib/actions/like')
      const result = await getPostLikeStatus('post-id')

      expect(result.liked).toBe(false)
    })

    it('未認証の場合はfalseを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { getPostLikeStatus } = await import('@/lib/actions/like')
      const result = await getPostLikeStatus('post-id')

      expect(result.liked).toBe(false)
    })

    it('エラー発生時はfalseを返す', async () => {
      mockPrisma.like.findFirst.mockRejectedValue(new Error('Database error'))

      const { getPostLikeStatus } = await import('@/lib/actions/like')
      const result = await getPostLikeStatus('post-id')

      expect(result.liked).toBe(false)
    })
  })

  describe('togglePostLike - 追加テスト', () => {
    it('レート制限に達した場合はエラーを返す', async () => {
      mockCheckUserRateLimit.mockResolvedValueOnce({ success: false })

      const { togglePostLike } = await import('@/lib/actions/like')
      const result = await togglePostLike('post-id')

      expect(result).toEqual({ error: '操作が多すぎます。しばらく待ってから再試行してください' })
    })

    it('エラー発生時はエラーメッセージを返す', async () => {
      mockCheckUserRateLimit.mockResolvedValue({ success: true })
      mockPrisma.like.findFirst.mockRejectedValue(new Error('Database error'))

      const { togglePostLike } = await import('@/lib/actions/like')
      const result = await togglePostLike('post-id')

      expect(result).toEqual({ error: 'いいねの処理に失敗しました' })
    })

    it('投稿が見つからない場合でも処理は成功する', async () => {
      mockCheckUserRateLimit.mockResolvedValue({ success: true })
      mockPrisma.like.findFirst.mockResolvedValue(null)
      mockPrisma.like.create.mockResolvedValue({})
      mockPrisma.post.findUnique.mockResolvedValue(null)

      const { togglePostLike } = await import('@/lib/actions/like')
      const result = await togglePostLike('post-id')

      expect(result).toEqual({ success: true, liked: true })
      expect(mockPrisma.notification.create).not.toHaveBeenCalled()
    })
  })

  describe('toggleCommentLike - 追加テスト', () => {
    it('レート制限に達した場合はエラーを返す', async () => {
      mockCheckUserRateLimit.mockResolvedValueOnce({ success: false })

      const { toggleCommentLike } = await import('@/lib/actions/like')
      const result = await toggleCommentLike('comment-id', 'post-id')

      expect(result).toEqual({ error: '操作が多すぎます。しばらく待ってから再試行してください' })
    })

    it('自分のコメントにいいねしても通知は作成されない', async () => {
      mockCheckUserRateLimit.mockResolvedValue({ success: true })
      mockPrisma.like.findFirst.mockResolvedValue(null)
      mockPrisma.like.create.mockResolvedValue({
        id: 'like-1',
        userId: mockUser.id,
        postId: null,
        commentId: mockComment.id,
      })
      mockPrisma.comment.findUnique.mockResolvedValue({
        ...mockComment,
        userId: mockUser.id,
      })

      const { toggleCommentLike } = await import('@/lib/actions/like')
      await toggleCommentLike('comment-id', 'post-id')

      expect(mockPrisma.notification.create).not.toHaveBeenCalled()
    })

    it('コメントが見つからない場合でも処理は成功する', async () => {
      mockCheckUserRateLimit.mockResolvedValue({ success: true })
      mockPrisma.like.findFirst.mockResolvedValue(null)
      mockPrisma.like.create.mockResolvedValue({})
      mockPrisma.comment.findUnique.mockResolvedValue(null)

      const { toggleCommentLike } = await import('@/lib/actions/like')
      const result = await toggleCommentLike('comment-id', 'post-id')

      expect(result).toEqual({ success: true, liked: true })
      expect(mockPrisma.notification.create).not.toHaveBeenCalled()
    })

    it('エラー発生時はエラーメッセージを返す', async () => {
      mockCheckUserRateLimit.mockResolvedValue({ success: true })
      mockPrisma.like.findFirst.mockRejectedValue(new Error('Database error'))

      const { toggleCommentLike } = await import('@/lib/actions/like')
      const result = await toggleCommentLike('comment-id', 'post-id')

      expect(result).toEqual({ error: 'いいねの処理に失敗しました' })
    })
  })

  describe('getLikedPosts', () => {
    it('ユーザーがいいねした投稿一覧を取得できる', async () => {
      const likeData = {
        id: 'like-1',
        userId: mockUser.id,
        postId: 'post-1',
        commentId: null,
        createdAt: new Date(),
        post: {
          ...mockPost,
          id: 'post-1',
          user: mockUser,
          media: [],
          genres: [],
          _count: { likes: 5, comments: 3 },
        },
      }
      // 最初の呼び出し（いいね一覧取得）
      mockPrisma.like.findMany.mockResolvedValueOnce([likeData])
      // 2回目の呼び出し（現在のユーザーのいいね状態取得）
      mockPrisma.like.findMany.mockResolvedValueOnce([{ postId: 'post-1' }])
      mockPrisma.bookmark.findMany.mockResolvedValue([])

      const { getLikedPosts } = await import('@/lib/actions/like')
      const result = await getLikedPosts(mockUser.id)

      expect(result.posts).toHaveLength(1)
      expect(mockPrisma.like.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: mockUser.id,
            postId: { not: null },
            commentId: null,
          },
        })
      )
    })

    it('未認証でもいいねした投稿を取得できる', async () => {
      mockAuth.mockResolvedValue(null)
      mockPrisma.like.findMany.mockResolvedValue([
        {
          id: 'like-1',
          postId: 'post-1',
          post: {
            ...mockPost,
            id: 'post-1',
            user: mockUser,
            media: [],
            genres: [],
            _count: { likes: 5, comments: 3 },
          },
        },
      ])

      const { getLikedPosts } = await import('@/lib/actions/like')
      const result = await getLikedPosts('other-user-id')

      expect(result.posts).toHaveLength(1)
      // 未認証なのでisLiked/isBookmarkedはfalse
      expect(result.posts[0].isLiked).toBe(false)
      expect(result.posts[0].isBookmarked).toBe(false)
    })

    it('ページネーションが動作する', async () => {
      mockPrisma.like.findMany.mockResolvedValue([])

      const { getLikedPosts } = await import('@/lib/actions/like')
      await getLikedPosts(mockUser.id, 'cursor-id', 10)

      expect(mockPrisma.like.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          cursor: { id: 'cursor-id' },
          skip: 1,
        })
      )
    })

    it('削除された投稿は除外される', async () => {
      // 最初の呼び出し（いいね一覧取得）
      mockPrisma.like.findMany.mockResolvedValueOnce([
        {
          id: 'like-1',
          postId: 'deleted-post-id',
          createdAt: new Date(),
          post: null, // 削除された投稿
        },
        {
          id: 'like-2',
          postId: 'post-1',
          createdAt: new Date(),
          post: {
            ...mockPost,
            id: 'post-1',
            user: mockUser,
            media: [],
            genres: [],
            _count: { likes: 5, comments: 3 },
          },
        },
      ])
      // 2回目の呼び出し（現在のユーザーのいいね状態取得）
      mockPrisma.like.findMany.mockResolvedValueOnce([{ postId: 'post-1' }])
      mockPrisma.bookmark.findMany.mockResolvedValue([])

      const { getLikedPosts } = await import('@/lib/actions/like')
      const result = await getLikedPosts(mockUser.id)

      expect(result.posts).toHaveLength(1)
      expect(result.posts[0].id).toBe('post-1')
    })

    it('いいね/ブックマーク状態が正しく設定される', async () => {
      mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
      mockPrisma.like.findMany
        .mockResolvedValueOnce([
          {
            id: 'like-1',
            postId: 'post-1',
            post: {
              ...mockPost,
              id: 'post-1',
              user: mockUser,
              media: [],
              genres: [],
              _count: { likes: 5, comments: 3 },
            },
          },
        ])
        .mockResolvedValueOnce([{ postId: 'post-1' }])
      mockPrisma.bookmark.findMany.mockResolvedValue([{ postId: 'post-1' }])

      const { getLikedPosts } = await import('@/lib/actions/like')
      const result = await getLikedPosts('other-user-id')

      expect(result.posts[0].isLiked).toBe(true)
      expect(result.posts[0].isBookmarked).toBe(true)
    })

    it('エラー発生時は空の配列を返す', async () => {
      mockPrisma.like.findMany.mockRejectedValue(new Error('Database error'))

      const { getLikedPosts } = await import('@/lib/actions/like')
      const result = await getLikedPosts(mockUser.id)

      expect(result.posts).toEqual([])
      expect(result.nextCursor).toBeUndefined()
    })

    it('limit件取得した場合は次のカーソルを返す', async () => {
      const likes = Array(20).fill(null).map((_, i) => ({
        id: `like-${i}`,
        postId: `post-${i}`,
        createdAt: new Date(),
        post: {
          ...mockPost,
          id: `post-${i}`,
          user: mockUser,
          media: [],
          genres: [],
          _count: { likes: 0, comments: 0 },
        },
      }))
      // 最初の呼び出し（いいね一覧取得）
      mockPrisma.like.findMany.mockResolvedValueOnce(likes)
      // 2回目の呼び出し（現在のユーザーのいいね状態取得）
      const postIds = Array(20).fill(null).map((_, i) => ({ postId: `post-${i}` }))
      mockPrisma.like.findMany.mockResolvedValueOnce(postIds)
      mockPrisma.bookmark.findMany.mockResolvedValue([])

      const { getLikedPosts } = await import('@/lib/actions/like')
      const result = await getLikedPosts(mockUser.id)

      expect(result.nextCursor).toBe('like-19')
    })
  })
})
