/**
 * @jest-environment node
 */

// グローバルモックを解除して実際のモジュールをテスト
jest.unmock('@/lib/logger')

describe('Logger Module', () => {
  const originalEnv = process.env.NODE_ENV

  afterAll(() => {
    process.env.NODE_ENV = originalEnv
  })

  describe('Development Environment', () => {
    let consoleLogSpy: jest.SpyInstance
    let consoleWarnSpy: jest.SpyInstance
    let consoleErrorSpy: jest.SpyInstance
    let consoleDebugSpy: jest.SpyInstance

    beforeEach(() => {
      jest.resetModules()
      process.env.NODE_ENV = 'development'
      // 各テストの前にスパイを設定
      consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()
      consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
      consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation()
    })

    afterEach(() => {
      consoleLogSpy.mockRestore()
      consoleWarnSpy.mockRestore()
      consoleErrorSpy.mockRestore()
      consoleDebugSpy.mockRestore()
    })

    it('log()は開発環境でconsole.logを呼び出す', async () => {
      const { logger } = await import('@/lib/logger')
      logger.log('test message', { data: 'value' })

      expect(consoleLogSpy).toHaveBeenCalledWith('test message', { data: 'value' })
    })

    it('warn()は開発環境でconsole.warnを呼び出す', async () => {
      const { logger } = await import('@/lib/logger')
      logger.warn('warning message')

      expect(consoleWarnSpy).toHaveBeenCalledWith('warning message')
    })

    it('error()は開発環境でconsole.errorを呼び出す', async () => {
      const { logger } = await import('@/lib/logger')
      logger.error('error message', new Error('test error'))

      expect(consoleErrorSpy).toHaveBeenCalledWith('error message', expect.any(Error))
    })

    it('debug()は開発環境でconsole.debugを[DEBUG]プレフィックス付きで呼び出す', async () => {
      const { logger } = await import('@/lib/logger')
      logger.debug('debug message', { key: 'value' })

      expect(consoleDebugSpy).toHaveBeenCalledWith('[DEBUG]', 'debug message', { key: 'value' })
    })

    it('複数の引数を渡せる', async () => {
      const { logger } = await import('@/lib/logger')
      logger.log('arg1', 'arg2', 'arg3', 123, { obj: true })

      expect(consoleLogSpy).toHaveBeenCalledWith('arg1', 'arg2', 'arg3', 123, { obj: true })
    })
  })

  describe('Production Environment', () => {
    let consoleLogSpy: jest.SpyInstance
    let consoleWarnSpy: jest.SpyInstance
    let consoleDebugSpy: jest.SpyInstance

    beforeEach(() => {
      jest.resetModules()
      process.env.NODE_ENV = 'production'
      consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()
      consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()
      consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation()
    })

    afterEach(() => {
      consoleLogSpy.mockRestore()
      consoleWarnSpy.mockRestore()
      consoleDebugSpy.mockRestore()
    })

    it('log()は本番環境ではconsole.logを呼び出さない', async () => {
      const { logger } = await import('@/lib/logger')
      logger.log('test message')

      expect(consoleLogSpy).not.toHaveBeenCalled()
    })

    it('warn()は本番環境ではconsole.warnを呼び出さない', async () => {
      const { logger } = await import('@/lib/logger')
      logger.warn('warning message')

      expect(consoleWarnSpy).not.toHaveBeenCalled()
    })

    it('debug()は本番環境ではconsole.debugを呼び出さない', async () => {
      const { logger } = await import('@/lib/logger')
      logger.debug('debug message')

      expect(consoleDebugSpy).not.toHaveBeenCalled()
    })
  })

  describe('Test Environment', () => {
    let consoleLogSpy: jest.SpyInstance

    beforeEach(() => {
      jest.resetModules()
      process.env.NODE_ENV = 'test'
      consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()
    })

    afterEach(() => {
      consoleLogSpy.mockRestore()
    })

    it('log()はテスト環境ではconsole.logを呼び出さない', async () => {
      const { logger } = await import('@/lib/logger')
      logger.log('test message')

      expect(consoleLogSpy).not.toHaveBeenCalled()
    })
  })

  describe('Default Export', () => {
    beforeEach(() => {
      jest.resetModules()
      process.env.NODE_ENV = 'development'
    })

    it('デフォルトエクスポートも同じloggerオブジェクト', async () => {
      const loggerModule = await import('@/lib/logger')

      expect(loggerModule.default).toBe(loggerModule.logger)
    })
  })
})
