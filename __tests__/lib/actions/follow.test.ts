/**
 * @jest-environment node
 */

import { createMockPrismaClient, mockUser } from '../../utils/test-utils'

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

describe('Follow Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAuth.mockResolvedValue({
      user: { id: mockUser.id },
    })
  })

  describe('toggleFollow', () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { toggleFollow } = await import('@/lib/actions/follow')
      const result = await toggleFollow('target-user-id')

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('自分自身はフォローできない', async () => {
      const { toggleFollow } = await import('@/lib/actions/follow')
      const result = await toggleFollow(mockUser.id)

      expect(result).toEqual({ error: '自分自身をフォローすることはできません' })
    })

    it('フォローしていない場合は追加する', async () => {
      mockPrisma.follow.findUnique.mockResolvedValue(null)
      // 公開アカウントのユーザーを返す
      mockPrisma.user.findUnique.mockResolvedValue({ isPublic: true })
      mockPrisma.follow.create.mockResolvedValue({
        followerId: mockUser.id,
        followingId: 'target-user-id',
      })
      mockPrisma.notification.create.mockResolvedValue({})

      const { toggleFollow } = await import('@/lib/actions/follow')
      const result = await toggleFollow('target-user-id')

      expect(result).toEqual({ success: true, following: true })
      expect(mockPrisma.follow.create).toHaveBeenCalled()
      expect(mockPrisma.notification.create).toHaveBeenCalled()
    })

    it('非公開アカウントへのフォローはエラーを返す', async () => {
      mockPrisma.follow.findUnique.mockResolvedValue(null)
      // 非公開アカウントのユーザーを返す
      mockPrisma.user.findUnique.mockResolvedValue({ isPublic: false })

      const { toggleFollow } = await import('@/lib/actions/follow')
      const result = await toggleFollow('target-user-id')

      expect(result).toEqual({
        error: 'このユーザーは非公開アカウントです。フォローリクエストを送信してください',
        requiresRequest: true,
      })
      expect(mockPrisma.follow.create).not.toHaveBeenCalled()
    })

    it('存在しないユーザーへのフォローはエラーを返す', async () => {
      mockPrisma.follow.findUnique.mockResolvedValue(null)
      mockPrisma.user.findUnique.mockResolvedValue(null)

      const { toggleFollow } = await import('@/lib/actions/follow')
      const result = await toggleFollow('non-existent-user')

      expect(result).toEqual({ error: 'ユーザーが見つかりません' })
    })

    it('フォロー済みの場合は解除する', async () => {
      mockPrisma.follow.findUnique.mockResolvedValue({
        followerId: mockUser.id,
        followingId: 'target-user-id',
      })
      mockPrisma.follow.delete.mockResolvedValue({})

      const { toggleFollow } = await import('@/lib/actions/follow')
      const result = await toggleFollow('target-user-id')

      expect(result).toEqual({ success: true, following: false })
      expect(mockPrisma.follow.delete).toHaveBeenCalled()
    })
  })

  describe('getFollowers', () => {
    it('フォロワー一覧を取得できる', async () => {
      const mockFollowers = [
        {
          follower: {
            id: 'follower-1',
            nickname: 'Follower 1',
            avatarUrl: '/avatar1.jpg',
            bio: 'Bio 1',
          },
        },
      ]
      mockPrisma.follow.findMany.mockResolvedValue(mockFollowers)

      const { getFollowers } = await import('@/lib/actions/follow')
      const result = await getFollowers('target-user-id')

      expect(result.users).toHaveLength(1)
      expect(result.users[0].id).toBe('follower-1')
    })
  })

  describe('getFollowing', () => {
    it('フォロー中一覧を取得できる', async () => {
      const mockFollowing = [
        {
          following: {
            id: 'following-1',
            nickname: 'Following 1',
            avatarUrl: '/avatar1.jpg',
            bio: 'Bio 1',
          },
        },
      ]
      mockPrisma.follow.findMany.mockResolvedValue(mockFollowing)

      const { getFollowing } = await import('@/lib/actions/follow')
      const result = await getFollowing('target-user-id')

      expect(result.users).toHaveLength(1)
      expect(result.users[0].id).toBe('following-1')
    })
  })

  describe('getFollowStatus', () => {
    it('フォロー状態を取得できる', async () => {
      mockPrisma.follow.findUnique.mockResolvedValue({
        followerId: mockUser.id,
        followingId: 'target-user-id',
      })

      const { getFollowStatus } = await import('@/lib/actions/follow')
      const result = await getFollowStatus('target-user-id')

      expect(result.following).toBe(true)
    })

    it('フォローしていない場合はfalseを返す', async () => {
      mockPrisma.follow.findUnique.mockResolvedValue(null)

      const { getFollowStatus } = await import('@/lib/actions/follow')
      const result = await getFollowStatus('target-user-id')

      expect(result.following).toBe(false)
    })

    it('未認証の場合はfalseを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { getFollowStatus } = await import('@/lib/actions/follow')
      const result = await getFollowStatus('target-user-id')

      expect(result.following).toBe(false)
    })
  })
})
