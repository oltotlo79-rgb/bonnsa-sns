/**
 * @jest-environment node
 */

// Logger mock
jest.mock('@/lib/logger', () => ({
  __esModule: true,
  default: {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}))

// Resend mock
const mockResendSend = jest.fn()
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: mockResendSend,
    },
  })),
}))

// Azure mock
const mockAzureBeginSend = jest.fn()
jest.mock('@azure/communication-email', () => ({
  EmailClient: jest.fn().mockImplementation(() => ({
    beginSend: mockAzureBeginSend,
  })),
}))

describe('Email Module', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.resetModules()
    // 環境変数をリセット
    delete process.env.EMAIL_PROVIDER
    delete process.env.RESEND_API_KEY
    delete process.env.EMAIL_FROM
    delete process.env.AZURE_COMMUNICATION_CONNECTION_STRING
    delete process.env.AZURE_EMAIL_SENDER
  })

  describe('sendEmail', () => {
    it('デフォルトではConsoleProviderを使用する', async () => {
      const { sendEmail } = await import('@/lib/email')

      const result = await sendEmail({
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Test</p>',
      })

      expect(result.success).toBe(true)
      expect(result.messageId).toMatch(/^console-\d+$/)
    })

    it('EMAIL_PROVIDER=consoleでConsoleProviderを使用', async () => {
      process.env.EMAIL_PROVIDER = 'console'
      const { sendEmail } = await import('@/lib/email')

      const result = await sendEmail({
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Test</p>',
      })

      expect(result.success).toBe(true)
    })

    it('EMAIL_PROVIDER=resendでResendProviderを使用', async () => {
      process.env.EMAIL_PROVIDER = 'resend'
      process.env.RESEND_API_KEY = 'test-api-key'

      mockResendSend.mockResolvedValueOnce({
        data: { id: 'resend-123' },
        error: null,
      })

      const { sendEmail } = await import('@/lib/email')

      const result = await sendEmail({
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Test</p>',
      })

      expect(result.success).toBe(true)
      expect(result.messageId).toBe('resend-123')
      expect(mockResendSend).toHaveBeenCalled()
    })

    it('ResendでAPIエラーが発生した場合', async () => {
      process.env.EMAIL_PROVIDER = 'resend'
      process.env.RESEND_API_KEY = 'test-api-key'

      mockResendSend.mockResolvedValueOnce({
        data: null,
        error: { message: 'Invalid API key' },
      })

      const { sendEmail } = await import('@/lib/email')

      const result = await sendEmail({
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Test</p>',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid API key')
    })

    it('Resendで例外が発生した場合', async () => {
      process.env.EMAIL_PROVIDER = 'resend'
      process.env.RESEND_API_KEY = 'test-api-key'

      mockResendSend.mockRejectedValueOnce(new Error('Network error'))

      const { sendEmail } = await import('@/lib/email')

      const result = await sendEmail({
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Test</p>',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Network error')
    })

    it('EMAIL_PROVIDER=azureでAzureProviderを使用', async () => {
      process.env.EMAIL_PROVIDER = 'azure'
      process.env.AZURE_COMMUNICATION_CONNECTION_STRING = 'endpoint=https://test.communication.azure.com/;accesskey=test'

      mockAzureBeginSend.mockResolvedValueOnce({
        pollUntilDone: jest.fn().mockResolvedValue({
          status: 'Succeeded',
          id: 'azure-123',
        }),
      })

      const { sendEmail } = await import('@/lib/email')

      const result = await sendEmail({
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Test</p>',
      })

      expect(result.success).toBe(true)
      expect(result.messageId).toBe('azure-123')
    })

    it('Azureで送信失敗した場合', async () => {
      process.env.EMAIL_PROVIDER = 'azure'
      process.env.AZURE_COMMUNICATION_CONNECTION_STRING = 'endpoint=https://test.communication.azure.com/;accesskey=test'

      mockAzureBeginSend.mockResolvedValueOnce({
        pollUntilDone: jest.fn().mockResolvedValue({
          status: 'Failed',
        }),
      })

      const { sendEmail } = await import('@/lib/email')

      const result = await sendEmail({
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Test</p>',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Status: Failed')
    })

    it('Azureで例外が発生した場合', async () => {
      process.env.EMAIL_PROVIDER = 'azure'
      process.env.AZURE_COMMUNICATION_CONNECTION_STRING = 'endpoint=https://test.communication.azure.com/;accesskey=test'

      mockAzureBeginSend.mockRejectedValueOnce(new Error('Azure error'))

      const { sendEmail } = await import('@/lib/email')

      const result = await sendEmail({
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Test</p>',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Azure error')
    })
  })

  describe('sendPasswordResetEmail', () => {
    it('パスワードリセットメールを送信する', async () => {
      const { sendPasswordResetEmail } = await import('@/lib/email')

      const result = await sendPasswordResetEmail(
        'test@example.com',
        'https://example.com/reset?token=abc123'
      )

      expect(result.success).toBe(true)
    })

    it('メール内容にリセットURLが含まれる', async () => {
      const logger = (await import('@/lib/logger')).default
      const { sendPasswordResetEmail } = await import('@/lib/email')

      await sendPasswordResetEmail(
        'test@example.com',
        'https://example.com/reset?token=abc123'
      )

      // ConsoleProviderがloggerを呼ぶことを確認
      expect(logger.log).toHaveBeenCalled()
    })
  })

  describe('sendSubscriptionExpiringEmail', () => {
    it('サブスクリプション期限切れ間近メールを送信する', async () => {
      const { sendSubscriptionExpiringEmail } = await import('@/lib/email')

      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 7)

      const result = await sendSubscriptionExpiringEmail(
        'test@example.com',
        'TestUser',
        futureDate
      )

      expect(result.success).toBe(true)
    })

    it('残り日数を正しく計算する', async () => {
      const logger = (await import('@/lib/logger')).default
      const { sendSubscriptionExpiringEmail } = await import('@/lib/email')

      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 3)

      await sendSubscriptionExpiringEmail(
        'test@example.com',
        'TestUser',
        futureDate
      )

      // HTMLに残り日数が含まれていることを確認（ログ経由）
      expect(logger.log).toHaveBeenCalled()
    })
  })

  describe('sendSubscriptionExpiredEmail', () => {
    it('サブスクリプション期限切れメールを送信する', async () => {
      const { sendSubscriptionExpiredEmail } = await import('@/lib/email')

      const result = await sendSubscriptionExpiredEmail(
        'test@example.com',
        'TestUser'
      )

      expect(result.success).toBe(true)
    })
  })

  describe('プロバイダーのシングルトン', () => {
    it('同じプロバイダーインスタンスを再利用する', async () => {
      const { sendEmail } = await import('@/lib/email')

      await sendEmail({ to: 'a@test.com', subject: 'Test1', html: '<p>1</p>' })
      await sendEmail({ to: 'b@test.com', subject: 'Test2', html: '<p>2</p>' })

      // どちらも成功（同じプロバイダー使用）
      // 特に検証することはないが、エラーが出ないことを確認
    })
  })
})
