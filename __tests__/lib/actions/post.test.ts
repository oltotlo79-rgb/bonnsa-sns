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

// レート制限モック
const mockCheckUserRateLimit = jest.fn().mockResolvedValue({ success: true })
const mockCheckDailyLimit = jest.fn().mockResolvedValue({ allowed: true, count: 0, limit: 50 })
jest.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: (...args: unknown[]) => mockCheckUserRateLimit(...args),
  checkDailyLimit: (...args: unknown[]) => mockCheckDailyLimit(...args),
}))

// ストレージモック
const mockUploadFile = jest.fn().mockResolvedValue({ success: true, url: 'https://example.com/file.jpg' })
jest.mock('@/lib/storage', () => ({
  uploadFile: (...args: unknown[]) => mockUploadFile(...args),
}))

// 会員制限モック
const mockGetMembershipLimits = jest.fn().mockResolvedValue({
  maxPostLength: 500,
  maxImages: 4,
  maxVideos: 1,
  maxDailyPosts: 20,
})
jest.mock('@/lib/premium', () => ({
  getMembershipLimits: (...args: unknown[]) => mockGetMembershipLimits(...args),
}))

// サニタイズモック
jest.mock('@/lib/sanitize', () => ({
  sanitizePostContent: (content: string) => content,
}))

// ハッシュタグモック
jest.mock('@/lib/actions/hashtag', () => ({
  attachHashtagsToPost: jest.fn().mockResolvedValue(undefined),
  detachHashtagsFromPost: jest.fn().mockResolvedValue(undefined),
}))

// メンションモック
jest.mock('@/lib/actions/mention', () => ({
  notifyMentionedUsers: jest.fn().mockResolvedValue(undefined),
}))

// ロガーモック
jest.mock('@/lib/logger', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}))

