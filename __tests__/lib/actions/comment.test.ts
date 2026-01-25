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
jest.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: jest.fn().mockResolvedValue({ success: true }),
  checkDailyLimit: jest.fn().mockResolvedValue({ allowed: true, count: 0 }),
}))

describe('Comment Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAuth.mockResolvedValue({
      user: { id: mockUser.id },
    })
    // isSuspended check用
    mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false })
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

    it('いいね状態が正しく取得される', async () => {
      mockPrisma.block.findMany.mockResolvedValue([])
      mockPrisma.comment.findMany.mockResolvedValue([
        {
          ...mockComment,
          id: 'comment-1',
          _count: { likes: 5, replies: 0 },
          media: [],
        },
        {
          ...mockComment,
          id: 'comment-2',
          _count: { likes: 3, replies: 0 },
          media: [],
        },
      ])
      mockPrisma.like.findMany.mockResolvedValue([
        { commentId: 'comment-1' },
      ])

      const { getComments } = await import('@/lib/actions/comment')
      const result = await getComments('post-id')

      expect(result.comments[0].isLiked).toBe(true)
      expect(result.comments[1].isLiked).toBe(false)
    })

    it('未認証でもコメント一覧を取得できる', async () => {
      mockAuth.mockResolvedValue(null)
      mockPrisma.block.findMany.mockResolvedValue([])
      mockPrisma.comment.findMany.mockResolvedValue([
        {
          ...mockComment,
          _count: { likes: 2, replies: 1 },
          media: [],
        },
      ])

      const { getComments } = await import('@/lib/actions/comment')
      const result = await getComments('post-id')

      expect(result.comments).toHaveLength(1)
      expect(result.comments[0].isLiked).toBe(false)
    })
  })

  describe('createComment - 追加テスト', () => {
    it('レート制限に達した場合はエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false })
      const { checkUserRateLimit } = await import('@/lib/rate-limit')
      ;(checkUserRateLimit as jest.Mock).mockResolvedValueOnce({ success: false })

      const { createComment } = await import('@/lib/actions/comment')
      const formData = new FormData()
      formData.append('postId', 'post-id')
      formData.append('content', 'テストコメント')
      const result = await createComment(formData)

      expect(result).toEqual({ error: 'コメント投稿が多すぎます。しばらく待ってから再試行してください' })
    })

    it('メディア付きコメントを作成できる', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false })
      mockPrisma.comment.count.mockResolvedValue(0)
      mockPrisma.comment.create.mockResolvedValue({
        ...mockComment,
        id: 'media-comment-id',
      })
      mockPrisma.post.findUnique.mockResolvedValue({
        ...mockPost,
        userId: mockUser.id,
      })

      const { createComment } = await import('@/lib/actions/comment')
      const formData = new FormData()
      formData.append('postId', 'post-id')
      formData.append('content', 'テストコメント')
      formData.append('mediaUrls', 'https://example.com/image.jpg')
      formData.append('mediaTypes', 'image')
      const result = await createComment(formData)

      expect(result.success).toBe(true)
    })

    it('画像が上限を超える場合はエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false })

      const { createComment } = await import('@/lib/actions/comment')
      const formData = new FormData()
      formData.append('postId', 'post-id')
      formData.append('content', 'テストコメント')
      // 3枚以上の画像（上限は2枚）
      for (let i = 0; i < 3; i++) {
        formData.append('mediaUrls', `https://example.com/image${i}.jpg`)
        formData.append('mediaTypes', 'image')
      }
      const result = await createComment(formData)

      expect(result).toEqual({ error: '画像は2枚までです' })
    })

    it('動画が上限を超える場合はエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false })

      const { createComment } = await import('@/lib/actions/comment')
      const formData = new FormData()
      formData.append('postId', 'post-id')
      formData.append('content', 'テストコメント')
      formData.append('mediaUrls', 'https://example.com/video1.mp4')
      formData.append('mediaTypes', 'video')
      formData.append('mediaUrls', 'https://example.com/video2.mp4')
      formData.append('mediaTypes', 'video')
      const result = await createComment(formData)

      expect(result).toEqual({ error: '動画は1本までです' })
    })

    it('メディアのみのコメントも作成できる', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false })
      mockPrisma.comment.count.mockResolvedValue(0)
      mockPrisma.comment.create.mockResolvedValue({
        ...mockComment,
        id: 'media-only-comment-id',
      })
      mockPrisma.post.findUnique.mockResolvedValue({
        ...mockPost,
        userId: mockUser.id,
      })

      const { createComment } = await import('@/lib/actions/comment')
      const formData = new FormData()
      formData.append('postId', 'post-id')
      formData.append('content', '')
      formData.append('mediaUrls', 'https://example.com/image.jpg')
      formData.append('mediaTypes', 'image')
      const result = await createComment(formData)

      expect(result.success).toBe(true)
    })

    it('エラー発生時はエラーメッセージを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false })
      mockPrisma.comment.count.mockResolvedValue(0)
      mockPrisma.comment.create.mockRejectedValue(new Error('Database error'))

      const { createComment } = await import('@/lib/actions/comment')
      const formData = new FormData()
      formData.append('postId', 'post-id')
      formData.append('content', 'テストコメント')
      const result = await createComment(formData)

      expect(result).toEqual({ error: 'コメントの作成に失敗しました' })
    })
  })

  describe('getReplies', () => {
    it('コメントへの返信一覧を取得できる', async () => {
      mockPrisma.block.findMany.mockResolvedValue([])
      mockPrisma.comment.findMany.mockResolvedValue([
        {
          id: 'reply-1',
          parentId: 'comment-id',
          content: '返信1',
          user: mockUser,
          _count: { likes: 1, replies: 0 },
          media: [],
          createdAt: new Date(),
        },
        {
          id: 'reply-2',
          parentId: 'comment-id',
          content: '返信2',
          user: mockUser,
          _count: { likes: 2, replies: 0 },
          media: [],
          createdAt: new Date(),
        },
      ])
      mockPrisma.like.findMany.mockResolvedValue([])

      const { getReplies } = await import('@/lib/actions/comment')
      const result = await getReplies('comment-id')

      expect(result.replies).toHaveLength(2)
      expect(result.replies[0].parentId).toBe('comment-id')
    })

    it('ブロックしたユーザーの返信は除外される', async () => {
      mockPrisma.block.findMany.mockResolvedValue([
        { blockerId: mockUser.id, blockedId: 'blocked-user-id' },
      ])
      mockPrisma.comment.findMany.mockResolvedValue([])
      mockPrisma.like.findMany.mockResolvedValue([])

      const { getReplies } = await import('@/lib/actions/comment')
      await getReplies('comment-id')

      expect(mockPrisma.comment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            parentId: 'comment-id',
          }),
        })
      )
    })

    it('ページネーションが動作する', async () => {
      mockPrisma.block.findMany.mockResolvedValue([])
      mockPrisma.comment.findMany.mockResolvedValue([])
      mockPrisma.like.findMany.mockResolvedValue([])

      const { getReplies } = await import('@/lib/actions/comment')
      await getReplies('comment-id', 'cursor-id', 10)

      expect(mockPrisma.comment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          cursor: { id: 'cursor-id' },
          skip: 1,
        })
      )
    })
  })

  describe('getCommentCount', () => {
    it('投稿のコメント数を取得できる', async () => {
      mockPrisma.comment.count.mockResolvedValue(42)

      const { getCommentCount } = await import('@/lib/actions/comment')
      const result = await getCommentCount('post-id')

      expect(result).toEqual({ count: 42 })
      expect(mockPrisma.comment.count).toHaveBeenCalledWith({
        where: { postId: 'post-id', isHidden: false },
      })
    })

    it('コメントがない場合は0を返す', async () => {
      mockPrisma.comment.count.mockResolvedValue(0)

      const { getCommentCount } = await import('@/lib/actions/comment')
      const result = await getCommentCount('post-id')

      expect(result).toEqual({ count: 0 })
    })

    it('エラー発生時は0を返す', async () => {
      mockPrisma.comment.count.mockRejectedValue(new Error('Database error'))

      const { getCommentCount } = await import('@/lib/actions/comment')
      const result = await getCommentCount('post-id')

      expect(result).toEqual({ count: 0 })
    })
  })

  describe('uploadCommentMedia', () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { uploadCommentMedia } = await import('@/lib/actions/comment')
      const formData = new FormData()
      const result = await uploadCommentMedia(formData)

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('ファイルが選択されていない場合はエラーを返す', async () => {
      const { uploadCommentMedia } = await import('@/lib/actions/comment')
      const formData = new FormData()
      const result = await uploadCommentMedia(formData)

      expect(result).toEqual({ error: 'ファイルが選択されていません' })
    })
  })

  describe('deleteComment - 追加テスト', () => {
    it('エラー発生時はエラーメッセージを返す', async () => {
      mockPrisma.comment.findUnique.mockResolvedValue({
        ...mockComment,
        userId: mockUser.id,
        postId: 'post-id',
      })
      mockPrisma.comment.delete.mockRejectedValue(new Error('Database error'))

      const { deleteComment } = await import('@/lib/actions/comment')
      const result = await deleteComment('comment-id')

      expect(result).toEqual({ error: 'コメントの削除に失敗しました' })
    })
  })

  describe('getComments - エラーケース', () => {
    it('エラー発生時は空の配列を返す', async () => {
      mockPrisma.block.findMany.mockResolvedValue([])
      mockPrisma.comment.findMany.mockRejectedValue(new Error('Database error'))

      const { getComments } = await import('@/lib/actions/comment')
      const result = await getComments('post-id')

      expect(result.comments).toEqual([])
    })
  })
})
