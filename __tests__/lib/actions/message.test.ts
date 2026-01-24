/**
 * @jest-environment node
 */
import { createMockPrismaClient, mockUser, mockMessage, mockConversation } from '../../utils/test-utils'

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

describe('Message Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
  })

  // ============================================================
  // getOrCreateConversation
  // ============================================================

  describe('getOrCreateConversation', () => {
    it('既存の会話を取得できる', async () => {
      mockPrisma.block.findFirst.mockResolvedValueOnce(null)
      mockPrisma.conversation.findFirst.mockResolvedValueOnce(mockConversation)

      const { getOrCreateConversation } = await import('@/lib/actions/message')
      const result = await getOrCreateConversation('other-user-id')

      expect(result).toEqual({ conversationId: mockConversation.id })
    })

    it('新規会話を作成できる', async () => {
      mockPrisma.block.findFirst.mockResolvedValueOnce(null)
      mockPrisma.conversation.findFirst.mockResolvedValueOnce(null)
      mockPrisma.conversation.create.mockResolvedValueOnce({ id: 'new-conversation-id' })

      const { getOrCreateConversation } = await import('@/lib/actions/message')
      const result = await getOrCreateConversation('other-user-id')

      expect(result).toEqual({ conversationId: 'new-conversation-id' })
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { getOrCreateConversation } = await import('@/lib/actions/message')
      const result = await getOrCreateConversation('other-user-id')

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('自分自身にメッセージを送ろうとした場合、エラーを返す', async () => {
      const { getOrCreateConversation } = await import('@/lib/actions/message')
      const result = await getOrCreateConversation(mockUser.id)

      expect(result).toEqual({ error: '自分自身にメッセージを送ることはできません' })
    })

    it('ブロック関係がある場合、エラーを返す', async () => {
      mockPrisma.block.findFirst.mockResolvedValueOnce({ blockerId: 'other-user-id', blockedId: mockUser.id })

      const { getOrCreateConversation } = await import('@/lib/actions/message')
      const result = await getOrCreateConversation('other-user-id')

      expect(result).toEqual({ error: 'このユーザーにはメッセージを送れません' })
    })
  })

  // ============================================================
  // sendMessage
  // ============================================================

  describe('sendMessage', () => {
    it('メッセージを送信できる', async () => {
      mockPrisma.conversationParticipant.findUnique.mockResolvedValueOnce({
        conversationId: mockConversation.id,
        userId: mockUser.id,
      })
      mockPrisma.message.count.mockResolvedValueOnce(5)
      mockPrisma.conversationParticipant.findFirst.mockResolvedValueOnce({
        conversationId: mockConversation.id,
        userId: 'other-user-id',
      })
      mockPrisma.block.findFirst.mockResolvedValueOnce(null)
      mockPrisma.message.create.mockResolvedValueOnce({
        ...mockMessage,
        sender: { id: mockUser.id, nickname: mockUser.nickname, avatarUrl: mockUser.avatarUrl },
      })
      mockPrisma.conversation.update.mockResolvedValueOnce(mockConversation)
      mockPrisma.notification.create.mockResolvedValueOnce({})

      const { sendMessage } = await import('@/lib/actions/message')
      const result = await sendMessage(mockConversation.id, 'こんにちは！')

      expect(result.success).toBe(true)
      expect(result.message).toBeDefined()
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { sendMessage } = await import('@/lib/actions/message')
      const result = await sendMessage(mockConversation.id, 'テスト')

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('空のメッセージはエラーを返す', async () => {
      const { sendMessage } = await import('@/lib/actions/message')
      const result = await sendMessage(mockConversation.id, '  ')

      expect(result).toEqual({ error: 'メッセージを入力してください' })
    })

    it('1000文字を超えるメッセージはエラーを返す', async () => {
      const { sendMessage } = await import('@/lib/actions/message')
      const result = await sendMessage(mockConversation.id, 'a'.repeat(1001))

      expect(result).toEqual({ error: 'メッセージは1000文字以内で入力してください' })
    })

    it('会話の参加者でない場合、エラーを返す', async () => {
      mockPrisma.conversationParticipant.findUnique.mockResolvedValueOnce(null)

      const { sendMessage } = await import('@/lib/actions/message')
      const result = await sendMessage(mockConversation.id, 'テスト')

      expect(result).toEqual({ error: 'この会話にアクセスする権限がありません' })
    })

    it('日次制限を超えた場合、エラーを返す', async () => {
      mockPrisma.conversationParticipant.findUnique.mockResolvedValueOnce({
        conversationId: mockConversation.id,
        userId: mockUser.id,
      })
      mockPrisma.message.count.mockResolvedValueOnce(100)

      const { sendMessage } = await import('@/lib/actions/message')
      const result = await sendMessage(mockConversation.id, 'テスト')

      expect(result).toEqual({ error: '1日のメッセージ送信上限に達しました' })
    })
  })

  // ============================================================
  // getConversations
  // ============================================================

  describe('getConversations', () => {
    it('会話一覧を取得できる', async () => {
      const mockConversations = [
        {
          ...mockConversation,
          participants: [
            { userId: mockUser.id, lastReadAt: new Date(), user: mockUser },
            { userId: 'other-user-id', lastReadAt: null, user: { id: 'other-user-id', nickname: '他のユーザー', avatarUrl: null } },
          ],
          messages: [mockMessage],
        },
      ]
      mockPrisma.conversation.findMany.mockResolvedValueOnce(mockConversations)

      const { getConversations } = await import('@/lib/actions/message')
      const result = await getConversations()

      expect(result.conversations).toHaveLength(1)
      expect(result.conversations[0].otherUser?.nickname).toBe('他のユーザー')
    })

    it('未認証の場合、空配列を返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { getConversations } = await import('@/lib/actions/message')
      const result = await getConversations()

      expect(result).toEqual({ conversations: [] })
    })
  })

  // ============================================================
  // getConversation
  // ============================================================

  describe('getConversation', () => {
    it('会話詳細を取得できる', async () => {
      mockPrisma.conversationParticipant.findUnique.mockResolvedValueOnce({
        conversationId: mockConversation.id,
        userId: mockUser.id,
      })
      mockPrisma.conversation.findUnique.mockResolvedValueOnce({
        ...mockConversation,
        participants: [
          { userId: mockUser.id, user: mockUser },
          { userId: 'other-user-id', user: { id: 'other-user-id', nickname: '他のユーザー', avatarUrl: null } },
        ],
      })

      const { getConversation } = await import('@/lib/actions/message')
      const result = await getConversation(mockConversation.id)

      expect(result.conversation?.otherUser?.nickname).toBe('他のユーザー')
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { getConversation } = await import('@/lib/actions/message')
      const result = await getConversation(mockConversation.id)

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('参加者でない場合、エラーを返す', async () => {
      mockPrisma.conversationParticipant.findUnique.mockResolvedValueOnce(null)

      const { getConversation } = await import('@/lib/actions/message')
      const result = await getConversation(mockConversation.id)

      expect(result).toEqual({ error: 'この会話にアクセスする権限がありません' })
    })
  })

  // ============================================================
  // getMessages
  // ============================================================

  describe('getMessages', () => {
    it('メッセージ一覧を取得できる', async () => {
      mockPrisma.conversationParticipant.findUnique.mockResolvedValueOnce({
        conversationId: mockConversation.id,
        userId: mockUser.id,
      })
      mockPrisma.message.findMany.mockResolvedValueOnce([
        { ...mockMessage, sender: { id: mockUser.id, nickname: mockUser.nickname, avatarUrl: mockUser.avatarUrl } },
      ])
      mockPrisma.conversationParticipant.update.mockResolvedValueOnce({})

      const { getMessages } = await import('@/lib/actions/message')
      const result = await getMessages(mockConversation.id)

      expect(result.messages).toHaveLength(1)
      expect(result.currentUserId).toBe(mockUser.id)
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { getMessages } = await import('@/lib/actions/message')
      const result = await getMessages(mockConversation.id)

      expect(result).toEqual({ error: '認証が必要です' })
    })
  })

  // ============================================================
  // getUnreadMessageCount
  // ============================================================

  describe('getUnreadMessageCount', () => {
    it('未読メッセージ数を取得できる', async () => {
      const participants = [
        {
          userId: mockUser.id,
          lastReadAt: new Date('2024-01-01'),
          conversation: {
            messages: [{ ...mockMessage, senderId: 'other-user-id', createdAt: new Date('2024-01-02') }],
          },
        },
      ]
      mockPrisma.conversationParticipant.findMany.mockResolvedValueOnce(participants)

      const { getUnreadMessageCount } = await import('@/lib/actions/message')
      const result = await getUnreadMessageCount()

      expect(result).toEqual({ count: 1 })
    })

    it('未認証の場合、0を返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { getUnreadMessageCount } = await import('@/lib/actions/message')
      const result = await getUnreadMessageCount()

      expect(result).toEqual({ count: 0 })
    })
  })

  // ============================================================
  // markAsRead
  // ============================================================

  describe('markAsRead', () => {
    it('会話を既読にできる', async () => {
      mockPrisma.conversationParticipant.update.mockResolvedValueOnce({})

      const { markAsRead } = await import('@/lib/actions/message')
      const result = await markAsRead(mockConversation.id)

      expect(result).toEqual({ success: true })
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { markAsRead } = await import('@/lib/actions/message')
      const result = await markAsRead(mockConversation.id)

      expect(result).toEqual({ error: '認証が必要です' })
    })
  })

  // ============================================================
  // deleteMessage
  // ============================================================

  describe('deleteMessage', () => {
    it('自分のメッセージを削除できる', async () => {
      mockPrisma.message.findUnique.mockResolvedValueOnce({
        id: mockMessage.id,
        senderId: mockUser.id,
        conversationId: mockConversation.id,
      })
      mockPrisma.message.delete.mockResolvedValueOnce(mockMessage)

      const { deleteMessage } = await import('@/lib/actions/message')
      const result = await deleteMessage(mockMessage.id)

      expect(result).toEqual({ success: true })
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { deleteMessage } = await import('@/lib/actions/message')
      const result = await deleteMessage(mockMessage.id)

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('メッセージが見つからない場合、エラーを返す', async () => {
      mockPrisma.message.findUnique.mockResolvedValueOnce(null)

      const { deleteMessage } = await import('@/lib/actions/message')
      const result = await deleteMessage('nonexistent-id')

      expect(result).toEqual({ error: 'メッセージが見つかりません' })
    })

    it('他人のメッセージは削除できない', async () => {
      mockPrisma.message.findUnique.mockResolvedValueOnce({
        id: mockMessage.id,
        senderId: 'other-user-id',
        conversationId: mockConversation.id,
      })

      const { deleteMessage } = await import('@/lib/actions/message')
      const result = await deleteMessage(mockMessage.id)

      expect(result).toEqual({ error: 'このメッセージを削除する権限がありません' })
    })
  })
})
