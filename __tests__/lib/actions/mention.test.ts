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

// ロガーモック
jest.mock('@/lib/logger', () => ({
  __esModule: true,
  default: {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}))

describe('Mention Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
  })

  // ============================================================
  // searchMentionUsers
  // ============================================================

  describe('searchMentionUsers', () => {
    it('メンション候補ユーザーを検索できる', async () => {
      const mockFollowing = [{ followingId: 'following-user-1' }]
      const mockUsers = [
        { id: 'following-user-1', nickname: 'bonsai_user1', avatarUrl: '/avatar1.jpg' },
        { id: 'other-user', nickname: 'bonsai_user2', avatarUrl: '/avatar2.jpg' },
      ]

      mockPrisma.follow.findMany.mockResolvedValueOnce(mockFollowing)
      mockPrisma.user.findMany.mockResolvedValueOnce(mockUsers)

      const { searchMentionUsers } = await import('@/lib/actions/mention')
      const result = await searchMentionUsers('bonsai')

      expect(result).toHaveLength(2)
      // フォロー中のユーザーが先に来る
      expect(result[0].id).toBe('following-user-1')
      expect(result[0].isFollowing).toBe(true)
    })

    it('未認証の場合、空配列を返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { searchMentionUsers } = await import('@/lib/actions/mention')
      const result = await searchMentionUsers('bonsai')

      expect(result).toEqual([])
    })

    it('空のクエリの場合、空配列を返す', async () => {
      const { searchMentionUsers } = await import('@/lib/actions/mention')
      const result = await searchMentionUsers('')

      expect(result).toEqual([])
    })

    it('指定した件数で取得できる', async () => {
      mockPrisma.follow.findMany.mockResolvedValueOnce([])
      mockPrisma.user.findMany.mockResolvedValueOnce([
        { id: 'user-1', nickname: 'user1', avatarUrl: null },
        { id: 'user-2', nickname: 'user2', avatarUrl: null },
        { id: 'user-3', nickname: 'user3', avatarUrl: null },
      ])

      const { searchMentionUsers } = await import('@/lib/actions/mention')
      const result = await searchMentionUsers('user', 2)

      expect(result).toHaveLength(2)
    })
  })

  // ============================================================
  // notifyMentionedUsers
  // ============================================================

  describe('notifyMentionedUsers', () => {
    it('メンションされたユーザーに通知を送信する', async () => {
      const mockUsers = [
        { id: 'mentioned-user-1' },
        { id: 'mentioned-user-2' },
      ]
      mockPrisma.user.findMany.mockResolvedValueOnce(mockUsers)
      mockPrisma.notification.createMany.mockResolvedValueOnce({ count: 2 })

      const { notifyMentionedUsers } = await import('@/lib/actions/mention')
      await notifyMentionedUsers(mockPost.id, '@user1 @user2 こんにちは', mockUser.id)

      expect(mockPrisma.notification.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            type: 'mention',
            postId: mockPost.id,
            actorId: mockUser.id,
          }),
        ]),
        skipDuplicates: true,
      })
    })

    it('contentがnullの場合、何もしない', async () => {
      const { notifyMentionedUsers } = await import('@/lib/actions/mention')
      await notifyMentionedUsers(mockPost.id, null, mockUser.id)

      expect(mockPrisma.user.findMany).not.toHaveBeenCalled()
      expect(mockPrisma.notification.createMany).not.toHaveBeenCalled()
    })

    it('メンションがない場合、何もしない', async () => {
      const { notifyMentionedUsers } = await import('@/lib/actions/mention')
      await notifyMentionedUsers(mockPost.id, 'メンションなしの投稿', mockUser.id)

      expect(mockPrisma.user.findMany).not.toHaveBeenCalled()
      expect(mockPrisma.notification.createMany).not.toHaveBeenCalled()
    })

    it('該当ユーザーが見つからない場合、通知を送信しない', async () => {
      mockPrisma.user.findMany.mockResolvedValueOnce([])

      const { notifyMentionedUsers } = await import('@/lib/actions/mention')
      await notifyMentionedUsers(mockPost.id, '@nonexistent_user こんにちは', mockUser.id)

      expect(mockPrisma.notification.createMany).not.toHaveBeenCalled()
    })

    it('エラーが発生しても例外をスローしない', async () => {
      mockPrisma.user.findMany.mockRejectedValueOnce(new Error('Database error'))

      const { notifyMentionedUsers } = await import('@/lib/actions/mention')
      await expect(notifyMentionedUsers(mockPost.id, '@user1', mockUser.id)).resolves.not.toThrow()
    })

    it('重複するメンションは1回だけ通知する', async () => {
      const mockUsers = [{ id: 'mentioned-user-1' }]
      mockPrisma.user.findMany.mockResolvedValueOnce(mockUsers)
      mockPrisma.notification.createMany.mockResolvedValueOnce({ count: 1 })

      const { notifyMentionedUsers } = await import('@/lib/actions/mention')
      await notifyMentionedUsers(mockPost.id, '@user1 @User1 @USER1 こんにちは', mockUser.id)

      // 重複が除去されてuser.findManyが呼ばれる
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            nickname: { in: ['user1'], mode: 'insensitive' },
          }),
        })
      )
    })
  })

  // ============================================================
  // getRecentMentionedUsers
  // ============================================================

  describe('getRecentMentionedUsers', () => {
    it('最近メンションしたユーザーを取得できる', async () => {
      const mockPosts = [
        { content: '@user1 こんにちは' },
        { content: '@user2 @user3 返信' },
      ]
      const mockUsers = [
        { id: 'user-1', nickname: 'user1', avatarUrl: '/avatar1.jpg' },
        { id: 'user-2', nickname: 'user2', avatarUrl: '/avatar2.jpg' },
      ]

      mockPrisma.post.findMany.mockResolvedValueOnce(mockPosts)
      mockPrisma.user.findMany.mockResolvedValueOnce(mockUsers)

      const { getRecentMentionedUsers } = await import('@/lib/actions/mention')
      const result = await getRecentMentionedUsers()

      expect(result).toHaveLength(2)
      expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: mockUser.id, content: { not: null } },
          take: 50,
        })
      )
    })

    it('未認証の場合、空配列を返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { getRecentMentionedUsers } = await import('@/lib/actions/mention')
      const result = await getRecentMentionedUsers()

      expect(result).toEqual([])
    })

    it('メンションがない場合、空配列を返す', async () => {
      mockPrisma.post.findMany.mockResolvedValueOnce([
        { content: 'メンションなし' },
        { content: 'こちらもメンションなし' },
      ])

      const { getRecentMentionedUsers } = await import('@/lib/actions/mention')
      const result = await getRecentMentionedUsers()

      expect(result).toEqual([])
      expect(mockPrisma.user.findMany).not.toHaveBeenCalled()
    })

    it('指定した件数で取得できる', async () => {
      mockPrisma.post.findMany.mockResolvedValueOnce([
        { content: '@user1 @user2 @user3 @user4 @user5 @user6' },
      ])
      mockPrisma.user.findMany.mockResolvedValueOnce([
        { id: 'user-1', nickname: 'user1', avatarUrl: null },
        { id: 'user-2', nickname: 'user2', avatarUrl: null },
        { id: 'user-3', nickname: 'user3', avatarUrl: null },
      ])

      const { getRecentMentionedUsers } = await import('@/lib/actions/mention')
      const result = await getRecentMentionedUsers(3)

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            nickname: { in: ['user1', 'user2', 'user3'], mode: 'insensitive' },
          }),
        })
      )
    })
  })
})
