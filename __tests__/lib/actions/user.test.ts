/**
 * @jest-environment node
 */
import { createMockPrismaClient, mockUser, createMockFormData } from '../../utils/test-utils'

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

// ストレージモック
const mockUploadFile = jest.fn()
jest.mock('@/lib/storage', () => ({
  uploadFile: mockUploadFile,
}))

// ファイル検証モック
jest.mock('@/lib/file-validation', () => ({
  validateImageFile: jest.fn().mockReturnValue({ valid: true, detectedType: 'image/jpeg' }),
  generateSafeFileName: jest.fn().mockReturnValue('mock-uuid.jpg'),
}))

describe('User Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
  })

  // ============================================================
  // getUser
  // ============================================================

  describe('getUser', () => {
    it('ユーザー情報を取得できる', async () => {
      const userWithCount = {
        ...mockUser,
        _count: {
          posts: 10,
          followers: 50,
          following: 30,
        },
      }
      mockPrisma.user.findUnique.mockResolvedValueOnce(userWithCount)

      const { getUser } = await import('@/lib/actions/user')
      const result = await getUser(mockUser.id)

      expect(result.user).toBeDefined()
      expect(result.user?.postsCount).toBe(10)
      expect(result.user?.followersCount).toBe(50)
      expect(result.user?.followingCount).toBe(30)
    })

    it('ユーザーが見つからない場合、エラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null)

      const { getUser } = await import('@/lib/actions/user')
      const result = await getUser('nonexistent-id')

      expect(result).toEqual({ error: 'ユーザーが見つかりません' })
    })
  })

  // ============================================================
  // getCurrentUser
  // ============================================================

  describe('getCurrentUser', () => {
    it('現在のユーザー情報を取得できる', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockUser)

      const { getCurrentUser } = await import('@/lib/actions/user')
      const result = await getCurrentUser()

      expect(result.user).toEqual(mockUser)
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { getCurrentUser } = await import('@/lib/actions/user')
      const result = await getCurrentUser()

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('ユーザーが見つからない場合、エラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null)

      const { getCurrentUser } = await import('@/lib/actions/user')
      const result = await getCurrentUser()

      expect(result).toEqual({ error: 'ユーザー情報の取得に失敗しました' })
    })
  })

  // ============================================================
  // updateProfile
  // ============================================================

  describe('updateProfile', () => {
    it('プロフィールを更新できる', async () => {
      mockPrisma.user.update.mockResolvedValueOnce({ ...mockUser, nickname: '新しいニックネーム' })

      const { updateProfile } = await import('@/lib/actions/user')
      const formData = createMockFormData({
        nickname: '新しいニックネーム',
        bio: '新しい自己紹介',
        location: '東京都',
      })
      const result = await updateProfile(formData)

      expect(result).toEqual({ success: true })
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: expect.objectContaining({
          nickname: '新しいニックネーム',
          bio: '新しい自己紹介',
          location: '東京都',
        }),
      })
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { updateProfile } = await import('@/lib/actions/user')
      const formData = createMockFormData({ nickname: 'テスト' })
      const result = await updateProfile(formData)

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('ニックネームが空の場合、エラーを返す', async () => {
      const { updateProfile } = await import('@/lib/actions/user')
      const formData = createMockFormData({ nickname: '' })
      const result = await updateProfile(formData)

      expect(result).toEqual({ error: 'ニックネームは必須です' })
    })

    it('ニックネームが50文字を超える場合、エラーを返す', async () => {
      const { updateProfile } = await import('@/lib/actions/user')
      const formData = createMockFormData({ nickname: 'a'.repeat(51) })
      const result = await updateProfile(formData)

      expect(result).toEqual({ error: 'ニックネームは50文字以内で入力してください' })
    })

    it('自己紹介が200文字を超える場合、エラーを返す', async () => {
      const { updateProfile } = await import('@/lib/actions/user')
      const formData = createMockFormData({
        nickname: 'テスト',
        bio: 'a'.repeat(201),
      })
      const result = await updateProfile(formData)

      expect(result).toEqual({ error: '自己紹介は200文字以内で入力してください' })
    })
  })

  // ============================================================
  // updatePrivacy
  // ============================================================

  describe('updatePrivacy', () => {
    it('プライバシー設定を更新できる', async () => {
      mockPrisma.user.update.mockResolvedValueOnce({ ...mockUser, isPublic: false })

      const { updatePrivacy } = await import('@/lib/actions/user')
      const result = await updatePrivacy(false)

      expect(result).toEqual({ success: true })
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { isPublic: false },
      })
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { updatePrivacy } = await import('@/lib/actions/user')
      const result = await updatePrivacy(false)

      expect(result).toEqual({ error: '認証が必要です' })
    })
  })

  // ============================================================
  // uploadAvatar
  // ============================================================

  describe('uploadAvatar', () => {
    it('アバターをアップロードできる', async () => {
      mockUploadFile.mockResolvedValueOnce({ success: true, url: 'https://example.com/avatar.jpg' })
      mockPrisma.user.update.mockResolvedValueOnce({ ...mockUser, avatarUrl: 'https://example.com/avatar.jpg' })

      const { uploadAvatar } = await import('@/lib/actions/user')

      // File オブジェクトをモック
      const mockFile = new File(['test'], 'avatar.jpg', { type: 'image/jpeg' })
      const formData = new FormData()
      formData.append('file', mockFile)

      const result = await uploadAvatar(formData)

      expect(result).toEqual({ success: true, url: 'https://example.com/avatar.jpg' })
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { uploadAvatar } = await import('@/lib/actions/user')
      const formData = new FormData()
      const result = await uploadAvatar(formData)

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('ファイルがない場合、エラーを返す', async () => {
      const { uploadAvatar } = await import('@/lib/actions/user')
      const formData = new FormData()
      const result = await uploadAvatar(formData)

      expect(result).toEqual({ error: 'ファイルが選択されていません' })
    })

    it('ファイルサイズが4MBを超える場合、エラーを返す', async () => {
      const { uploadAvatar } = await import('@/lib/actions/user')

      // 5MBのファイルをモック
      const largeContent = new Array(5 * 1024 * 1024).fill('a').join('')
      const mockFile = new File([largeContent], 'large.jpg', { type: 'image/jpeg' })
      const formData = new FormData()
      formData.append('file', mockFile)

      const result = await uploadAvatar(formData)

      expect(result).toEqual({ error: 'ファイルサイズは4MB以下にしてください' })
    })

    it('許可されていないファイル形式の場合、エラーを返す', async () => {
      const { uploadAvatar } = await import('@/lib/actions/user')

      const mockFile = new File(['test'], 'avatar.gif', { type: 'image/gif' })
      const formData = new FormData()
      formData.append('file', mockFile)

      const result = await uploadAvatar(formData)

      expect(result).toEqual({ error: 'JPEG、PNG、WebP形式のみ対応しています' })
    })
  })

  // ============================================================
  // uploadHeader
  // ============================================================

  describe('uploadHeader', () => {
    it('ヘッダー画像をアップロードできる', async () => {
      mockUploadFile.mockResolvedValueOnce({ success: true, url: 'https://example.com/header.jpg' })
      mockPrisma.user.update.mockResolvedValueOnce({ ...mockUser, headerUrl: 'https://example.com/header.jpg' })

      const { uploadHeader } = await import('@/lib/actions/user')

      const mockFile = new File(['test'], 'header.jpg', { type: 'image/jpeg' })
      const formData = new FormData()
      formData.append('file', mockFile)

      const result = await uploadHeader(formData)

      expect(result).toEqual({ success: true, url: 'https://example.com/header.jpg' })
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { uploadHeader } = await import('@/lib/actions/user')
      const formData = new FormData()
      const result = await uploadHeader(formData)

      expect(result).toEqual({ error: '認証が必要です' })
    })
  })

  // ============================================================
  // deleteAccount
  // ============================================================

  describe('deleteAccount', () => {
    it('アカウントを削除できる', async () => {
      mockPrisma.$transaction.mockImplementationOnce(async (callback) => {
        const tx = {
          userAnalytics: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
          message: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
          conversationParticipant: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
          notification: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
          user: { delete: jest.fn().mockResolvedValue(mockUser) },
        }
        return callback(tx)
      })

      const { deleteAccount } = await import('@/lib/actions/user')
      const result = await deleteAccount()

      expect(result).toEqual({ success: true })
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { deleteAccount } = await import('@/lib/actions/user')
      const result = await deleteAccount()

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('削除に失敗した場合、エラーを返す', async () => {
      mockPrisma.$transaction.mockRejectedValueOnce(new Error('Database error'))

      const { deleteAccount } = await import('@/lib/actions/user')
      const result = await deleteAccount()

      expect(result).toEqual({ error: 'アカウントの削除に失敗しました' })
    })
  })

  // ============================================================
  // getFollowers
  // ============================================================

  describe('getFollowers', () => {
    it('フォロワー一覧を取得できる', async () => {
      const mockFollowers = [
        {
          followerId: 'follower-1',
          followingId: mockUser.id,
          follower: {
            id: 'follower-1',
            nickname: 'フォロワー1',
            avatarUrl: '/avatar1.jpg',
            bio: '自己紹介1',
          },
        },
        {
          followerId: 'follower-2',
          followingId: mockUser.id,
          follower: {
            id: 'follower-2',
            nickname: 'フォロワー2',
            avatarUrl: '/avatar2.jpg',
            bio: '自己紹介2',
          },
        },
      ]
      mockPrisma.follow.findMany.mockResolvedValueOnce(mockFollowers)

      const { getFollowers } = await import('@/lib/actions/user')
      const result = await getFollowers(mockUser.id)

      expect(result.followers).toHaveLength(2)
      expect(result.followers[0].nickname).toBe('フォロワー1')
    })
  })

  // ============================================================
  // getFollowing
  // ============================================================

  describe('getFollowing', () => {
    it('フォロー中一覧を取得できる', async () => {
      const mockFollowing = [
        {
          followerId: mockUser.id,
          followingId: 'following-1',
          following: {
            id: 'following-1',
            nickname: 'フォロー中1',
            avatarUrl: '/avatar1.jpg',
            bio: '自己紹介1',
          },
        },
        {
          followerId: mockUser.id,
          followingId: 'following-2',
          following: {
            id: 'following-2',
            nickname: 'フォロー中2',
            avatarUrl: '/avatar2.jpg',
            bio: '自己紹介2',
          },
        },
      ]
      mockPrisma.follow.findMany.mockResolvedValueOnce(mockFollowing)

      const { getFollowing } = await import('@/lib/actions/user')
      const result = await getFollowing(mockUser.id)

      expect(result.following).toHaveLength(2)
      expect(result.following[0].nickname).toBe('フォロー中1')
    })
  })
})
