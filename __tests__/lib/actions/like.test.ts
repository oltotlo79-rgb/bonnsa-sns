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
  })
})
