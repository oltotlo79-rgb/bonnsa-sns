/**
 * 2段階認証Server Actionsのテスト
 */

// モック設定
const mockAuth = jest.fn()
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
}

jest.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}))

jest.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}))

// bcryptのモック
jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
}))

// two-factorユーティリティのモック
const mockGenerateSecret = jest.fn()
const mockGenerateTOTPUri = jest.fn()
const mockGenerateQRCode = jest.fn()
const mockVerifyTOTP = jest.fn()
const mockGenerateBackupCodes = jest.fn()
const mockHashBackupCode = jest.fn()
const mockVerifyBackupCode = jest.fn()
const mockEncryptSecret = jest.fn()
const mockDecryptSecret = jest.fn()
const mockDetectCodeType = jest.fn()
const mockFormatTOTPCode = jest.fn()

jest.mock('@/lib/two-factor', () => ({
  generateSecret: () => mockGenerateSecret(),
  generateTOTPUri: (secret: string, email: string) => mockGenerateTOTPUri(secret, email),
  generateQRCode: (uri: string) => mockGenerateQRCode(uri),
  verifyTOTP: (token: string, secret: string) => mockVerifyTOTP(token, secret),
  generateBackupCodes: () => mockGenerateBackupCodes(),
  hashBackupCode: (code: string) => mockHashBackupCode(code),
  verifyBackupCode: (code: string, hashes: string[]) => mockVerifyBackupCode(code, hashes),
  encryptSecret: (secret: string) => mockEncryptSecret(secret),
  decryptSecret: (encrypted: string) => mockDecryptSecret(encrypted),
  detectCodeType: (code: string) => mockDetectCodeType(code),
  formatTOTPCode: (code: string) => mockFormatTOTPCode(code),
}))

import bcrypt from 'bcryptjs'

