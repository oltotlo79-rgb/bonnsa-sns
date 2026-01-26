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
  incr: jest.fn(),
  ttl: jest.fn(),
  expire: jest.fn(),
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
  rateLimit,
  getClientIp,
  checkRateLimit,
  checkDailyLimit,
  checkUserRateLimit,
  RATE_LIMITS,
  DAILY_LIMITS,
} from '@/lib/rate-limit'

describe('Rate Limit Module', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('rateLimit', () => {
    const options = { windowMs: 60000, maxRequests: 10 }

    it('新しいウィンドウでは許可する', async () => {
      mockRedis.get.mockResolvedValue(null)
      mockRedis.ttl.mockResolvedValue(-2)
      mockRedis.set.mockResolvedValue(undefined)

      const result = await rateLimit('test-key', options)

      expect(result.success).toBe(true)
      expect(result.remaining).toBe(9)
      expect(mockRedis.set).toHaveBeenCalledWith('ratelimit:test-key', '1', { ex: 60 })
    })

    it('制限内であれば許可する', async () => {
      mockRedis.get.mockResolvedValue('5')
      mockRedis.ttl.mockResolvedValue(30)
      mockRedis.incr.mockResolvedValue(6)

      const result = await rateLimit('test-key', options)

      expect(result.success).toBe(true)
      expect(result.remaining).toBe(4) // 10 - 6 = 4
    })

    it('制限に達した場合は拒否する', async () => {
      mockRedis.get.mockResolvedValue('10')
      mockRedis.ttl.mockResolvedValue(30)

      const result = await rateLimit('test-key', options)

      expect(result.success).toBe(false)
      expect(result.remaining).toBe(0)
    })

    it('制限を超えた場合も拒否する', async () => {
      mockRedis.get.mockResolvedValue('15')
      mockRedis.ttl.mockResolvedValue(30)

      const result = await rateLimit('test-key', options)

      expect(result.success).toBe(false)
      expect(result.remaining).toBe(0)
    })

    it('TTLが負の場合は新しいウィンドウを開始する', async () => {
      mockRedis.get.mockResolvedValue('5')
      mockRedis.ttl.mockResolvedValue(-1)
      mockRedis.set.mockResolvedValue(undefined)

      const result = await rateLimit('test-key', options)

      expect(result.success).toBe(true)
      expect(result.remaining).toBe(9)
    })

    it('Redisエラー時はフェイルオープンで許可する', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis connection failed'))

      const result = await rateLimit('test-key', options)

      expect(result.success).toBe(true)
      expect(result.remaining).toBe(10)
    })

    it('resetTimeを正しく計算する', async () => {
      const now = Date.now()
      mockRedis.get.mockResolvedValue('5')
      mockRedis.ttl.mockResolvedValue(30)
      mockRedis.incr.mockResolvedValue(6)

      const result = await rateLimit('test-key', options)

      expect(result.resetTime).toBeGreaterThanOrEqual(now + 29000)
      expect(result.resetTime).toBeLessThanOrEqual(now + 31000)
    })
  })

  describe('getClientIp', () => {
    function createMockRequest(headers: Record<string, string>): Request {
      return {
        headers: {
          get: (name: string) => headers[name.toLowerCase()] || null,
        },
      } as unknown as Request
    }

    it('cf-connecting-ipヘッダーを優先する', () => {
      const request = createMockRequest({
        'cf-connecting-ip': '1.2.3.4',
        'x-forwarded-for': '5.6.7.8',
        'x-real-ip': '9.10.11.12',
      })

      expect(getClientIp(request)).toBe('1.2.3.4')
    })

    it('x-forwarded-forの最初のIPを取得する', () => {
      const request = createMockRequest({
        'x-forwarded-for': '1.2.3.4, 5.6.7.8, 9.10.11.12',
      })

      expect(getClientIp(request)).toBe('1.2.3.4')
    })

    it('x-real-ipヘッダーを取得する', () => {
      const request = createMockRequest({
        'x-real-ip': '1.2.3.4',
      })

      expect(getClientIp(request)).toBe('1.2.3.4')
    })

    it('ヘッダーがない場合はunknownを返す', () => {
      const request = createMockRequest({})

      expect(getClientIp(request)).toBe('unknown')
    })

    it('x-forwarded-forの空白をトリムする', () => {
      const request = createMockRequest({
        'x-forwarded-for': '  1.2.3.4  , 5.6.7.8',
      })

      expect(getClientIp(request)).toBe('1.2.3.4')
    })
  })

  describe('checkRateLimit', () => {
    function createMockRequest(ip: string): Request {
      return {
        headers: {
          get: (name: string) => (name === 'x-real-ip' ? ip : null),
        },
      } as unknown as Request
    }

    it('プリセット設定でレート制限をチェックする', async () => {
      mockRedis.get.mockResolvedValue(null)
      mockRedis.ttl.mockResolvedValue(-2)
      mockRedis.set.mockResolvedValue(undefined)

      const request = createMockRequest('192.168.1.1')
      const result = await checkRateLimit(request, 'api')

      expect(result.success).toBe(true)
      expect(mockRedis.set).toHaveBeenCalledWith(
        'ratelimit:api:192.168.1.1',
        '1',
        { ex: 60 }
      )
    })

    it('additionalKeyを含めてキーを生成する', async () => {
      mockRedis.get.mockResolvedValue(null)
      mockRedis.ttl.mockResolvedValue(-2)
      mockRedis.set.mockResolvedValue(undefined)

      const request = createMockRequest('192.168.1.1')
      await checkRateLimit(request, 'upload', 'user123')

      expect(mockRedis.set).toHaveBeenCalledWith(
        'ratelimit:upload:192.168.1.1:user123',
        '1',
        { ex: 60 }
      )
    })
  })

  describe('checkDailyLimit', () => {
    it('制限内であれば許可する', async () => {
      mockRedis.get.mockResolvedValue('10')
      mockRedis.incr.mockResolvedValue(11)
      mockRedis.ttl.mockResolvedValue(1000)

      const result = await checkDailyLimit('user123', 'upload')

      expect(result.allowed).toBe(true)
      expect(result.count).toBe(11)
      expect(result.limit).toBe(50)
    })

    it('制限に達した場合は拒否する', async () => {
      mockRedis.get.mockResolvedValue('50')

      const result = await checkDailyLimit('user123', 'upload')

      expect(result.allowed).toBe(false)
      expect(result.count).toBe(50)
      expect(result.limit).toBe(50)
    })

    it('初回使用時はカウント1から開始する', async () => {
      mockRedis.get.mockResolvedValue(null)
      mockRedis.incr.mockResolvedValue(1)
      mockRedis.ttl.mockResolvedValue(-1)
      mockRedis.expire.mockResolvedValue(undefined)

      const result = await checkDailyLimit('user123', 'upload')

      expect(result.allowed).toBe(true)
      expect(result.count).toBe(1)
    })

    it('TTLが未設定の場合は24時間を設定する', async () => {
      mockRedis.get.mockResolvedValue(null)
      mockRedis.incr.mockResolvedValue(1)
      mockRedis.ttl.mockResolvedValue(-1)
      mockRedis.expire.mockResolvedValue(undefined)

      await checkDailyLimit('user123', 'upload')

      expect(mockRedis.expire).toHaveBeenCalledWith(
        expect.stringContaining('daily:upload:user123:'),
        24 * 60 * 60
      )
    })

    it('Redisエラー時はフェイルオープンで許可する', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis error'))

      const result = await checkDailyLimit('user123', 'upload')

      expect(result.allowed).toBe(true)
      expect(result.count).toBe(0)
    })
  })

  describe('checkUserRateLimit', () => {
    it('ユーザーIDベースでレート制限をチェックする', async () => {
      mockRedis.get.mockResolvedValue(null)
      mockRedis.ttl.mockResolvedValue(-2)
      mockRedis.set.mockResolvedValue(undefined)

      const result = await checkUserRateLimit('user123', 'post')

      expect(result.success).toBe(true)
      expect(mockRedis.set).toHaveBeenCalledWith(
        'ratelimit:post:user:user123',
        '1',
        { ex: 60 }
      )
    })

    it('プリセット設定の制限値を適用する', async () => {
      mockRedis.get.mockResolvedValue('3')
      mockRedis.ttl.mockResolvedValue(30)

      const result = await checkUserRateLimit('user123', 'post')

      // post制限は1分3回
      expect(result.success).toBe(false)
      expect(result.remaining).toBe(0)
    })
  })

  describe('RATE_LIMITS', () => {
    it('各プリセットが定義されている', () => {
      expect(RATE_LIMITS.api).toEqual({ windowMs: 60000, maxRequests: 60 })
      expect(RATE_LIMITS.login).toEqual({ windowMs: 15 * 60 * 1000, maxRequests: 5 })
      expect(RATE_LIMITS.register).toEqual({ windowMs: 60 * 60 * 1000, maxRequests: 3 })
      expect(RATE_LIMITS.passwordReset).toEqual({ windowMs: 60 * 60 * 1000, maxRequests: 3 })
      expect(RATE_LIMITS.upload).toEqual({ windowMs: 60000, maxRequests: 5 })
      expect(RATE_LIMITS.search).toEqual({ windowMs: 60000, maxRequests: 20 })
      expect(RATE_LIMITS.comment).toEqual({ windowMs: 60000, maxRequests: 5 })
      expect(RATE_LIMITS.post).toEqual({ windowMs: 60000, maxRequests: 3 })
      expect(RATE_LIMITS.engagement).toEqual({ windowMs: 60000, maxRequests: 30 })
      expect(RATE_LIMITS.timeline).toEqual({ windowMs: 60000, maxRequests: 30 })
    })
  })

  describe('DAILY_LIMITS', () => {
    it('日次制限が定義されている', () => {
      expect(DAILY_LIMITS.upload).toBe(50)
    })
  })
})
