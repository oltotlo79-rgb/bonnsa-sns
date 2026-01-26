/**
 * @jest-environment node
 */

// グローバルモックを無効化してから独自のモックを設定
jest.unmock('@/lib/actions/follow-request')

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

// rate-limitモック
const mockCheckUserRateLimit = jest.fn()
jest.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: (...args: unknown[]) => mockCheckUserRateLimit(...args),
}))

// analyticsモック
jest.mock('@/lib/actions/analytics', () => ({
  recordNewFollower: jest.fn().mockResolvedValue(undefined),
}))

describe('Follow Request Actions', () => {
  const targetUserId = 'target-user-id'
  const requestId = 'request-id'

  beforeEach(() => {
    jest.clearAllMocks()
    mockAuth.mockResolvedValue({
      user: { id: mockUser.id },
    })
    mockCheckUserRateLimit.mockResolvedValue({ success: true })
  })

  describe('sendFollowRequest', () => {
    it('認証が必要', async () => {
      mockAuth.mockResolvedValue(null)

      const { sendFollowRequest } = await import('@/lib/actions/follow-request')
      const result = await sendFollowRequest(targetUserId)

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('自分自身へのリクエストは拒否', async () => {
      const { sendFollowRequest } = await import('@/lib/actions/follow-request')
      const result = await sendFollowRequest(mockUser.id)

      expect(result).toEqual({ error: '自分自身にフォローリクエストを送ることはできません' })
    })

    it('ユーザーが見つからない場合はエラー', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)

      const { sendFollowRequest } = await import('@/lib/actions/follow-request')
      const result = await sendFollowRequest(targetUserId)

      expect(result).toEqual({ error: 'ユーザーが見つかりません' })
    })

    it('公開アカウントへのリクエストはエラー', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: targetUserId,
        isPublic: true,
        nickname: 'Target User',
      })

      const { sendFollowRequest } = await import('@/lib/actions/follow-request')
      const result = await sendFollowRequest(targetUserId)

      expect(result).toEqual({ error: 'このユーザーは公開アカウントです。直接フォローしてください' })
    })

    it('ブロックされている場合はエラー', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: targetUserId,
        isPublic: false,
        nickname: 'Target User',
      })
      mockPrisma.block.findUnique.mockResolvedValue({ id: 'block-id' })

      const { sendFollowRequest } = await import('@/lib/actions/follow-request')
      const result = await sendFollowRequest(targetUserId)

      expect(result).toEqual({ error: 'フォローリクエストを送信できません' })
    })

    it('既にフォロー中の場合はエラー', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: targetUserId,
        isPublic: false,
        nickname: 'Target User',
      })
      mockPrisma.block.findUnique.mockResolvedValue(null)
      mockPrisma.follow.findUnique.mockResolvedValue({ id: 'follow-id' })

      const { sendFollowRequest } = await import('@/lib/actions/follow-request')
      const result = await sendFollowRequest(targetUserId)

      expect(result).toEqual({ error: '既にフォロー中です' })
    })

    it('既にリクエスト送信済み（pending）の場合はエラー', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: targetUserId,
        isPublic: false,
        nickname: 'Target User',
      })
      mockPrisma.block.findUnique.mockResolvedValue(null)
      mockPrisma.follow.findUnique.mockResolvedValue(null)
      mockPrisma.followRequest.findUnique.mockResolvedValue({
        id: requestId,
        status: 'pending',
      })

      const { sendFollowRequest } = await import('@/lib/actions/follow-request')
      const result = await sendFollowRequest(targetUserId)

      expect(result).toEqual({ error: '既にフォローリクエストを送信済みです' })
    })

    it('拒否されたリクエストは再送信可能', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: targetUserId,
        isPublic: false,
        nickname: 'Target User',
      })
      mockPrisma.block.findUnique.mockResolvedValue(null)
      mockPrisma.follow.findUnique.mockResolvedValue(null)
      mockPrisma.followRequest.findUnique.mockResolvedValue({
        id: requestId,
        status: 'rejected',
      })
      mockPrisma.followRequest.delete.mockResolvedValue({})
      mockPrisma.followRequest.create.mockResolvedValue({})
      mockPrisma.notification.create.mockResolvedValue({})

      const { sendFollowRequest } = await import('@/lib/actions/follow-request')
      const result = await sendFollowRequest(targetUserId)

      expect(result).toEqual({ success: true, status: 'pending' })
      expect(mockPrisma.followRequest.delete).toHaveBeenCalled()
      expect(mockPrisma.followRequest.create).toHaveBeenCalled()
    })

    it('フォローリクエストを正常に送信できる', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: targetUserId,
        isPublic: false,
        nickname: 'Target User',
      })
      mockPrisma.block.findUnique.mockResolvedValue(null)
      mockPrisma.follow.findUnique.mockResolvedValue(null)
      mockPrisma.followRequest.findUnique.mockResolvedValue(null)
      mockPrisma.followRequest.create.mockResolvedValue({})
      mockPrisma.notification.create.mockResolvedValue({})

      const { sendFollowRequest } = await import('@/lib/actions/follow-request')
      const result = await sendFollowRequest(targetUserId)

      expect(result).toEqual({ success: true, status: 'pending' })
      expect(mockPrisma.followRequest.create).toHaveBeenCalledWith({
        data: {
          requesterId: mockUser.id,
          targetId: targetUserId,
          status: 'pending',
        },
      })
      expect(mockPrisma.notification.create).toHaveBeenCalled()
    })

    it('レート制限に達した場合はエラー', async () => {
      mockCheckUserRateLimit.mockResolvedValueOnce({ success: false })

      mockPrisma.user.findUnique.mockResolvedValue({
        id: targetUserId,
        isPublic: false,
        nickname: 'Target User',
      })

      const { sendFollowRequest } = await import('@/lib/actions/follow-request')
      const result = await sendFollowRequest(targetUserId)

      expect(result).toEqual({ error: '操作が多すぎます。しばらく待ってから再試行してください' })
    })
  })

  describe('approveFollowRequest', () => {
    it('認証が必要', async () => {
      mockAuth.mockResolvedValue(null)

      const { approveFollowRequest } = await import('@/lib/actions/follow-request')
      const result = await approveFollowRequest(requestId)

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('リクエストが見つからない場合はエラー', async () => {
      mockPrisma.followRequest.findUnique.mockResolvedValue(null)

      const { approveFollowRequest } = await import('@/lib/actions/follow-request')
      const result = await approveFollowRequest(requestId)

      expect(result).toEqual({ error: 'フォローリクエストが見つかりません' })
    })

    it('自分宛てでないリクエストは承認できない', async () => {
      mockPrisma.followRequest.findUnique.mockResolvedValue({
        id: requestId,
        requesterId: 'other-user',
        targetId: 'another-user',
        status: 'pending',
        requester: { id: 'other-user', nickname: 'Other User' },
      })

      const { approveFollowRequest } = await import('@/lib/actions/follow-request')
      const result = await approveFollowRequest(requestId)

      expect(result).toEqual({ error: 'このリクエストを承認する権限がありません' })
    })

    it('既に処理済みのリクエストはエラー', async () => {
      mockPrisma.followRequest.findUnique.mockResolvedValue({
        id: requestId,
        requesterId: 'other-user',
        targetId: mockUser.id,
        status: 'approved',
        requester: { id: 'other-user', nickname: 'Other User' },
      })

      const { approveFollowRequest } = await import('@/lib/actions/follow-request')
      const result = await approveFollowRequest(requestId)

      expect(result).toEqual({ error: 'このリクエストは既に処理されています' })
    })

    it('リクエストを正常に承認できる', async () => {
      mockPrisma.followRequest.findUnique.mockResolvedValue({
        id: requestId,
        requesterId: 'other-user',
        targetId: mockUser.id,
        status: 'pending',
        requester: { id: 'other-user', nickname: 'Other User' },
      })
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          follow: { create: jest.fn().mockResolvedValue({}) },
          followRequest: { delete: jest.fn().mockResolvedValue({}) },
          notification: { create: jest.fn().mockResolvedValue({}) },
        }
        return callback(tx)
      })

      const { approveFollowRequest } = await import('@/lib/actions/follow-request')
      const result = await approveFollowRequest(requestId)

      expect(result).toEqual({ success: true, status: 'approved' })
    })
  })

  describe('rejectFollowRequest', () => {
    it('認証が必要', async () => {
      mockAuth.mockResolvedValue(null)

      const { rejectFollowRequest } = await import('@/lib/actions/follow-request')
      const result = await rejectFollowRequest(requestId)

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('リクエストが見つからない場合はエラー', async () => {
      mockPrisma.followRequest.findUnique.mockResolvedValue(null)

      const { rejectFollowRequest } = await import('@/lib/actions/follow-request')
      const result = await rejectFollowRequest(requestId)

      expect(result).toEqual({ error: 'フォローリクエストが見つかりません' })
    })

    it('自分宛てでないリクエストは拒否できない', async () => {
      mockPrisma.followRequest.findUnique.mockResolvedValue({
        id: requestId,
        requesterId: 'other-user',
        targetId: 'another-user',
        status: 'pending',
      })

      const { rejectFollowRequest } = await import('@/lib/actions/follow-request')
      const result = await rejectFollowRequest(requestId)

      expect(result).toEqual({ error: 'このリクエストを拒否する権限がありません' })
    })

    it('リクエストを正常に拒否できる', async () => {
      mockPrisma.followRequest.findUnique.mockResolvedValue({
        id: requestId,
        requesterId: 'other-user',
        targetId: mockUser.id,
        status: 'pending',
      })
      mockPrisma.followRequest.delete.mockResolvedValue({})

      const { rejectFollowRequest } = await import('@/lib/actions/follow-request')
      const result = await rejectFollowRequest(requestId)

      expect(result).toEqual({ success: true, status: 'rejected' })
      expect(mockPrisma.followRequest.delete).toHaveBeenCalled()
    })
  })

  describe('cancelFollowRequest', () => {
    it('認証が必要', async () => {
      mockAuth.mockResolvedValue(null)

      const { cancelFollowRequest } = await import('@/lib/actions/follow-request')
      const result = await cancelFollowRequest(targetUserId)

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('リクエストが見つからない場合はエラー', async () => {
      mockPrisma.followRequest.findUnique.mockResolvedValue(null)

      const { cancelFollowRequest } = await import('@/lib/actions/follow-request')
      const result = await cancelFollowRequest(targetUserId)

      expect(result).toEqual({ error: 'フォローリクエストが見つかりません' })
    })

    it('リクエストを正常にキャンセルできる', async () => {
      mockPrisma.followRequest.findUnique.mockResolvedValue({
        id: requestId,
        requesterId: mockUser.id,
        targetId: targetUserId,
      })
      mockPrisma.followRequest.delete.mockResolvedValue({})

      const { cancelFollowRequest } = await import('@/lib/actions/follow-request')
      const result = await cancelFollowRequest(targetUserId)

      expect(result).toEqual({ success: true })
      expect(mockPrisma.followRequest.delete).toHaveBeenCalled()
    })
  })

  describe('getFollowRequestStatus', () => {
    it('未認証の場合はリクエストなしを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { getFollowRequestStatus } = await import('@/lib/actions/follow-request')
      const result = await getFollowRequestStatus(targetUserId)

      expect(result).toEqual({ hasRequest: false, status: null })
    })

    it('リクエストがない場合はhasRequest: falseを返す', async () => {
      mockPrisma.followRequest.findUnique.mockResolvedValue(null)

      const { getFollowRequestStatus } = await import('@/lib/actions/follow-request')
      const result = await getFollowRequestStatus(targetUserId)

      expect(result).toEqual({ hasRequest: false, status: null })
    })

    it('リクエストがある場合はステータスを返す', async () => {
      mockPrisma.followRequest.findUnique.mockResolvedValue({
        status: 'pending',
      })

      const { getFollowRequestStatus } = await import('@/lib/actions/follow-request')
      const result = await getFollowRequestStatus(targetUserId)

      expect(result).toEqual({ hasRequest: true, status: 'pending' })
    })
  })

  describe('getReceivedFollowRequests', () => {
    it('未認証の場合は空配列を返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { getReceivedFollowRequests } = await import('@/lib/actions/follow-request')
      const result = await getReceivedFollowRequests()

      expect(result).toEqual({ requests: [], nextCursor: undefined })
    })

    it('受信したリクエスト一覧を返す', async () => {
      const mockRequests = [
        {
          id: 'request-1',
          requesterId: 'user-1',
          targetId: mockUser.id,
          status: 'pending',
          createdAt: new Date(),
          requester: {
            id: 'user-1',
            nickname: 'User 1',
            avatarUrl: null,
            bio: null,
          },
        },
      ]
      mockPrisma.followRequest.findMany.mockResolvedValue(mockRequests)

      const { getReceivedFollowRequests } = await import('@/lib/actions/follow-request')
      const result = await getReceivedFollowRequests()

      expect(result.requests).toHaveLength(1)
      expect(result.requests[0].user.nickname).toBe('User 1')
    })

    it('カーソルベースのページネーションをサポート', async () => {
      mockPrisma.followRequest.findMany.mockResolvedValue([])

      const { getReceivedFollowRequests } = await import('@/lib/actions/follow-request')
      await getReceivedFollowRequests('cursor-id', 10)

      expect(mockPrisma.followRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: 'cursor-id' },
          skip: 1,
          take: 10,
        })
      )
    })
  })

  describe('getSentFollowRequests', () => {
    it('未認証の場合は空配列を返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { getSentFollowRequests } = await import('@/lib/actions/follow-request')
      const result = await getSentFollowRequests()

      expect(result).toEqual({ requests: [], nextCursor: undefined })
    })

    it('送信したリクエスト一覧を返す', async () => {
      const mockRequests = [
        {
          id: 'request-1',
          requesterId: mockUser.id,
          targetId: 'user-1',
          status: 'pending',
          createdAt: new Date(),
          target: {
            id: 'user-1',
            nickname: 'Target User',
            avatarUrl: null,
            bio: null,
          },
        },
      ]
      mockPrisma.followRequest.findMany.mockResolvedValue(mockRequests)

      const { getSentFollowRequests } = await import('@/lib/actions/follow-request')
      const result = await getSentFollowRequests()

      expect(result.requests).toHaveLength(1)
      expect(result.requests[0].user.nickname).toBe('Target User')
    })
  })

  describe('getPendingFollowRequestCount', () => {
    it('未認証の場合は0を返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { getPendingFollowRequestCount } = await import('@/lib/actions/follow-request')
      const result = await getPendingFollowRequestCount()

      expect(result).toEqual({ count: 0 })
    })

    it('未処理リクエスト数を返す', async () => {
      mockPrisma.followRequest.count.mockResolvedValue(5)

      const { getPendingFollowRequestCount } = await import('@/lib/actions/follow-request')
      const result = await getPendingFollowRequestCount()

      expect(result).toEqual({ count: 5 })
    })
  })
})
