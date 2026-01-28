/**
 * 認証アクション（auth.ts）の拡張テスト
 *
 * @jest-environment node
 */

// Prismaモック（auth.extended固有）
const authExtMockPrisma = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  passwordResetToken: {
    findFirst: jest.fn(),
    create: jest.fn(),
    deleteMany: jest.fn(),
  },
}

jest.mock('@/lib/db', () => ({
  prisma: authExtMockPrisma,
}))

// bcryptjsモック（auth.extended固有）
const authExtMockBcrypt = {
  hash: jest.fn(),
  compare: jest.fn(),
}

jest.mock('bcryptjs', () => authExtMockBcrypt)

// headersモック
jest.mock('next/headers', () => ({
  headers: jest.fn(() => ({
    get: jest.fn((name: string) => {
      if (name === 'x-forwarded-for') return '192.168.1.1'
      return null
    }),
  })),
}))

// メール送信モック
jest.mock('@/lib/email', () => ({
  sendPasswordResetEmail: jest.fn(),
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

// セキュリティロガーモック
jest.mock('@/lib/security-logger', () => ({
  logLoginFailure: jest.fn(),
  logLoginLockout: jest.fn(),
  logRegisterSuccess: jest.fn(),
  logPasswordResetRequest: jest.fn(),
  logPasswordResetSuccess: jest.fn(),
}))

// ログイントラッカーモック
jest.mock('@/lib/login-tracker', () => ({
  checkLoginAttempt: jest.fn(() => ({ allowed: true, remainingAttempts: 5 })),
  recordFailedLogin: jest.fn(() => ({ allowed: true, remainingAttempts: 4 })),
  resetLoginAttempts: jest.fn(),
  getLoginKey: jest.fn((ip, email) => `${ip}:${email}`),
}))

// パスワードバリデーションモック
jest.mock('@/lib/validations/password', () => ({
  validatePassword: jest.fn(() => ({ valid: true })),
}))

// サニタイズモック
jest.mock('@/lib/sanitize', () => ({
  sanitizeInput: jest.fn((input) => input),
}))

// レート制限モック
jest.mock('@/lib/rate-limit', () => ({
  rateLimit: jest.fn(() => ({ success: true })),
}))

// ブラックリストモック
jest.mock('@/lib/actions/blacklist', () => ({
  isEmailBlacklisted: jest.fn(() => false),
  isDeviceBlacklisted: jest.fn(() => false),
}))

describe('auth actions extended tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.resetModules()
  })

  // ============================================================
  // checkLoginAllowed
  // ============================================================

  describe('checkLoginAllowed', () => {
    it('ログインが許可されている場合', async () => {
      const { checkLoginAllowed } = await import('@/lib/actions/auth')

      const result = await checkLoginAllowed('test@example.com')

      expect(result.allowed).toBe(true)
      expect(result.remainingAttempts).toBe(5)
    })

    it('メールアドレスをサニタイズする', async () => {
      const { sanitizeInput } = await import('@/lib/sanitize')
      const { checkLoginAllowed } = await import('@/lib/actions/auth')

      await checkLoginAllowed('<script>test@example.com</script>')

      expect(sanitizeInput).toHaveBeenCalled()
    })

    it('IPアドレスとメールでキーを生成する', async () => {
      const { getLoginKey } = await import('@/lib/login-tracker')
      const { checkLoginAllowed } = await import('@/lib/actions/auth')

      await checkLoginAllowed('test@example.com')

      expect(getLoginKey).toHaveBeenCalledWith('192.168.1.1', 'test@example.com')
    })
  })

  // ============================================================
  // recordLoginFailure
  // ============================================================

  describe('recordLoginFailure', () => {
    it('ログイン失敗を記録する', async () => {
      const { recordLoginFailure } = await import('@/lib/actions/auth')

      const result = await recordLoginFailure('test@example.com')

      expect(result.locked).toBe(false)
      expect(result.remainingAttempts).toBe(4)
    })

    it('セキュリティログに記録する', async () => {
      const { logLoginFailure } = await import('@/lib/security-logger')
      const { recordLoginFailure } = await import('@/lib/actions/auth')

      await recordLoginFailure('test@example.com')

      expect(logLoginFailure).toHaveBeenCalledWith(
        'test@example.com',
        '192.168.1.1',
        'invalid_credentials'
      )
    })

    it('ロックアウト時に追加ログを記録する', async () => {
      const { recordFailedLogin } = await import('@/lib/login-tracker')
      const { logLoginLockout } = await import('@/lib/security-logger')
      ;(recordFailedLogin as jest.Mock).mockReturnValueOnce({
        allowed: false,
        remainingAttempts: 0,
        message: 'Account locked',
      })

      const { recordLoginFailure } = await import('@/lib/actions/auth')

      const result = await recordLoginFailure('test@example.com')

      expect(result.locked).toBe(true)
      expect(logLoginLockout).toHaveBeenCalledWith('test@example.com', '192.168.1.1')
    })
  })

  // ============================================================
  // clearLoginAttempts
  // ============================================================

  describe('clearLoginAttempts', () => {
    it('ログイン試行回数をリセットする', async () => {
      const { resetLoginAttempts } = await import('@/lib/login-tracker')
      const { clearLoginAttempts } = await import('@/lib/actions/auth')

      await clearLoginAttempts('test@example.com')

      expect(resetLoginAttempts).toHaveBeenCalled()
    })
  })

  // ============================================================
  // registerUser
  // ============================================================

  describe('registerUser', () => {
    it('新規ユーザーを登録する', async () => {
      authExtMockPrisma.user.findUnique.mockResolvedValue(null)
      authExtMockPrisma.user.create.mockResolvedValue({ id: 'user-123' })
      authExtMockBcrypt.hash.mockResolvedValue('hashedPassword')

      const { registerUser } = await import('@/lib/actions/auth')

      const result = await registerUser({
        email: 'new@example.com',
        password: 'SecurePass123',
        nickname: 'NewUser',
      })

      expect(result.success).toBe(true)
      expect(result.userId).toBe('user-123')
    })

    it('メールアドレスが既に登録されている場合はエラー', async () => {
      authExtMockPrisma.user.findUnique.mockResolvedValue({ id: 'existing-user' })

      const { registerUser } = await import('@/lib/actions/auth')

      const result = await registerUser({
        email: 'existing@example.com',
        password: 'SecurePass123',
        nickname: 'User',
      })

      expect(result.error).toBe('このメールアドレスは既に登録されています')
    })

    it('パスワードが弱い場合はエラー', async () => {
      const { validatePassword } = await import('@/lib/validations/password')
      ;(validatePassword as jest.Mock).mockReturnValueOnce({
        valid: false,
        error: 'パスワードは8文字以上で入力してください',
      })

      const { registerUser } = await import('@/lib/actions/auth')

      const result = await registerUser({
        email: 'test@example.com',
        password: 'weak',
        nickname: 'User',
      })

      expect(result.error).toBe('パスワードは8文字以上で入力してください')
    })

    it('メールがブラックリストに登録されている場合はエラー', async () => {
      const { isEmailBlacklisted } = await import('@/lib/actions/blacklist')
      ;(isEmailBlacklisted as jest.Mock).mockResolvedValueOnce(true)

      const { registerUser } = await import('@/lib/actions/auth')

      const result = await registerUser({
        email: 'blacklisted@example.com',
        password: 'SecurePass123',
        nickname: 'User',
      })

      expect(result.error).toBe('このメールアドレスは利用できません')
    })

    it('デバイスがブラックリストに登録されている場合はエラー', async () => {
      const { isDeviceBlacklisted } = await import('@/lib/actions/blacklist')
      ;(isDeviceBlacklisted as jest.Mock).mockResolvedValueOnce(true)

      const { registerUser } = await import('@/lib/actions/auth')

      const result = await registerUser({
        email: 'test@example.com',
        password: 'SecurePass123',
        nickname: 'User',
        fingerprint: 'blacklisted-fingerprint',
      })

      expect(result.error).toBe('このデバイスからの登録は許可されていません')
    })

    it('パスワードをハッシュ化する', async () => {
      authExtMockPrisma.user.findUnique.mockResolvedValue(null)
      authExtMockPrisma.user.create.mockResolvedValue({ id: 'user-123' })
      authExtMockBcrypt.hash.mockResolvedValue('$2a$10$hashedpassword')

      const { registerUser } = await import('@/lib/actions/auth')

      await registerUser({
        email: 'test@example.com',
        password: 'SecurePass123',
        nickname: 'User',
      })

      expect(authExtMockBcrypt.hash).toHaveBeenCalledWith('SecurePass123', 10)
    })

    it('登録成功をセキュリティログに記録する', async () => {
      authExtMockPrisma.user.findUnique.mockResolvedValue(null)
      authExtMockPrisma.user.create.mockResolvedValue({ id: 'user-123' })
      authExtMockBcrypt.hash.mockResolvedValue('hashedPassword')

      const { logRegisterSuccess } = await import('@/lib/security-logger')
      const { registerUser } = await import('@/lib/actions/auth')

      await registerUser({
        email: 'test@example.com',
        password: 'SecurePass123',
        nickname: 'User',
      })

      expect(logRegisterSuccess).toHaveBeenCalledWith('user-123', '192.168.1.1')
    })
  })

  // ============================================================
  // requestPasswordReset
  // ============================================================

  describe('requestPasswordReset', () => {
    it('パスワードリセットメールを送信する', async () => {
      authExtMockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
      })
      authExtMockPrisma.passwordResetToken.deleteMany.mockResolvedValue({})
      authExtMockPrisma.passwordResetToken.create.mockResolvedValue({})

      const { sendPasswordResetEmail } = await import('@/lib/email')
      ;(sendPasswordResetEmail as jest.Mock).mockResolvedValue({ success: true })

      const { requestPasswordReset } = await import('@/lib/actions/auth')

      const result = await requestPasswordReset('test@example.com')

      expect(result.success).toBe(true)
      expect(sendPasswordResetEmail).toHaveBeenCalled()
    })

    it('ユーザーが存在しない場合も成功を返す（列挙攻撃防止）', async () => {
      authExtMockPrisma.user.findUnique.mockResolvedValue(null)

      const { requestPasswordReset } = await import('@/lib/actions/auth')

      const result = await requestPasswordReset('nonexistent@example.com')

      expect(result.success).toBe(true)
    })

    it('レート制限に達した場合はエラー', async () => {
      const { rateLimit } = await import('@/lib/rate-limit')
      ;(rateLimit as jest.Mock).mockResolvedValueOnce({ success: false })

      const { requestPasswordReset } = await import('@/lib/actions/auth')

      const result = await requestPasswordReset('test@example.com')

      expect(result.error).toContain('パスワードリセットの要求が多すぎます')
    })

    it('メール送信に失敗した場合はエラー', async () => {
      authExtMockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
      })
      authExtMockPrisma.passwordResetToken.deleteMany.mockResolvedValue({})
      authExtMockPrisma.passwordResetToken.create.mockResolvedValue({})

      const { sendPasswordResetEmail } = await import('@/lib/email')
      ;(sendPasswordResetEmail as jest.Mock).mockResolvedValue({
        success: false,
        error: 'SMTP error',
      })

      const { requestPasswordReset } = await import('@/lib/actions/auth')

      const result = await requestPasswordReset('test@example.com')

      expect(result.error).toContain('メールの送信に失敗しました')
    })

    it('既存のトークンを削除する', async () => {
      authExtMockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
      })
      authExtMockPrisma.passwordResetToken.deleteMany.mockResolvedValue({})
      authExtMockPrisma.passwordResetToken.create.mockResolvedValue({})

      const { sendPasswordResetEmail } = await import('@/lib/email')
      ;(sendPasswordResetEmail as jest.Mock).mockResolvedValue({ success: true })

      const { requestPasswordReset } = await import('@/lib/actions/auth')

      await requestPasswordReset('test@example.com')

      expect(authExtMockPrisma.passwordResetToken.deleteMany).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      })
    })

    it('セキュリティログに記録する', async () => {
      authExtMockPrisma.user.findUnique.mockResolvedValue(null)

      const { logPasswordResetRequest } = await import('@/lib/security-logger')
      const { requestPasswordReset } = await import('@/lib/actions/auth')

      await requestPasswordReset('test@example.com')

      expect(logPasswordResetRequest).toHaveBeenCalledWith('test@example.com', '192.168.1.1')
    })
  })

  // ============================================================
  // resetPassword
  // ============================================================

  describe('resetPassword', () => {
    it('パスワードをリセットする', async () => {
      authExtMockPrisma.passwordResetToken.findFirst.mockResolvedValue({
        email: 'test@example.com',
        token: 'hashedToken',
      })
      authExtMockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
      })
      authExtMockPrisma.user.update.mockResolvedValue({})
      authExtMockPrisma.passwordResetToken.deleteMany.mockResolvedValue({})
      authExtMockBcrypt.hash.mockResolvedValue('newHashedPassword')

      const { resetPassword } = await import('@/lib/actions/auth')

      const result = await resetPassword({
        email: 'test@example.com',
        token: 'validToken',
        newPassword: 'NewSecure123',
      })

      expect(result.success).toBe(true)
    })

    it('パスワードが短すぎる場合はエラー', async () => {
      const { resetPassword } = await import('@/lib/actions/auth')

      const result = await resetPassword({
        email: 'test@example.com',
        token: 'validToken',
        newPassword: 'short',
      })

      expect(result.error).toContain('8文字以上')
    })

    it('パスワードにアルファベットがない場合はエラー', async () => {
      const { resetPassword } = await import('@/lib/actions/auth')

      const result = await resetPassword({
        email: 'test@example.com',
        token: 'validToken',
        newPassword: '12345678',
      })

      expect(result.error).toContain('アルファベットと数字を両方含めて')
    })

    it('パスワードに数字がない場合はエラー', async () => {
      const { resetPassword } = await import('@/lib/actions/auth')

      const result = await resetPassword({
        email: 'test@example.com',
        token: 'validToken',
        newPassword: 'abcdefgh',
      })

      expect(result.error).toContain('アルファベットと数字を両方含めて')
    })

    it('トークンが無効または期限切れの場合はエラー', async () => {
      authExtMockPrisma.passwordResetToken.findFirst.mockResolvedValue(null)

      const { resetPassword } = await import('@/lib/actions/auth')

      const result = await resetPassword({
        email: 'test@example.com',
        token: 'invalidToken',
        newPassword: 'NewSecure123',
      })

      expect(result.error).toContain('リセットリンクが無効または期限切れ')
    })

    it('ユーザーが見つからない場合はエラー', async () => {
      authExtMockPrisma.passwordResetToken.findFirst.mockResolvedValue({
        email: 'test@example.com',
        token: 'hashedToken',
      })
      authExtMockPrisma.user.findUnique.mockResolvedValue(null)

      const { resetPassword } = await import('@/lib/actions/auth')

      const result = await resetPassword({
        email: 'test@example.com',
        token: 'validToken',
        newPassword: 'NewSecure123',
      })

      expect(result.error).toBe('ユーザーが見つかりません')
    })

    it('使用済みトークンを削除する', async () => {
      authExtMockPrisma.passwordResetToken.findFirst.mockResolvedValue({
        email: 'test@example.com',
        token: 'hashedToken',
      })
      authExtMockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
      })
      authExtMockPrisma.user.update.mockResolvedValue({})
      authExtMockPrisma.passwordResetToken.deleteMany.mockResolvedValue({})
      authExtMockBcrypt.hash.mockResolvedValue('newHashedPassword')

      const { resetPassword } = await import('@/lib/actions/auth')

      await resetPassword({
        email: 'test@example.com',
        token: 'validToken',
        newPassword: 'NewSecure123',
      })

      expect(authExtMockPrisma.passwordResetToken.deleteMany).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      })
    })

    it('成功をセキュリティログに記録する', async () => {
      authExtMockPrisma.passwordResetToken.findFirst.mockResolvedValue({
        email: 'test@example.com',
        token: 'hashedToken',
      })
      authExtMockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
      })
      authExtMockPrisma.user.update.mockResolvedValue({})
      authExtMockPrisma.passwordResetToken.deleteMany.mockResolvedValue({})
      authExtMockBcrypt.hash.mockResolvedValue('newHashedPassword')

      const { logPasswordResetSuccess } = await import('@/lib/security-logger')
      const { resetPassword } = await import('@/lib/actions/auth')

      await resetPassword({
        email: 'test@example.com',
        token: 'validToken',
        newPassword: 'NewSecure123',
      })

      expect(logPasswordResetSuccess).toHaveBeenCalledWith('user-123')
    })
  })

  // ============================================================
  // verifyPasswordResetToken
  // ============================================================

  describe('verifyPasswordResetToken', () => {
    it('有効なトークンの場合はtrueを返す', async () => {
      authExtMockPrisma.passwordResetToken.findFirst.mockResolvedValue({
        email: 'test@example.com',
        token: 'hashedToken',
      })

      const { verifyPasswordResetToken } = await import('@/lib/actions/auth')

      const result = await verifyPasswordResetToken('test@example.com', 'validToken')

      expect(result.valid).toBe(true)
    })

    it('無効なトークンの場合はfalseを返す', async () => {
      authExtMockPrisma.passwordResetToken.findFirst.mockResolvedValue(null)

      const { verifyPasswordResetToken } = await import('@/lib/actions/auth')

      const result = await verifyPasswordResetToken('test@example.com', 'invalidToken')

      expect(result.valid).toBe(false)
    })

    it('有効期限が過ぎたトークンを検索しない', async () => {
      authExtMockPrisma.passwordResetToken.findFirst.mockResolvedValue(null)

      const { verifyPasswordResetToken } = await import('@/lib/actions/auth')

      await verifyPasswordResetToken('test@example.com', 'expiredToken')

      expect(authExtMockPrisma.passwordResetToken.findFirst).toHaveBeenCalledWith({
        where: {
          email: 'test@example.com',
          token: expect.any(String), // ハッシュ化されたトークン
          expires: { gt: expect.any(Date) }, // 現在時刻より後
        },
      })
    })
  })
})
