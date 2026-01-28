/**
 * @jest-environment node
 */

// グローバルモックを解除
jest.unmock('@/lib/logger')

// Redisモック
const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
}

jest.mock('@/lib/redis', () => ({
  getRedisClient: () => mockRedis,
}))

// Loggerモック
jest.mock('@/lib/logger', () => ({
  __esModule: true,
  default: {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}))

import {
  checkLoginAttempt,
  recordFailedLogin,
  resetLoginAttempts,
  getLoginKey,
} from '@/lib/login-tracker'

describe('Login Tracker Module', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getLoginKey', () => {
    it('IPとメールを組み合わせたキーを生成する', () => {
      const key = getLoginKey('192.168.1.1', 'user@example.com')
      expect(key).toBe('192.168.1.1:user@example.com')
    })

    it('メールアドレスを小文字に正規化する', () => {
      const key = getLoginKey('192.168.1.1', 'User@Example.COM')
      expect(key).toBe('192.168.1.1:user@example.com')
    })
  })

  describe('checkLoginAttempt', () => {
    it('新規ユーザーには最大試行回数を許可する', async () => {
      mockRedis.get.mockResolvedValue(null)

      const result = await checkLoginAttempt('test-identifier')

      expect(result.allowed).toBe(true)
      expect(result.remainingAttempts).toBe(5)
      expect(result.lockedUntil).toBeNull()
    })

    it('試行回数に余裕がある場合は許可する', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({ count: 2, lockedUntil: null }))

      const result = await checkLoginAttempt('test-identifier')

      expect(result.allowed).toBe(true)
      expect(result.remainingAttempts).toBe(3)
      expect(result.lockedUntil).toBeNull()
    })

    it('試行回数が上限に達した場合は拒否する', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({ count: 5, lockedUntil: null }))

      const result = await checkLoginAttempt('test-identifier')

      expect(result.allowed).toBe(false)
      expect(result.remainingAttempts).toBe(0)
      expect(result.message).toContain('上限に達しました')
    })

    it('ロックアウト中は拒否する', async () => {
      const lockedUntil = Date.now() + 30 * 60 * 1000 // 30分後
      mockRedis.get.mockResolvedValue(JSON.stringify({ count: 5, lockedUntil }))

      const result = await checkLoginAttempt('test-identifier')

      expect(result.allowed).toBe(false)
      expect(result.remainingAttempts).toBe(0)
      expect(result.lockedUntil).toBe(lockedUntil)
      expect(result.message).toContain('ロックされています')
    })

    it('ロックアウト期限切れの場合は拒否する（カウントはまだ残っている）', async () => {
      const lockedUntil = Date.now() - 1000 // 1秒前（期限切れ）
      mockRedis.get.mockResolvedValue(JSON.stringify({ count: 5, lockedUntil }))

      const result = await checkLoginAttempt('test-identifier')

      // カウントが5なので拒否
      expect(result.allowed).toBe(false)
    })

    it('Redisエラー時はフェイルオープンで許可する', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis connection failed'))

      const result = await checkLoginAttempt('test-identifier')

      expect(result.allowed).toBe(true)
      expect(result.remainingAttempts).toBe(5)
    })

    it('不正なJSONデータの場合は新規ユーザーとして扱う', async () => {
      mockRedis.get.mockResolvedValue('invalid json')

      const result = await checkLoginAttempt('test-identifier')

      expect(result.allowed).toBe(true)
      expect(result.remainingAttempts).toBe(5)
    })
  })

  describe('recordFailedLogin', () => {
    it('初回失敗時はカウント1で記録する', async () => {
      mockRedis.get.mockResolvedValue(null)
      mockRedis.set.mockResolvedValue(undefined)

      const result = await recordFailedLogin('test-identifier')

      expect(result.allowed).toBe(true)
      expect(result.remainingAttempts).toBe(4)
      expect(mockRedis.set).toHaveBeenCalledWith(
        'login_attempt:test-identifier',
        JSON.stringify({ count: 1, lockedUntil: null }),
        { ex: 15 * 60 }
      )
    })

    it('失敗時にカウントをインクリメントする', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({ count: 2, lockedUntil: null }))
      mockRedis.set.mockResolvedValue(undefined)

      const result = await recordFailedLogin('test-identifier')

      expect(result.allowed).toBe(true)
      expect(result.remainingAttempts).toBe(2) // 5 - 3 = 2
    })

    it('上限に達した場合はロックアウトを設定する', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({ count: 4, lockedUntil: null }))
      mockRedis.set.mockResolvedValue(undefined)

      const result = await recordFailedLogin('test-identifier')

      expect(result.allowed).toBe(false)
      expect(result.remainingAttempts).toBe(0)
      expect(result.lockedUntil).toBeDefined()
      expect(result.message).toContain('30分後')
    })

    it('Redisエラー時はフェイルオープンで許可する', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis error'))

      const result = await recordFailedLogin('test-identifier')

      expect(result.allowed).toBe(true)
      expect(result.remainingAttempts).toBe(4)
    })
  })

  describe('resetLoginAttempts', () => {
    it('ログイン成功時にカウンターを削除する', async () => {
      mockRedis.del.mockResolvedValue(undefined)

      await resetLoginAttempts('test-identifier')

      expect(mockRedis.del).toHaveBeenCalledWith('login_attempt:test-identifier')
    })

    it('Redisエラー時でもエラーをスローしない', async () => {
      mockRedis.del.mockRejectedValue(new Error('Redis error'))

      // エラーがスローされないことを確認
      await expect(resetLoginAttempts('test-identifier')).resolves.toBeUndefined()
    })
  })

  describe('Integration Scenarios', () => {
    it('連続失敗後にロックアウトされる', async () => {
      // 1回目の失敗
      mockRedis.get.mockResolvedValueOnce(null)
      mockRedis.set.mockResolvedValue(undefined)
      let result = await recordFailedLogin('user-1')
      expect(result.remainingAttempts).toBe(4)

      // 2回目の失敗
      mockRedis.get.mockResolvedValueOnce(JSON.stringify({ count: 1, lockedUntil: null }))
      result = await recordFailedLogin('user-1')
      expect(result.remainingAttempts).toBe(3)

      // 3回目の失敗
      mockRedis.get.mockResolvedValueOnce(JSON.stringify({ count: 2, lockedUntil: null }))
      result = await recordFailedLogin('user-1')
      expect(result.remainingAttempts).toBe(2)

      // 4回目の失敗
      mockRedis.get.mockResolvedValueOnce(JSON.stringify({ count: 3, lockedUntil: null }))
      result = await recordFailedLogin('user-1')
      expect(result.remainingAttempts).toBe(1)

      // 5回目の失敗でロックアウト
      mockRedis.get.mockResolvedValueOnce(JSON.stringify({ count: 4, lockedUntil: null }))
      result = await recordFailedLogin('user-1')
      expect(result.allowed).toBe(false)
      expect(result.remainingAttempts).toBe(0)
    })
  })
})
