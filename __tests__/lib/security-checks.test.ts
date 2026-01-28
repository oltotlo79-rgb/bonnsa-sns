/**
 * セキュリティチェックユーティリティのテスト
 *
 * @module __tests__/lib/security-checks.test
 */

import {
  validateAuthSecret,
  validateRequiredEnvVars,
  runSecurityChecks,
  logSecurityWarnings,
  enforceSecurityInProduction,
} from '@/lib/security-checks'

describe('security-checks', () => {
  const originalEnv = process.env
  const consoleWarn = console.warn
  const consoleError = console.error

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = { ...originalEnv }
    console.warn = jest.fn()
    console.error = jest.fn()
  })

  afterEach(() => {
    process.env = originalEnv
    console.warn = consoleWarn
    console.error = consoleError
  })

  describe('validateAuthSecret', () => {
    it('適切なシークレットで有効を返す', () => {
      process.env.NEXTAUTH_SECRET = 'a'.repeat(32) + 'b'.repeat(10) + 'c'.repeat(10)
      process.env.NODE_ENV = 'development'

      const result = validateAuthSecret()

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('シークレット未設定で警告を返す（開発環境）', () => {
      delete process.env.NEXTAUTH_SECRET
      process.env.NODE_ENV = 'development'

      const result = validateAuthSecret()

      expect(result.valid).toBe(true)
      expect(result.warnings).toContain('NEXTAUTH_SECRET が設定されていません。')
    })

    it('シークレット未設定でエラーを返す（本番環境）', () => {
      delete process.env.NEXTAUTH_SECRET
      process.env.NODE_ENV = 'production'

      const result = validateAuthSecret()

      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('短いシークレットで警告を返す', () => {
      process.env.NEXTAUTH_SECRET = 'short'
      process.env.NODE_ENV = 'development'

      const result = validateAuthSecret()

      expect(result.warnings.some(w => w.includes('短すぎ'))).toBe(true)
    })

    it('弱いパターンを検出する', () => {
      process.env.NEXTAUTH_SECRET = 'my-secret-password-for-testing-long-enough'
      process.env.NODE_ENV = 'development'

      const result = validateAuthSecret()

      expect(result.warnings.some(w => w.includes('弱いパターン'))).toBe(true)
    })

    it('本番環境で短いシークレットはエラー', () => {
      process.env.NEXTAUTH_SECRET = 'short'
      process.env.NODE_ENV = 'production'

      const result = validateAuthSecret()

      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('短すぎ'))).toBe(true)
    })

    it('低エントロピーを警告する', () => {
      process.env.NEXTAUTH_SECRET = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
      process.env.NODE_ENV = 'production'

      const result = validateAuthSecret()

      expect(result.warnings.some(w => w.includes('エントロピー'))).toBe(true)
    })
  })

  describe('validateRequiredEnvVars', () => {
    it('必須環境変数が設定されていれば有効', () => {
      process.env.DATABASE_URL = 'postgres://localhost:5432/test'
      process.env.NODE_ENV = 'development'

      const result = validateRequiredEnvVars()

      expect(result.valid).toBe(true)
      expect(result.missing).toHaveLength(0)
    })

    it('本番環境で必須変数が不足していれば報告', () => {
      delete process.env.DATABASE_URL
      delete process.env.NEXTAUTH_URL
      delete process.env.NEXTAUTH_SECRET
      process.env.NODE_ENV = 'production'

      const result = validateRequiredEnvVars()

      expect(result.valid).toBe(false)
      expect(result.missing).toContain('DATABASE_URL')
      expect(result.missing).toContain('NEXTAUTH_URL')
      expect(result.missing).toContain('NEXTAUTH_SECRET')
    })

    it('開発環境ではDATABASE_URLのみ必須', () => {
      delete process.env.DATABASE_URL
      process.env.NODE_ENV = 'development'

      const result = validateRequiredEnvVars()

      expect(result.valid).toBe(false)
      expect(result.missing).toContain('DATABASE_URL')
    })
  })

  describe('runSecurityChecks', () => {
    it('すべてのチェックを実行する', () => {
      process.env.NEXTAUTH_SECRET = 'x'.repeat(50) + 'y'.repeat(10)
      process.env.DATABASE_URL = 'postgres://localhost:5432/test'
      process.env.NODE_ENV = 'development'

      const result = runSecurityChecks()

      expect(result).toHaveProperty('valid')
      expect(result).toHaveProperty('secretCheck')
      expect(result).toHaveProperty('envCheck')
    })

    it('両方のチェックが有効なら全体も有効', () => {
      process.env.NEXTAUTH_SECRET = 'x'.repeat(50) + 'y'.repeat(10)
      process.env.DATABASE_URL = 'postgres://localhost:5432/test'
      process.env.NODE_ENV = 'development'

      const result = runSecurityChecks()

      expect(result.valid).toBe(true)
    })

    it('どちらかが無効なら全体も無効', () => {
      delete process.env.DATABASE_URL
      process.env.NODE_ENV = 'development'

      const result = runSecurityChecks()

      expect(result.valid).toBe(false)
    })
  })

  describe('logSecurityWarnings', () => {
    it('警告をコンソールに出力する', () => {
      process.env.NEXTAUTH_SECRET = 'short'
      process.env.DATABASE_URL = 'postgres://localhost:5432/test'
      process.env.NODE_ENV = 'development'

      logSecurityWarnings()

      expect(console.warn).toHaveBeenCalled()
    })

    it('本番環境でHTTP URLを警告する', () => {
      process.env.NEXTAUTH_SECRET = 'x'.repeat(60)
      process.env.DATABASE_URL = 'postgres://localhost:5432/test'
      process.env.NEXTAUTH_URL = 'http://localhost:3000'
      process.env.NEXT_PUBLIC_APP_URL = 'http://example.com'
      process.env.NODE_ENV = 'production'

      logSecurityWarnings()

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('HTTPS')
      )
    })

    it('本番環境でDEBUGモードを警告する', () => {
      process.env.NEXTAUTH_SECRET = 'x'.repeat(60)
      process.env.DATABASE_URL = 'postgres://localhost:5432/test'
      process.env.NEXTAUTH_URL = 'https://example.com'
      process.env.DEBUG = 'true'
      process.env.NODE_ENV = 'production'

      logSecurityWarnings()

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('DEBUG')
      )
    })
  })

  describe('enforceSecurityInProduction', () => {
    it('開発環境では警告のみ', () => {
      process.env.NEXTAUTH_SECRET = 'short'
      process.env.DATABASE_URL = 'postgres://localhost:5432/test'
      process.env.NODE_ENV = 'development'

      expect(() => enforceSecurityInProduction()).not.toThrow()
    })

    it('本番環境でセキュリティエラーをログ出力', () => {
      process.env.NEXTAUTH_SECRET = 'short'
      delete process.env.DATABASE_URL
      process.env.NODE_ENV = 'production'

      enforceSecurityInProduction()

      expect(console.error).toHaveBeenCalled()
    })
  })
})
