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

describe('Comment Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAuth.mockResolvedValue({
      user: { id: mockUser.id },
    })
  })

  describe('createComment', () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { createComment } = await import('@/lib/actions/comment')
      const formData = new FormData()
      formData.append('postId', 'post-id')
      formData.append('content', 'テストコメント')
      const result = await createComment(formData)

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('空のコメントはエラーを返す', async () => {
      const { createComment } = await import('@/lib/actions/comment')
      const formData = new FormData()
      formData.append('postId', 'post-id')
      formData.append('content', '')
      const result = await createComment(formData)

      expect(result).toEqual({ error: 'コメント内容またはメディアを入力してください' })
    })

    it('500文字を超えるコメントはエラーを返す', async () => {
      const { createComment } = await import('@/lib/actions/comment')
      const formData = new FormData()
      formData.append('postId', 'post-id')
      formData.append('content', 'a'.repeat(501))
      const result = await createComment(formData)

      expect(result).toEqual({ error: 'コメントは500文字以内で入力してください' })
    })

    it('1日のコメント上限を超えるとエラーを返す', async () => {
      mockPrisma.comment.count.mockResolvedValue(100)

      const { createComment } = await import('@/lib/actions/comment')
      const formData = new FormData()
      formData.append('postId', 'post-id')
      formData.append('content', 'テストコメント')
      const result = await createComment(formData)

      expect(result).toEqual({ error: '1日のコメント上限（100件）に達しました' })
    })

    it('正常にコメントを作成できる', async () => {
      mockPrisma.comment.count.mockResolvedValue(0)
      mockPrisma.comment.create.mockResolvedValue({
        ...mockComment,
        id: 'new-comment-id',
      })
      mockPrisma.post.findUnique.mockResolvedValue({
        ...mockPost,
        userId: mockUser.id,
      })

      const { createComment } = await import('@/lib/actions/comment')
      const formData = new FormData()
      formData.append('postId', 'post-id')
      formData.append('content', 'テストコメント')
      const result = await createComment(formData)

      expect(result.success).toBe(true)
      expect(result.comment?.id).toBe('new-comment-id')
    })

    it('返信コメントを作成できる', async () => {
      mockPrisma.comment.count.mockResolvedValue(0)
      mockPrisma.comment.create.mockResolvedValue({
        ...mockComment,
        id: 'reply-comment-id',
        parentId: mockComment.id,
      })
      mockPrisma.comment.findUnique.mockResolvedValue({
        ...mockComment,
        userId: 'other-user-id',
      })
      mockPrisma.notification.create.mockResolvedValue({})

      const { createComment } = await import('@/lib/actions/comment')
      const formData = new FormData()
      formData.append('postId', 'post-id')
      formData.append('parentId', mockComment.id)
      formData.append('content', '返信コメント')
      const result = await createComment(formData)

      expect(result.success).toBe(true)
    })

    it('他人の投稿にコメントすると通知が作成される', async () => {
      mockPrisma.comment.count.mockResolvedValue(0)
      mockPrisma.comment.create.mockResolvedValue({
        ...mockComment,
        id: 'new-comment-id',
      })
      mockPrisma.post.findUnique.mockResolvedValue({
        ...mockPost,
        userId: 'other-user-id',
      })
      mockPrisma.notification.create.mockResolvedValue({})

      const { createComment } = await import('@/lib/actions/comment')
      const formData = new FormData()
      formData.append('postId', 'post-id')
      formData.append('content', 'テストコメント')
      await createComment(formData)

      expect(mockPrisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'other-user-id',
            actorId: mockUser.id,
            type: 'comment',
          }),
        })
      )
    })
  })

  describe('deleteComment', () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { deleteComment } = await import('@/lib/actions/comment')
      const result = await deleteComment('comment-id')

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('存在しないコメントはエラーを返す', async () => {
      mockPrisma.comment.findUnique.mockResolvedValue(null)

      const { deleteComment } = await import('@/lib/actions/comment')
      const result = await deleteComment('non-existent-id')

      expect(result).toEqual({ error: 'コメントが見つかりません' })
    })

    it('他人のコメントは削除できない', async () => {
      mockPrisma.comment.findUnique.mockResolvedValue({
        ...mockComment,
        userId: 'other-user-id',
        postId: 'post-id',
      })

      const { deleteComment } = await import('@/lib/actions/comment')
      const result = await deleteComment('comment-id')

      expect(result).toEqual({ error: '削除権限がありません' })
    })

    it('自分のコメントを削除できる', async () => {
      mockPrisma.comment.findUnique.mockResolvedValue({
        ...mockComment,
        userId: mockUser.id,
        postId: 'post-id',
      })
      mockPrisma.comment.delete.mockResolvedValue(mockComment)

      const { deleteComment } = await import('@/lib/actions/comment')
      const result = await deleteComment('comment-id')

      expect(result).toEqual({ success: true })
    })
  })

  describe('getComments', () => {
    it('投稿のコメント一覧を取得できる', async () => {
      mockPrisma.comment.findMany.mockResolvedValue([
        {
          ...mockComment,
          _count: { likes: 2, replies: 1 },
          media: [],
        },
      ])
      mockPrisma.block.findMany.mockResolvedValue([])
      mockPrisma.like.findMany.mockResolvedValue([])

      const { getComments } = await import('@/lib/actions/comment')
      const result = await getComments('post-id')

      expect(result.comments).toHaveLength(1)
      expect(result.comments[0].id).toBe(mockComment.id)
    })

    it('ブロックしたユーザーのコメントは除外される', async () => {
      mockPrisma.block.findMany.mockResolvedValue([
        { blockerId: mockUser.id, blockedId: 'blocked-user-id' },
      ])
      mockPrisma.comment.findMany.mockResolvedValue([])
      mockPrisma.like.findMany.mockResolvedValue([])

      const { getComments } = await import('@/lib/actions/comment')
      await getComments('post-id')

      expect(mockPrisma.comment.findMany).toHaveBeenCalled()
    })

    it('ページネーションが動作する', async () => {
      mockPrisma.block.findMany.mockResolvedValue([])
      mockPrisma.comment.findMany.mockResolvedValue([])
      mockPrisma.like.findMany.mockResolvedValue([])

      const { getComments } = await import('@/lib/actions/comment')
      await getComments('post-id', 'cursor-id', 10)

      expect(mockPrisma.comment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          cursor: { id: 'cursor-id' },
          skip: 1,
        })
      )
    })
  })
})
