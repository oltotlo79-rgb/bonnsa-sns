/**
 * CSRF保護ユーティリティのテスト
 *
 * @module __tests__/lib/csrf.test
 */

import { generateCsrfToken, verifyCsrfToken } from '@/lib/csrf'

// headers()モック
const mockHeaders = jest.fn()
jest.mock('next/headers', () => ({
  headers: () => mockHeaders(),
}))

describe('csrf', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = { ...originalEnv }
    process.env.NEXTAUTH_SECRET = 'test-secret-key-for-csrf-testing-32chars'
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('generateCsrfToken', () => {
    it('セッションIDからCSRFトークンを生成する', () => {
      const sessionId = 'test-session-123'
      const token = generateCsrfToken(sessionId)

      expect(token).toBeTruthy()
      expect(typeof token).toBe('string')
      expect(token.length).toBe(64) // SHA-256 hex = 64 chars
    })

    it('同じセッションIDからは同じトークンを生成する', () => {
      const sessionId = 'test-session-123'
      const token1 = generateCsrfToken(sessionId)
      const token2 = generateCsrfToken(sessionId)

      expect(token1).toBe(token2)
    })

    it('異なるセッションIDからは異なるトークンを生成する', () => {
      const token1 = generateCsrfToken('session-1')
      const token2 = generateCsrfToken('session-2')

      expect(token1).not.toBe(token2)
    })
  })

  describe('verifyCsrfToken', () => {
    it('正しいトークンを検証できる', () => {
      const sessionId = 'test-session-456'
      const token = generateCsrfToken(sessionId)

      const result = verifyCsrfToken(token, sessionId)

      expect(result).toBe(true)
    })

    it('不正なトークンを拒否する', () => {
      const sessionId = 'test-session-456'
      const wrongToken = 'invalid-token-' + 'x'.repeat(50)

      const result = verifyCsrfToken(wrongToken, sessionId)

      expect(result).toBe(false)
    })

    it('異なるセッションIDのトークンを拒否する', () => {
      const token = generateCsrfToken('session-1')

      const result = verifyCsrfToken(token, 'session-2')

      expect(result).toBe(false)
    })

    it('長さの異なるトークンでエラーをスローする', () => {
      const sessionId = 'test-session'
      const shortToken = 'short'

      expect(() => verifyCsrfToken(shortToken, sessionId)).toThrow()
    })
  })
})