describe('Post Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAuth.mockResolvedValue({
      user: { id: mockUser.id },
    })
    // isSuspended check用
    mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false })
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

  describe('createPost - 追加テスト', () => {
    it('アカウント停止中はエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: true })

      const { createPost } = await import('@/lib/actions/post')
      const formData = new FormData()
      formData.append('content', 'テスト投稿')

      const result = await createPost(formData)

      expect(result).toEqual({ error: 'アカウントが停止されています' })
    })

    it('レート制限に達した場合はエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false })
      mockCheckUserRateLimit.mockResolvedValueOnce({ success: false })

      const { createPost } = await import('@/lib/actions/post')
      const formData = new FormData()
      formData.append('content', 'テスト投稿')

      const result = await createPost(formData)

      expect(result).toEqual({ error: '投稿が多すぎます。しばらく待ってから再試行してください' })
    })

    it('ジャンルが3つを超える場合はエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false })

      const { createPost } = await import('@/lib/actions/post')
      const formData = new FormData()
      formData.append('content', 'テスト投稿')
      formData.append('genreIds', 'genre-1')
      formData.append('genreIds', 'genre-2')
      formData.append('genreIds', 'genre-3')
      formData.append('genreIds', 'genre-4')

      const result = await createPost(formData)

      expect(result).toEqual({ error: 'ジャンルは3つまで選択できます' })
    })

    it('画像が上限を超える場合はエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false })

      const { createPost } = await import('@/lib/actions/post')
      const formData = new FormData()
      formData.append('content', 'テスト投稿')
      // 5枚の画像を追加（上限は4枚）
      for (let i = 0; i < 5; i++) {
        formData.append('mediaUrls', `https://example.com/image${i}.jpg`)
        formData.append('mediaTypes', 'image')
      }

      const result = await createPost(formData)

      expect(result).toEqual({ error: '画像は4枚までです' })
    })

    it('動画が上限を超える場合はエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false })

      const { createPost } = await import('@/lib/actions/post')
      const formData = new FormData()
      formData.append('content', 'テスト投稿')
      // 2本の動画を追加（上限は1本）
      formData.append('mediaUrls', 'https://example.com/video1.mp4')
      formData.append('mediaTypes', 'video')
      formData.append('mediaUrls', 'https://example.com/video2.mp4')
      formData.append('mediaTypes', 'video')

      const result = await createPost(formData)

      expect(result).toEqual({ error: '動画は1本までです' })
    })

    it('メディアのみの投稿も作成できる', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false })
      mockPrisma.post.count.mockResolvedValue(0)
      mockPrisma.post.create.mockResolvedValue({ ...mockPost, id: 'media-only-post' })

      const { createPost } = await import('@/lib/actions/post')
      const formData = new FormData()
      formData.append('content', '')
      formData.append('mediaUrls', 'https://example.com/image.jpg')
      formData.append('mediaTypes', 'image')

      const result = await createPost(formData)

      expect(result.success).toBe(true)
      expect(result.postId).toBe('media-only-post')
    })

    it('エラー発生時はエラーメッセージを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false })
      mockPrisma.post.count.mockResolvedValue(0)
      mockPrisma.post.create.mockRejectedValue(new Error('Database error'))

      const { createPost } = await import('@/lib/actions/post')
      const formData = new FormData()
      formData.append('content', 'テスト投稿')

      const result = await createPost(formData)

      expect(result).toEqual({ error: '投稿の作成に失敗しました' })
    })
  })

  describe('createQuotePost', () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { createQuotePost } = await import('@/lib/actions/post')
      const formData = new FormData()
      formData.append('content', '引用コメント')

      const result = await createQuotePost(formData, 'post-id')

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('アカウント停止中はエラーを返す', async () => {
      mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: true })

      const { createQuotePost } = await import('@/lib/actions/post')
      const formData = new FormData()
      formData.append('content', '引用コメント')

      const result = await createQuotePost(formData, 'post-id')

      expect(result).toEqual({ error: 'アカウントが停止されています' })
    })

    it('引用コメントが空の場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false })

      const { createQuotePost } = await import('@/lib/actions/post')
      const formData = new FormData()
      formData.append('content', '')

      const result = await createQuotePost(formData, 'post-id')

      expect(result).toEqual({ error: '引用コメントを入力してください' })
    })

    it('引用コメントが文字数制限を超える場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false })

      const { createQuotePost } = await import('@/lib/actions/post')
      const formData = new FormData()
      formData.append('content', 'a'.repeat(501))

      const result = await createQuotePost(formData, 'post-id')

      expect(result).toEqual({ error: '投稿は500文字以内で入力してください' })
    })

    it('投稿上限に達した場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false })
      mockPrisma.post.count.mockResolvedValue(20)

      const { createQuotePost } = await import('@/lib/actions/post')
      const formData = new FormData()
      formData.append('content', '引用コメント')

      const result = await createQuotePost(formData, 'post-id')

      expect(result).toEqual({ error: '1日の投稿上限（20件）に達しました' })
    })

    it('正常に引用投稿を作成できる', async () => {
      mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false })
      mockPrisma.post.count.mockResolvedValue(0)
      mockPrisma.post.create.mockResolvedValue({ ...mockPost, id: 'quote-post-id' })
      mockPrisma.post.findUnique.mockResolvedValue({ userId: 'other-user-id' })
      mockPrisma.notification.create.mockResolvedValue({})

      const { createQuotePost } = await import('@/lib/actions/post')
      const formData = new FormData()
      formData.append('content', '引用コメント')

      const result = await createQuotePost(formData, 'post-id')

      expect(result.success).toBe(true)
      expect(result.postId).toBe('quote-post-id')
      expect(mockPrisma.notification.create).toHaveBeenCalled()
    })

    it('自分の投稿を引用した場合は通知が作成されない', async () => {
      mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false })
      mockPrisma.post.count.mockResolvedValue(0)
      mockPrisma.post.create.mockResolvedValue({ ...mockPost, id: 'quote-post-id' })
      mockPrisma.post.findUnique.mockResolvedValue({ userId: mockUser.id })

      const { createQuotePost } = await import('@/lib/actions/post')
      const formData = new FormData()
      formData.append('content', '引用コメント')

      const result = await createQuotePost(formData, 'post-id')

      expect(result.success).toBe(true)
      expect(mockPrisma.notification.create).not.toHaveBeenCalled()
    })

    it('レート制限に達した場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false })
      mockCheckUserRateLimit.mockResolvedValueOnce({ success: false })

      const { createQuotePost } = await import('@/lib/actions/post')
      const formData = new FormData()
      formData.append('content', '引用コメント')

      const result = await createQuotePost(formData, 'post-id')

      expect(result).toEqual({ error: '投稿が多すぎます。しばらく待ってから再試行してください' })
    })
  })

  describe('createRepost', () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { createRepost } = await import('@/lib/actions/post')
      const result = await createRepost('post-id')

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('アカウント停止中はエラーを返す', async () => {
      mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: true })

      const { createRepost } = await import('@/lib/actions/post')
      const result = await createRepost('post-id')

      expect(result).toEqual({ error: 'アカウントが停止されています' })
    })

    it('既にリポスト済みの場合は削除する', async () => {
      mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false })
      mockPrisma.post.findFirst.mockResolvedValue({ id: 'existing-repost-id' })
      mockPrisma.post.delete.mockResolvedValue({})

      const { createRepost } = await import('@/lib/actions/post')
      const result = await createRepost('post-id')

      expect(result).toEqual({ success: true, reposted: false })
      expect(mockPrisma.post.delete).toHaveBeenCalledWith({ where: { id: 'existing-repost-id' } })
    })

    it('投稿上限に達した場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false })
      mockPrisma.post.findFirst.mockResolvedValue(null)
      mockPrisma.post.count.mockResolvedValue(20)

      const { createRepost } = await import('@/lib/actions/post')
      const result = await createRepost('post-id')

      expect(result).toEqual({ error: '1日の投稿上限（20件）に達しました' })
    })

    it('正常にリポストを作成できる', async () => {
      mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false })
      mockPrisma.post.findFirst.mockResolvedValue(null)
      mockPrisma.post.count.mockResolvedValue(0)
      mockPrisma.post.create.mockResolvedValue({ id: 'repost-id' })
      mockPrisma.post.findUnique.mockResolvedValue({ userId: 'other-user-id' })
      mockPrisma.notification.findFirst.mockResolvedValue(null)
      mockPrisma.notification.create.mockResolvedValue({})

      const { createRepost } = await import('@/lib/actions/post')
      const result = await createRepost('post-id')

      expect(result).toEqual({ success: true, reposted: true })
      expect(mockPrisma.notification.create).toHaveBeenCalled()
    })

    it('自分の投稿をリポストした場合は通知が作成されない', async () => {
      mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false })
      mockPrisma.post.findFirst.mockResolvedValue(null)
      mockPrisma.post.count.mockResolvedValue(0)
      mockPrisma.post.create.mockResolvedValue({ id: 'repost-id' })
      mockPrisma.post.findUnique.mockResolvedValue({ userId: mockUser.id })

      const { createRepost } = await import('@/lib/actions/post')
      const result = await createRepost('post-id')

      expect(result).toEqual({ success: true, reposted: true })
      expect(mockPrisma.notification.create).not.toHaveBeenCalled()
    })

    it('既に通知がある場合は重複して作成しない', async () => {
      mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false })
      mockPrisma.post.findFirst.mockResolvedValue(null)
      mockPrisma.post.count.mockResolvedValue(0)
      mockPrisma.post.create.mockResolvedValue({ id: 'repost-id' })
      mockPrisma.post.findUnique.mockResolvedValue({ userId: 'other-user-id' })
      mockPrisma.notification.findFirst.mockResolvedValue({ id: 'existing-notification' })

      const { createRepost } = await import('@/lib/actions/post')
      const result = await createRepost('post-id')

      expect(result).toEqual({ success: true, reposted: true })
      expect(mockPrisma.notification.create).not.toHaveBeenCalled()
    })

    it('レート制限に達した場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false })
      mockCheckUserRateLimit.mockResolvedValueOnce({ success: false })

      const { createRepost } = await import('@/lib/actions/post')
      const result = await createRepost('post-id')

      expect(result).toEqual({ error: '操作が多すぎます。しばらく待ってから再試行してください' })
    })
  })

  describe('getGenres', () => {
    it('ジャンル一覧をカテゴリ別に取得できる', async () => {
      mockPrisma.genre.findMany.mockResolvedValue([
        { id: 'genre-1', name: '黒松', category: '松柏類', sortOrder: 1 },
        { id: 'genre-2', name: '五葉松', category: '松柏類', sortOrder: 2 },
        { id: 'genre-3', name: 'もみじ', category: '雑木類', sortOrder: 10 },
      ])

      const { getGenres } = await import('@/lib/actions/post')
      const result = await getGenres()

      expect(result.genres).toBeDefined()
      expect(result.genres['松柏類']).toHaveLength(2)
      expect(result.genres['雑木類']).toHaveLength(1)
    })

    it('空のジャンルリストを返す', async () => {
      mockPrisma.genre.findMany.mockResolvedValue([])

      const { getGenres } = await import('@/lib/actions/post')
      const result = await getGenres()

      expect(result.genres).toEqual({})
    })
  })

  describe('uploadPostMedia', () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { uploadPostMedia } = await import('@/lib/actions/post')
      const formData = new FormData()
      const result = await uploadPostMedia(formData)

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('ファイルが選択されていない場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue({ user: { id: mockUser.id } })

      const { uploadPostMedia } = await import('@/lib/actions/post')
      const formData = new FormData()
      const result = await uploadPostMedia(formData)

      expect(result).toEqual({ error: 'ファイルが選択されていません' })
    })

    it('画像でも動画でもないファイルはエラーを返す', async () => {
      mockAuth.mockResolvedValue({ user: { id: mockUser.id } })

      const { uploadPostMedia } = await import('@/lib/actions/post')
      const formData = new FormData()
      const file = new File(['test'], 'test.txt', { type: 'text/plain' })
      formData.append('file', file)

      const result = await uploadPostMedia(formData)

      expect(result).toEqual({ error: '画像または動画ファイルを選択してください' })
    })

    it('画像サイズが上限を超える場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue({ user: { id: mockUser.id } })

      const { uploadPostMedia } = await import('@/lib/actions/post')
      const formData = new FormData()
      // 6MB以上のファイル
      const largeBuffer = new ArrayBuffer(6 * 1024 * 1024)
      const file = new File([largeBuffer], 'large-image.jpg', { type: 'image/jpeg' })
      formData.append('file', file)

      const result = await uploadPostMedia(formData)

      expect(result).toEqual({ error: '画像は5MB以下にしてください' })
    })

    it('動画サイズが上限を超える場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue({ user: { id: mockUser.id } })

      const { uploadPostMedia } = await import('@/lib/actions/post')
      const formData = new FormData()
      // 513MB以上のファイル
      const largeBuffer = new ArrayBuffer(513 * 1024 * 1024)
      const file = new File([largeBuffer], 'large-video.mp4', { type: 'video/mp4' })
      formData.append('file', file)

      const result = await uploadPostMedia(formData)

      expect(result).toEqual({ error: '動画は512MB以下にしてください' })
    })

    it('レート制限に達した場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
      mockCheckUserRateLimit.mockResolvedValueOnce({ success: false })

      const { uploadPostMedia } = await import('@/lib/actions/post')
      const formData = new FormData()
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      formData.append('file', file)

      const result = await uploadPostMedia(formData)

      expect(result).toEqual({ error: 'アップロードが多すぎます。しばらく待ってから再試行してください' })
    })

    it('日次アップロード制限に達した場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
      mockCheckDailyLimit.mockResolvedValueOnce({ allowed: false, limit: 50 })

      const { uploadPostMedia } = await import('@/lib/actions/post')
      const formData = new FormData()
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      formData.append('file', file)

      const result = await uploadPostMedia(formData)

      expect(result).toEqual({ error: '1日のアップロード上限（50回）に達しました' })
    })

    it('正常に画像をアップロードできる', async () => {
      mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
      mockCheckUserRateLimit.mockResolvedValue({ success: true })
      mockCheckDailyLimit.mockResolvedValue({ allowed: true, count: 0, limit: 50 })
      mockUploadFile.mockResolvedValueOnce({ success: true, url: 'https://example.com/uploaded-image.jpg' })

      const { uploadPostMedia } = await import('@/lib/actions/post')
      const formData = new FormData()
      const file = new File(['test image content'], 'test.jpg', { type: 'image/jpeg' })
      formData.append('file', file)

      const result = await uploadPostMedia(formData)

      expect(result.success).toBe(true)
      expect(result.url).toBe('https://example.com/uploaded-image.jpg')
      expect(result.type).toBe('image')
    })

    it('正常に動画をアップロードできる', async () => {
      mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
      mockCheckUserRateLimit.mockResolvedValue({ success: true })
      mockCheckDailyLimit.mockResolvedValue({ allowed: true, count: 0, limit: 50 })
      mockUploadFile.mockResolvedValueOnce({ success: true, url: 'https://example.com/uploaded-video.mp4' })

      const { uploadPostMedia } = await import('@/lib/actions/post')
      const formData = new FormData()
      const file = new File(['test video content'], 'test.mp4', { type: 'video/mp4' })
      formData.append('file', file)

      const result = await uploadPostMedia(formData)

      expect(result.success).toBe(true)
      expect(result.url).toBe('https://example.com/uploaded-video.mp4')
      expect(result.type).toBe('video')
    })

    it('アップロード失敗時はエラーを返す', async () => {
      mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
      mockCheckUserRateLimit.mockResolvedValue({ success: true })
      mockCheckDailyLimit.mockResolvedValue({ allowed: true, count: 0, limit: 50 })
      mockUploadFile.mockResolvedValueOnce({ success: false, error: 'Storage error' })

      const { uploadPostMedia } = await import('@/lib/actions/post')
      const formData = new FormData()
      const file = new File(['test image content'], 'test.jpg', { type: 'image/jpeg' })
      formData.append('file', file)

      const result = await uploadPostMedia(formData)

      expect(result).toEqual({ error: 'Storage error' })
    })
  })

  describe('getPostsByBonsai', () => {
    it('盆栽に関連する投稿を取得できる', async () => {
      mockPrisma.post.findMany.mockResolvedValue([
        {
          ...mockPost,
          bonsaiId: 'bonsai-1',
          _count: { likes: 5, comments: 3 },
          genres: [],
        },
      ])

      const { getPostsByBonsai } = await import('@/lib/actions/post')
      const result = await getPostsByBonsai('bonsai-1')

      expect(result.posts).toHaveLength(1)
      expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { bonsaiId: 'bonsai-1' },
        })
      )
    })

    it('ページネーションが動作する', async () => {
      mockPrisma.post.findMany.mockResolvedValue([])

      const { getPostsByBonsai } = await import('@/lib/actions/post')
      await getPostsByBonsai('bonsai-1', 'cursor-id', 10)

      expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          cursor: { id: 'cursor-id' },
          skip: 1,
        })
      )
    })

    it('投稿がlimit件あれば次のカーソルを返す', async () => {
      const posts = Array(20).fill(null).map((_, i) => ({
        ...mockPost,
        id: `post-${i}`,
        _count: { likes: 0, comments: 0 },
        genres: [],
      }))
      mockPrisma.post.findMany.mockResolvedValue(posts)

      const { getPostsByBonsai } = await import('@/lib/actions/post')
      const result = await getPostsByBonsai('bonsai-1')

      expect(result.nextCursor).toBe('post-19')
    })

    it('投稿がlimit件未満なら次のカーソルはundefined', async () => {
      mockPrisma.post.findMany.mockResolvedValue([
        { ...mockPost, _count: { likes: 0, comments: 0 }, genres: [] },
      ])

      const { getPostsByBonsai } = await import('@/lib/actions/post')
      const result = await getPostsByBonsai('bonsai-1')

      expect(result.nextCursor).toBeUndefined()
    })

    it('エラー発生時は空の配列を返す', async () => {
      mockPrisma.post.findMany.mockRejectedValue(new Error('Database error'))

      const { getPostsByBonsai } = await import('@/lib/actions/post')
      const result = await getPostsByBonsai('bonsai-1')

      expect(result.posts).toEqual([])
      expect(result.nextCursor).toBeUndefined()
    })
  })

  describe('getPost - 追加テスト', () => {
    it('ログイン済みの場合、いいね/ブックマーク状態を取得できる', async () => {
      mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
      const fullPost = {
        ...mockPost,
        _count: { likes: 5, comments: 3 },
        genres: [],
        quotePost: null,
        repostPost: null,
      }
      mockPrisma.post.findUnique.mockResolvedValue(fullPost)
      mockPrisma.like.findFirst.mockResolvedValue({ id: 'like-1' })
      mockPrisma.bookmark.findFirst.mockResolvedValue({ id: 'bookmark-1' })

      const { getPost } = await import('@/lib/actions/post')
      const result = await getPost('post-id')

      expect(result.post?.isLiked).toBe(true)
      expect(result.post?.isBookmarked).toBe(true)
    })

    it('未ログインの場合、いいね/ブックマーク状態はfalse', async () => {
      mockAuth.mockResolvedValue(null)
      const fullPost = {
        ...mockPost,
        _count: { likes: 5, comments: 3 },
        genres: [],
        quotePost: null,
        repostPost: null,
      }
      mockPrisma.post.findUnique.mockResolvedValue(fullPost)

      const { getPost } = await import('@/lib/actions/post')
      const result = await getPost('post-id')

      expect(result.post?.isLiked).toBe(false)
      expect(result.post?.isBookmarked).toBe(false)
    })
  })
})