describe('Two-Factor Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // デフォルトで認証済みユーザーを設定
    mockAuth.mockResolvedValue({ user: { id: 'user-123' } })
  })

  // ============================================================
  // setup2FA
  // ============================================================

  describe('setup2FA', () => {
    beforeEach(() => {
      mockGenerateSecret.mockReturnValue('TESTSECRET123456')
      mockGenerateTOTPUri.mockReturnValue('otpauth://totp/BON-LOG:test@example.com?secret=TESTSECRET123456')
      mockGenerateQRCode.mockResolvedValue('data:image/png;base64,mockQRCode')
      mockGenerateBackupCodes.mockReturnValue(['CODE1', 'CODE2', 'CODE3', 'CODE4', 'CODE5', 'CODE6', 'CODE7', 'CODE8', 'CODE9', 'CODE10'])
    })

    it('認証されていない場合はエラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { setup2FA } = await import('@/lib/actions/two-factor')
      const result = await setup2FA()

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('ユーザーが見つからない場合はエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null)

      const { setup2FA } = await import('@/lib/actions/two-factor')
      const result = await setup2FA()

      expect(result).toEqual({ error: 'ユーザーが見つかりません' })
    })

    it('既に2FAが有効な場合はエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        email: 'test@example.com',
        twoFactorEnabled: true,
      })

      const { setup2FA } = await import('@/lib/actions/two-factor')
      const result = await setup2FA()

      expect(result).toEqual({ error: '2段階認証は既に有効です' })
    })

    it('セットアップ情報を正常に返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        email: 'test@example.com',
        twoFactorEnabled: false,
      })

      const { setup2FA } = await import('@/lib/actions/two-factor')
      const result = await setup2FA()

      expect(result).toEqual({
        success: true,
        qrCode: 'data:image/png;base64,mockQRCode',
        secret: 'TESTSECRET123456',
        backupCodes: expect.arrayContaining(['CODE1', 'CODE2']),
      })
      expect(mockGenerateSecret).toHaveBeenCalled()
      expect(mockGenerateTOTPUri).toHaveBeenCalledWith('TESTSECRET123456', 'test@example.com')
      expect(mockGenerateQRCode).toHaveBeenCalled()
      expect(mockGenerateBackupCodes).toHaveBeenCalled()
    })
  })

  // ============================================================
  // enable2FA
  // ============================================================

  describe('enable2FA', () => {
    beforeEach(() => {
      mockVerifyTOTP.mockResolvedValue(true)
      mockEncryptSecret.mockReturnValue('encryptedSecret')
      mockHashBackupCode.mockImplementation((code: string) => `hash_${code}`)
    })

    it('認証されていない場合はエラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { enable2FA } = await import('@/lib/actions/two-factor')
      const result = await enable2FA('123456', 'SECRET', ['CODE1'])

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('ユーザーが見つからない場合はエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null)

      const { enable2FA } = await import('@/lib/actions/two-factor')
      const result = await enable2FA('123456', 'SECRET', ['CODE1'])

      expect(result).toEqual({ error: 'ユーザーが見つかりません' })
    })

    it('既に2FAが有効な場合はエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({ twoFactorEnabled: true })

      const { enable2FA } = await import('@/lib/actions/two-factor')
      const result = await enable2FA('123456', 'SECRET', ['CODE1'])

      expect(result).toEqual({ error: '2段階認証は既に有効です' })
    })

    it('無効なTOTPコードの場合はエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({ twoFactorEnabled: false })
      mockVerifyTOTP.mockResolvedValueOnce(false)

      const { enable2FA } = await import('@/lib/actions/two-factor')
      const result = await enable2FA('000000', 'SECRET', ['CODE1'])

      expect(result).toEqual({ error: '認証コードが正しくありません' })
    })

    it('正常に2FAを有効化する', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({ twoFactorEnabled: false })
      mockPrisma.user.update.mockResolvedValueOnce({})

      const { enable2FA } = await import('@/lib/actions/two-factor')
      const result = await enable2FA('123456', 'SECRET', ['CODE1', 'CODE2'])

      expect(result).toEqual({ success: true })
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          twoFactorEnabled: true,
          twoFactorSecret: 'encryptedSecret',
          twoFactorBackupCodes: ['hash_CODE1', 'hash_CODE2'],
        },
      })
    })
  })

  // ============================================================
  // disable2FA
  // ============================================================

  describe('disable2FA', () => {
    it('認証されていない場合はエラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { disable2FA } = await import('@/lib/actions/two-factor')
      const result = await disable2FA('password123')

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('ユーザーが見つからない場合はエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null)

      const { disable2FA } = await import('@/lib/actions/two-factor')
      const result = await disable2FA('password123')

      expect(result).toEqual({ error: 'ユーザーが見つかりません' })
    })

    it('2FAが有効でない場合はエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        password: 'hashedPassword',
        twoFactorEnabled: false,
      })

      const { disable2FA } = await import('@/lib/actions/two-factor')
      const result = await disable2FA('password123')

      expect(result).toEqual({ error: '2段階認証は有効ではありません' })
    })

    it('パスワードが設定されていない場合はエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        password: null,
        twoFactorEnabled: true,
      })

      const { disable2FA } = await import('@/lib/actions/two-factor')
      const result = await disable2FA('password123')

      expect(result).toEqual({ error: 'パスワードが設定されていません' })
    })

    it('パスワードが間違っている場合はエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        password: 'hashedPassword',
        twoFactorEnabled: true,
      })
      ;(bcrypt.compare as jest.Mock).mockResolvedValueOnce(false)

      const { disable2FA } = await import('@/lib/actions/two-factor')
      const result = await disable2FA('wrongPassword')

      expect(result).toEqual({ error: 'パスワードが正しくありません' })
    })

    it('正常に2FAを無効化する', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        password: 'hashedPassword',
        twoFactorEnabled: true,
      })
      ;(bcrypt.compare as jest.Mock).mockResolvedValueOnce(true)
      mockPrisma.user.update.mockResolvedValueOnce({})

      const { disable2FA } = await import('@/lib/actions/two-factor')
      const result = await disable2FA('password123')

      expect(result).toEqual({ success: true })
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          twoFactorEnabled: false,
          twoFactorSecret: null,
          twoFactorBackupCodes: [],
        },
      })
    })
  })

  // ============================================================
  // verify2FAToken
  // ============================================================

  describe('verify2FAToken', () => {
    it('ユーザーが見つからない場合はエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null)

      const { verify2FAToken } = await import('@/lib/actions/two-factor')
      const result = await verify2FAToken('user-123', '123456')

      expect(result).toEqual({ error: 'ユーザーが見つかりません' })
    })

    it('2FAが有効でない場合はエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorBackupCodes: [],
      })

      const { verify2FAToken } = await import('@/lib/actions/two-factor')
      const result = await verify2FAToken('user-123', '123456')

      expect(result).toEqual({ error: '2段階認証が有効ではありません' })
    })

    it('TOTPコードで正常に検証する', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        twoFactorEnabled: true,
        twoFactorSecret: 'encryptedSecret',
        twoFactorBackupCodes: [],
      })
      mockDetectCodeType.mockReturnValue('totp')
      mockDecryptSecret.mockReturnValue('decryptedSecret')
      mockFormatTOTPCode.mockReturnValue('123456')
      mockVerifyTOTP.mockResolvedValue(true)

      const { verify2FAToken } = await import('@/lib/actions/two-factor')
      const result = await verify2FAToken('user-123', '123456')

      expect(result).toEqual({ success: true })
    })

    it('無効なTOTPコードの場合はエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        twoFactorEnabled: true,
        twoFactorSecret: 'encryptedSecret',
        twoFactorBackupCodes: [],
      })
      mockDetectCodeType.mockReturnValue('totp')
      mockDecryptSecret.mockReturnValue('decryptedSecret')
      mockFormatTOTPCode.mockReturnValue('000000')
      mockVerifyTOTP.mockResolvedValue(false)

      const { verify2FAToken } = await import('@/lib/actions/two-factor')
      const result = await verify2FAToken('user-123', '000000')

      expect(result).toEqual({ error: '認証コードが正しくありません' })
    })

    it('バックアップコードで正常に検証する', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        twoFactorEnabled: true,
        twoFactorSecret: 'encryptedSecret',
        twoFactorBackupCodes: ['hash1', 'hash2', 'hash3'],
      })
      mockDetectCodeType.mockReturnValue('backup')
      mockVerifyBackupCode.mockReturnValue(1)
      mockPrisma.user.update.mockResolvedValueOnce({})

      const { verify2FAToken } = await import('@/lib/actions/two-factor')
      const result = await verify2FAToken('user-123', 'BACKUPCODE')

      expect(result).toEqual({ success: true })
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { twoFactorBackupCodes: ['hash1', 'hash3'] },
      })
    })

    it('無効なバックアップコードの場合はエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        twoFactorEnabled: true,
        twoFactorSecret: 'encryptedSecret',
        twoFactorBackupCodes: ['hash1', 'hash2'],
      })
      mockDetectCodeType.mockReturnValue('backup')
      mockVerifyBackupCode.mockReturnValue(-1)

      const { verify2FAToken } = await import('@/lib/actions/two-factor')
      const result = await verify2FAToken('user-123', 'INVALIDCODE')

      expect(result).toEqual({ error: 'バックアップコードが正しくありません' })
    })
  })

  // ============================================================
  // regenerateBackupCodes
  // ============================================================

  describe('regenerateBackupCodes', () => {
    beforeEach(() => {
      mockGenerateBackupCodes.mockReturnValue(['NEW1', 'NEW2', 'NEW3', 'NEW4', 'NEW5', 'NEW6', 'NEW7', 'NEW8', 'NEW9', 'NEW10'])
      mockHashBackupCode.mockImplementation((code: string) => `hash_${code}`)
    })

    it('認証されていない場合はエラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { regenerateBackupCodes } = await import('@/lib/actions/two-factor')
      const result = await regenerateBackupCodes('password123')

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('ユーザーが見つからない場合はエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null)

      const { regenerateBackupCodes } = await import('@/lib/actions/two-factor')
      const result = await regenerateBackupCodes('password123')

      expect(result).toEqual({ error: 'ユーザーが見つかりません' })
    })

    it('2FAが有効でない場合はエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        password: 'hashedPassword',
        twoFactorEnabled: false,
      })

      const { regenerateBackupCodes } = await import('@/lib/actions/two-factor')
      const result = await regenerateBackupCodes('password123')

      expect(result).toEqual({ error: '2段階認証が有効ではありません' })
    })

    it('パスワードが設定されていない場合はエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        password: null,
        twoFactorEnabled: true,
      })

      const { regenerateBackupCodes } = await import('@/lib/actions/two-factor')
      const result = await regenerateBackupCodes('password123')

      expect(result).toEqual({ error: 'パスワードが設定されていません' })
    })

    it('パスワードが間違っている場合はエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        password: 'hashedPassword',
        twoFactorEnabled: true,
      })
      ;(bcrypt.compare as jest.Mock).mockResolvedValueOnce(false)

      const { regenerateBackupCodes } = await import('@/lib/actions/two-factor')
      const result = await regenerateBackupCodes('wrongPassword')

      expect(result).toEqual({ error: 'パスワードが正しくありません' })
    })

    it('正常にバックアップコードを再生成する', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        password: 'hashedPassword',
        twoFactorEnabled: true,
      })
      ;(bcrypt.compare as jest.Mock).mockResolvedValueOnce(true)
      mockPrisma.user.update.mockResolvedValueOnce({})

      const { regenerateBackupCodes } = await import('@/lib/actions/two-factor')
      const result = await regenerateBackupCodes('password123')

      expect(result).toEqual({
        success: true,
        backupCodes: expect.arrayContaining(['NEW1', 'NEW2']),
      })
    })
  })

  // ============================================================
  // get2FAStatus
  // ============================================================

  describe('get2FAStatus', () => {
    it('認証されていない場合はエラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { get2FAStatus } = await import('@/lib/actions/two-factor')
      const result = await get2FAStatus()

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('ユーザーが見つからない場合はエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null)

      const { get2FAStatus } = await import('@/lib/actions/two-factor')
      const result = await get2FAStatus()

      expect(result).toEqual({ error: 'ユーザーが見つかりません' })
    })

    it('2FAが有効な場合は状態と残りコード数を返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        twoFactorEnabled: true,
        twoFactorBackupCodes: ['hash1', 'hash2', 'hash3', 'hash4', 'hash5'],
      })

      const { get2FAStatus } = await import('@/lib/actions/two-factor')
      const result = await get2FAStatus()

      expect(result).toEqual({
        enabled: true,
        backupCodesRemaining: 5,
      })
    })

    it('2FAが無効な場合は無効状態を返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        twoFactorEnabled: false,
        twoFactorBackupCodes: [],
      })

      const { get2FAStatus } = await import('@/lib/actions/two-factor')
      const result = await get2FAStatus()

      expect(result).toEqual({ enabled: false })
    })
  })

  // ============================================================
  // check2FARequired
  // ============================================================

  describe('check2FARequired', () => {
    it('ユーザーが存在しない場合はrequired: falseを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null)

      const { check2FARequired } = await import('@/lib/actions/two-factor')
      const result = await check2FARequired('nonexistent@example.com')

      expect(result).toEqual({ required: false })
    })

    it('2FAが有効な場合はrequired: trueとuserIdを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-123',
        twoFactorEnabled: true,
      })

      const { check2FARequired } = await import('@/lib/actions/two-factor')
      const result = await check2FARequired('user@example.com')

      expect(result).toEqual({
        required: true,
        userId: 'user-123',
      })
    })

    it('2FAが無効な場合はrequired: falseを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-123',
        twoFactorEnabled: false,
      })

      const { check2FARequired } = await import('@/lib/actions/two-factor')
      const result = await check2FARequired('user@example.com')

      expect(result).toEqual({ required: false })
    })
  })
})
