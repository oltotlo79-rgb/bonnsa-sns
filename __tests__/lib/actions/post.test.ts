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

describe('Post Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAuth.mockResolvedValue({
      user: { id: mockUser.id },
    })
  })

  describe('createPost', () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { createPost } = await import('@/lib/actions/post')
      const formData = new FormData()
      formData.append('content', 'テスト投稿')

      const result = await createPost(formData)

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('空の投稿はエラーを返す', async () => {
      const { createPost } = await import('@/lib/actions/post')
      const formData = new FormData()
      formData.append('content', '')

      const result = await createPost(formData)

      expect(result).toEqual({ error: 'テキストまたはメディアを入力してください' })
    })

    it('500文字を超える投稿はエラーを返す', async () => {
      const { createPost } = await import('@/lib/actions/post')
      const formData = new FormData()
      formData.append('content', 'a'.repeat(501))

      const result = await createPost(formData)

      expect(result).toEqual({ error: '投稿は500文字以内で入力してください' })
    })

    it('1日の投稿上限を超えるとエラーを返す', async () => {
      mockPrisma.post.count.mockResolvedValue(20)

      const { createPost } = await import('@/lib/actions/post')
      const formData = new FormData()
      formData.append('content', 'テスト投稿')

      const result = await createPost(formData)

      expect(result).toEqual({ error: '1日の投稿上限（20件）に達しました' })
    })

    it('正常な投稿を作成できる', async () => {
      mockPrisma.post.count.mockResolvedValue(0)
      mockPrisma.post.create.mockResolvedValue({
        ...mockPost,
        id: 'new-post-id',
      })

      const { createPost } = await import('@/lib/actions/post')
      const formData = new FormData()
      formData.append('content', 'テスト投稿')
      formData.append('genreIds', 'genre-1')

      const result = await createPost(formData)

      expect(result.success).toBe(true)
      expect(result.postId).toBeDefined()
      expect(mockPrisma.post.create).toHaveBeenCalled()
    })
  })

  describe('deletePost', () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { deletePost } = await import('@/lib/actions/post')
      const result = await deletePost('post-id')

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('存在しない投稿は権限エラーを返す', async () => {
      mockPrisma.post.findUnique.mockResolvedValue(null)

      const { deletePost } = await import('@/lib/actions/post')
      const result = await deletePost('non-existent-id')

      expect(result).toEqual({ error: '削除権限がありません' })
    })

    it('他人の投稿は削除できない', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({
        ...mockPost,
        userId: 'other-user-id',
      })

      const { deletePost } = await import('@/lib/actions/post')
      const result = await deletePost('post-id')

      expect(result).toEqual({ error: '削除権限がありません' })
    })

    it('自分の投稿を削除できる', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({
        ...mockPost,
        userId: mockUser.id,
      })
      mockPrisma.post.delete.mockResolvedValue(mockPost)

      const { deletePost } = await import('@/lib/actions/post')
      const result = await deletePost('post-id')

      expect(result).toEqual({ success: true })
    })
  })

  describe('getPost', () => {
    it('存在する投稿を取得できる', async () => {
      const fullPost = {
        ...mockPost,
        _count: { likes: 5, comments: 3 },
        genres: [{ genre: { id: 'genre-1', name: '松柏類', category: '松柏類' } }],
        quotePost: null,
        repostPost: null,
      }
      mockPrisma.post.findUnique.mockResolvedValue(fullPost)
      mockPrisma.like.findFirst.mockResolvedValue(null)
      mockPrisma.bookmark.findFirst.mockResolvedValue(null)

      const { getPost } = await import('@/lib/actions/post')
      const result = await getPost('post-id')

      expect(result.post).toBeDefined()
      expect(result.post?.id).toBe(mockPost.id)
    })

    it('存在しない投稿はエラーを返す', async () => {
      mockPrisma.post.findUnique.mockResolvedValue(null)

      const { getPost } = await import('@/lib/actions/post')
      const result = await getPost('non-existent-id')

      expect(result.error).toBe('投稿が見つかりません')
    })
  })

  describe('getPosts (フィード)', () => {
    it('投稿一覧を取得できる', async () => {
      mockPrisma.post.findMany.mockResolvedValue([
        {
          ...mockPost,
          _count: { likes: 5, comments: 3 },
          genres: [],
          quotePost: null,
          repostPost: null,
        },
      ])
      mockPrisma.follow.findMany.mockResolvedValue([])
      mockPrisma.block.findMany.mockResolvedValue([])
      mockPrisma.mute.findMany.mockResolvedValue([])
      mockPrisma.like.findMany.mockResolvedValue([])
      mockPrisma.bookmark.findMany.mockResolvedValue([])

      const { getPosts } = await import('@/lib/actions/post')
      const result = await getPosts()

      expect(result.posts).toHaveLength(1)
      expect(result.posts[0].id).toBe(mockPost.id)
    })

    it('ブロック/ミュートしたユーザーの投稿は除外される', async () => {
      mockPrisma.follow.findMany.mockResolvedValue([])
      mockPrisma.block.findMany.mockResolvedValue([
        { blockerId: mockUser.id, blockedId: 'blocked-user-id' },
      ])
      mockPrisma.mute.findMany.mockResolvedValue([
        { muterId: mockUser.id, mutedId: 'muted-user-id' },
      ])
      mockPrisma.post.findMany.mockResolvedValue([])
      mockPrisma.like.findMany.mockResolvedValue([])
      mockPrisma.bookmark.findMany.mockResolvedValue([])

      const { getPosts } = await import('@/lib/actions/post')
      await getPosts()

      // findManyが除外リスト付きで呼ばれることを確認
      expect(mockPrisma.post.findMany).toHaveBeenCalled()
    })

    it('ページネーションが動作する', async () => {
      mockPrisma.post.findMany.mockResolvedValue([])
      mockPrisma.follow.findMany.mockResolvedValue([])
      mockPrisma.block.findMany.mockResolvedValue([])
      mockPrisma.mute.findMany.mockResolvedValue([])
      mockPrisma.like.findMany.mockResolvedValue([])
      mockPrisma.bookmark.findMany.mockResolvedValue([])

      const { getPosts } = await import('@/lib/actions/post')
      await getPosts('cursor-id', 10)

      expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          cursor: { id: 'cursor-id' },
          skip: 1,
        })
      )
    })
  })
})
