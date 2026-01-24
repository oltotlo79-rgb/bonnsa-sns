/**
 * @jest-environment node
 */
import { createMockPrismaClient, mockUser, mockPasswordResetToken } from '../../utils/test-utils'

// Prismaモック
const mockPrisma = createMockPrismaClient()
jest.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}))

// bcryptjsモック
const mockBcrypt = {
  hash: jest.fn().mockResolvedValue('hashed-password'),
  compare: jest.fn().mockResolvedValue(true),
}
jest.mock('bcryptjs', () => mockBcrypt)

// cryptoモック
const mockCrypto = {
  randomBytes: jest.fn().mockReturnValue({
    toString: jest.fn().mockReturnValue('random-token-123'),
  }),
  createHash: jest.fn().mockReturnValue({
    update: jest.fn().mockReturnValue({
      digest: jest.fn().mockReturnValue('hashed-token-123'),
    }),
  }),
}
jest.mock('crypto', () => mockCrypto)

// headersモック
const mockHeaders = {
  get: jest.fn().mockReturnValue('127.0.0.1'),
}
jest.mock('next/headers', () => ({
  headers: jest.fn().mockResolvedValue(mockHeaders),
}))

// メール送信モック
const mockSendPasswordResetEmail = jest.fn().mockResolvedValue({ success: true })
jest.mock('@/lib/email', () => ({
  sendPasswordResetEmail: mockSendPasswordResetEmail,
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

// ログイントラッカーモック
const mockLoginTracker = {
  checkLoginAttempt: jest.fn().mockResolvedValue({
    allowed: true,
    message: '',
    remainingAttempts: 5,
  }),
  recordFailedLogin: jest.fn().mockResolvedValue({
    allowed: true,
    message: '',
    remainingAttempts: 4,
  }),
  resetLoginAttempts: jest.fn().mockResolvedValue(undefined),
  getLoginKey: jest.fn().mockReturnValue('login-key'),
}
jest.mock('@/lib/login-tracker', () => mockLoginTracker)

// サニタイズモック
jest.mock('@/lib/sanitize', () => ({
  sanitizeInput: jest.fn((input: string) => input),
}))

// セキュリティロガーモック
jest.mock('@/lib/security-logger', () => ({
  logLoginFailure: jest.fn(),
  logLoginLockout: jest.fn(),
  logRegisterSuccess: jest.fn(),
  logPasswordResetRequest: jest.fn(),
  logPasswordResetSuccess: jest.fn(),
}))

describe('Auth Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // ============================================================
  // checkLoginAllowed
  // ============================================================

  describe('checkLoginAllowed', () => {
    it('ログインが許可されている場合、allowed: trueを返す', async () => {
      mockLoginTracker.checkLoginAttempt.mockResolvedValueOnce({
        allowed: true,
        message: '',
        remainingAttempts: 5,
      })

      const { checkLoginAllowed } = await import('@/lib/actions/auth')
      const result = await checkLoginAllowed('test@example.com')

      expect(result.allowed).toBe(true)
      expect(result.remainingAttempts).toBe(5)
    })

    it('ログインがロックされている場合、allowed: falseを返す', async () => {
      mockLoginTracker.checkLoginAttempt.mockResolvedValueOnce({
        allowed: false,
        message: 'アカウントがロックされています',
        remainingAttempts: 0,
      })

      const { checkLoginAllowed } = await import('@/lib/actions/auth')
      const result = await checkLoginAllowed('test@example.com')

      expect(result.allowed).toBe(false)
      expect(result.message).toBe('アカウントがロックされています')
    })
  })

  // ============================================================
  // recordLoginFailure
  // ============================================================

  describe('recordLoginFailure', () => {
    it('ログイン失敗を記録し、残り回数を返す', async () => {
      mockLoginTracker.recordFailedLogin.mockResolvedValueOnce({
        allowed: true,
        message: '',
        remainingAttempts: 4,
      })

      const { recordLoginFailure } = await import('@/lib/actions/auth')
      const result = await recordLoginFailure('test@example.com')

      expect(result.locked).toBe(false)
      expect(result.remainingAttempts).toBe(4)
    })

    it('ロックアウトになった場合、locked: trueを返す', async () => {
      mockLoginTracker.recordFailedLogin.mockResolvedValueOnce({
        allowed: false,
        message: 'アカウントがロックされました',
        remainingAttempts: 0,
      })

      const { recordLoginFailure } = await import('@/lib/actions/auth')
      const result = await recordLoginFailure('test@example.com')

      expect(result.locked).toBe(true)
      expect(result.message).toBe('アカウントがロックされました')
    })
  })

  // ============================================================
  // clearLoginAttempts
  // ============================================================

  describe('clearLoginAttempts', () => {
    it('ログイン試行回数をリセットする', async () => {
      const { clearLoginAttempts } = await import('@/lib/actions/auth')
      await clearLoginAttempts('test@example.com')

      expect(mockLoginTracker.resetLoginAttempts).toHaveBeenCalled()
    })
  })

  // ============================================================
  // registerUser
  // ============================================================

  describe('registerUser', () => {
    it('新規ユーザーを登録できる', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null)
      mockPrisma.user.create.mockResolvedValueOnce({
        id: 'new-user-id',
        email: 'newuser@example.com',
        nickname: '新規ユーザー',
      })

      const { registerUser } = await import('@/lib/actions/auth')
      const result = await registerUser({
        email: 'newuser@example.com',
        password: 'Password123',
        nickname: '新規ユーザー',
      })

      expect(result).toEqual({ success: true, userId: 'new-user-id' })
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          email: 'newuser@example.com',
          password: 'hashed-password',
          nickname: '新規ユーザー',
        },
      })
    })

    it('既存のメールアドレスの場合、エラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockUser)

      const { registerUser } = await import('@/lib/actions/auth')
      const result = await registerUser({
        email: 'test@example.com',
        password: 'Password123',
        nickname: 'テストユーザー',
      })

      expect(result).toEqual({ error: 'このメールアドレスは既に登録されています' })
      expect(mockPrisma.user.create).not.toHaveBeenCalled()
    })
  })

  // ============================================================
  // requestPasswordReset
  // ============================================================

  describe('requestPasswordReset', () => {
    it('パスワードリセットメールを送信する', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockUser)
      mockPrisma.passwordResetToken.deleteMany.mockResolvedValueOnce({ count: 0 })
      mockPrisma.passwordResetToken.create.mockResolvedValueOnce(mockPasswordResetToken)
      mockSendPasswordResetEmail.mockResolvedValueOnce({ success: true })

      const { requestPasswordReset } = await import('@/lib/actions/auth')
      const result = await requestPasswordReset('test@example.com')

      expect(result).toEqual({ success: true })
      expect(mockPrisma.passwordResetToken.deleteMany).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      })
      expect(mockPrisma.passwordResetToken.create).toHaveBeenCalled()
      expect(mockSendPasswordResetEmail).toHaveBeenCalled()
    })

    it('ユーザーが存在しなくても成功を返す（セキュリティ対策）', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null)

      const { requestPasswordReset } = await import('@/lib/actions/auth')
      const result = await requestPasswordReset('nonexistent@example.com')

      expect(result).toEqual({ success: true })
      expect(mockPrisma.passwordResetToken.create).not.toHaveBeenCalled()
    })

    it('メール送信失敗時、エラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockUser)
      mockPrisma.passwordResetToken.deleteMany.mockResolvedValueOnce({ count: 0 })
      mockPrisma.passwordResetToken.create.mockResolvedValueOnce(mockPasswordResetToken)
      mockSendPasswordResetEmail.mockResolvedValueOnce({ success: false, error: 'SMTP error' })

      const { requestPasswordReset } = await import('@/lib/actions/auth')
      const result = await requestPasswordReset('test@example.com')

      expect(result).toEqual({ error: 'メールの送信に失敗しました。しばらく経ってからお試しください。' })
    })
  })

  // ============================================================
  // resetPassword
  // ============================================================

  describe('resetPassword', () => {
    it('パスワードをリセットする', async () => {
      mockPrisma.passwordResetToken.findFirst.mockResolvedValueOnce({
        ...mockPasswordResetToken,
        expires: new Date(Date.now() + 3600000),
      })
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockUser)
      mockPrisma.user.update.mockResolvedValueOnce({ ...mockUser, password: 'new-hashed-password' })
      mockPrisma.passwordResetToken.deleteMany.mockResolvedValueOnce({ count: 1 })

      const { resetPassword } = await import('@/lib/actions/auth')
      const result = await resetPassword({
        email: 'test@example.com',
        token: 'valid-token',
        newPassword: 'NewPassword123',
      })

      expect(result).toEqual({ success: true })
      expect(mockPrisma.user.update).toHaveBeenCalled()
      expect(mockPrisma.passwordResetToken.deleteMany).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      })
    })

    it('8文字未満のパスワードでエラーを返す', async () => {
      const { resetPassword } = await import('@/lib/actions/auth')
      const result = await resetPassword({
        email: 'test@example.com',
        token: 'valid-token',
        newPassword: 'Short1',
      })

      expect(result).toEqual({ error: 'パスワードは8文字以上で入力してください' })
    })

    it('アルファベットのみのパスワードでエラーを返す', async () => {
      const { resetPassword } = await import('@/lib/actions/auth')
      const result = await resetPassword({
        email: 'test@example.com',
        token: 'valid-token',
        newPassword: 'OnlyLetters',
      })

      expect(result).toEqual({ error: 'パスワードはアルファベットと数字を両方含めてください' })
    })

    it('数字のみのパスワードでエラーを返す', async () => {
      const { resetPassword } = await import('@/lib/actions/auth')
      const result = await resetPassword({
        email: 'test@example.com',
        token: 'valid-token',
        newPassword: '12345678',
      })

      expect(result).toEqual({ error: 'パスワードはアルファベットと数字を両方含めてください' })
    })

    it('無効なトークンでエラーを返す', async () => {
      mockPrisma.passwordResetToken.findFirst.mockResolvedValueOnce(null)

      const { resetPassword } = await import('@/lib/actions/auth')
      const result = await resetPassword({
        email: 'test@example.com',
        token: 'invalid-token',
        newPassword: 'ValidPass123',
      })

      expect(result).toEqual({ error: 'リセットリンクが無効または期限切れです。もう一度お試しください。' })
    })

    it('ユーザーが見つからない場合エラーを返す', async () => {
      mockPrisma.passwordResetToken.findFirst.mockResolvedValueOnce({
        ...mockPasswordResetToken,
        expires: new Date(Date.now() + 3600000),
      })
      mockPrisma.user.findUnique.mockResolvedValueOnce(null)

      const { resetPassword } = await import('@/lib/actions/auth')
      const result = await resetPassword({
        email: 'test@example.com',
        token: 'valid-token',
        newPassword: 'ValidPass123',
      })

      expect(result).toEqual({ error: 'ユーザーが見つかりません' })
    })
  })

  // ============================================================
  // verifyPasswordResetToken
  // ============================================================

  describe('verifyPasswordResetToken', () => {
    it('有効なトークンの場合、valid: trueを返す', async () => {
      mockPrisma.passwordResetToken.findFirst.mockResolvedValueOnce({
        ...mockPasswordResetToken,
        expires: new Date(Date.now() + 3600000),
      })

      const { verifyPasswordResetToken } = await import('@/lib/actions/auth')
      const result = await verifyPasswordResetToken('test@example.com', 'valid-token')

      expect(result).toEqual({ valid: true })
    })

    it('無効なトークンの場合、valid: falseを返す', async () => {
      mockPrisma.passwordResetToken.findFirst.mockResolvedValueOnce(null)

      const { verifyPasswordResetToken } = await import('@/lib/actions/auth')
      const result = await verifyPasswordResetToken('test@example.com', 'invalid-token')

      expect(result).toEqual({ valid: false })
    })
  })
})
