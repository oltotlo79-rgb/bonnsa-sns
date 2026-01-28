/**
 * Redisクライアントのテスト
 *
 * @jest-environment node
 */

// Upstash Redisのモック
const mockRedisGet = jest.fn()
const mockRedisSet = jest.fn()
const mockRedisDel = jest.fn()
const mockRedisIncr = jest.fn()
const mockRedisExpire = jest.fn()
const mockRedisTtl = jest.fn()

jest.mock('@upstash/redis', () => ({
  Redis: jest.fn().mockImplementation(() => ({
    get: mockRedisGet,
    set: mockRedisSet,
    del: mockRedisDel,
    incr: mockRedisIncr,
    expire: mockRedisExpire,
    ttl: mockRedisTtl,
  })),
}))

// loggerのモック
jest.mock('@/lib/logger', () => ({
  __esModule: true,
  default: {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}))

describe('redis', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
    process.env = { ...originalEnv }
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN
  })

  afterAll(() => {
    process.env = originalEnv
  })

  // ============================================================
  // InMemoryStore Tests
  // ============================================================

  describe('InMemoryStore (Redis未設定時)', () => {
    it('getRedisClient()がインメモリストアを返す', async () => {
      const { getRedisClient } = await import('@/lib/redis')
      const client = getRedisClient()

      expect(client).toBeDefined()
      expect(client.get).toBeDefined()
      expect(client.set).toBeDefined()
    })

    it('同じインスタンスを返す（シングルトン）', async () => {
      const { getRedisClient } = await import('@/lib/redis')
      const client1 = getRedisClient()
      const client2 = getRedisClient()

      expect(client1).toBe(client2)
    })

    describe('set/get', () => {
      it('値を保存して取得できる', async () => {
        const { getRedisClient } = await import('@/lib/redis')
        const client = getRedisClient()

        await client.set('test-key', 'test-value')
        const result = await client.get('test-key')

        expect(result).toBe('test-value')
      })

      it('存在しないキーはnullを返す', async () => {
        const { getRedisClient } = await import('@/lib/redis')
        const client = getRedisClient()

        const result = await client.get('non-existent-key')

        expect(result).toBeNull()
      })

      it('有効期限付きで保存できる', async () => {
        const { getRedisClient } = await import('@/lib/redis')
        const client = getRedisClient()

        await client.set('expiring-key', 'value', { ex: 10 })
        const result = await client.get('expiring-key')

        expect(result).toBe('value')
      })

      it('期限切れのキーはnullを返す', async () => {
        jest.useFakeTimers()
        const { getRedisClient } = await import('@/lib/redis')
        const client = getRedisClient()

        await client.set('expiring-key-2', 'value', { ex: 1 })

        // 2秒後にアクセス
        jest.advanceTimersByTime(2000)

        const result = await client.get('expiring-key-2')
        expect(result).toBeNull()

        jest.useRealTimers()
      })
    })

    describe('del', () => {
      it('キーを削除できる', async () => {
        const { getRedisClient } = await import('@/lib/redis')
        const client = getRedisClient()

        await client.set('delete-key', 'value')
        await client.del('delete-key')
        const result = await client.get('delete-key')

        expect(result).toBeNull()
      })
    })

    describe('incr', () => {
      it('存在しないキーは0から開始して1を返す', async () => {
        const { getRedisClient } = await import('@/lib/redis')
        const client = getRedisClient()

        const result = await client.incr('counter-new')

        expect(result).toBe(1)
      })

      it('既存の値をインクリメントする', async () => {
        const { getRedisClient } = await import('@/lib/redis')
        const client = getRedisClient()

        await client.set('counter-existing', '5')
        const result = await client.incr('counter-existing')

        expect(result).toBe(6)
      })

      it('連続でインクリメントできる', async () => {
        const { getRedisClient } = await import('@/lib/redis')
        const client = getRedisClient()

        const r1 = await client.incr('counter-multi')
        const r2 = await client.incr('counter-multi')
        const r3 = await client.incr('counter-multi')

        expect(r1).toBe(1)
        expect(r2).toBe(2)
        expect(r3).toBe(3)
      })
    })

    describe('expire', () => {
      it('既存キーに有効期限を設定できる', async () => {
        jest.useFakeTimers()
        const { getRedisClient } = await import('@/lib/redis')
        const client = getRedisClient()

        await client.set('expire-key', 'value')
        await client.expire('expire-key', 1)

        // 有効期限前は取得できる
        const before = await client.get('expire-key')
        expect(before).toBe('value')

        // 2秒後は取得できない
        jest.advanceTimersByTime(2000)
        const after = await client.get('expire-key')
        expect(after).toBeNull()

        jest.useRealTimers()
      })

      it('存在しないキーには何もしない', async () => {
        const { getRedisClient } = await import('@/lib/redis')
        const client = getRedisClient()

        // エラーが発生しないことを確認
        await expect(client.expire('non-existent', 10)).resolves.toBeUndefined()
      })
    })

    describe('ttl', () => {
      it('有効期限が設定されていないキーは-1を返す', async () => {
        const { getRedisClient } = await import('@/lib/redis')
        const client = getRedisClient()

        await client.set('no-ttl-key', 'value')
        const ttl = await client.ttl('no-ttl-key')

        expect(ttl).toBe(-1)
      })

      it('存在しないキーは-1を返す', async () => {
        const { getRedisClient } = await import('@/lib/redis')
        const client = getRedisClient()

        const ttl = await client.ttl('non-existent-ttl')

        expect(ttl).toBe(-1)
      })

      it('残りの有効期限を返す', async () => {
        jest.useFakeTimers()
        const { getRedisClient } = await import('@/lib/redis')
        const client = getRedisClient()

        await client.set('ttl-key', 'value', { ex: 60 })
        const ttl = await client.ttl('ttl-key')

        expect(ttl).toBeGreaterThan(50)
        expect(ttl).toBeLessThanOrEqual(60)

        jest.useRealTimers()
      })

      it('期限切れのキーは-2を返す', async () => {
        jest.useFakeTimers()
        const { getRedisClient } = await import('@/lib/redis')
        const client = getRedisClient()

        await client.set('expired-ttl-key', 'value', { ex: 1 })

        // 2秒後
        jest.advanceTimersByTime(2000)
        const ttl = await client.ttl('expired-ttl-key')

        expect(ttl).toBe(-2)

        jest.useRealTimers()
      })
    })
  })

  // ============================================================
  // UpstashRedisStore Tests
  // ============================================================

  describe('UpstashRedisStore (Redis設定時)', () => {
    beforeEach(() => {
      process.env.UPSTASH_REDIS_REST_URL = 'https://test.upstash.io'
      process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token'
    })

    it('Upstash Redisクライアントを使用する', async () => {
      const { Redis } = await import('@upstash/redis')
      const { getRedisClient } = await import('@/lib/redis')

      getRedisClient()

      expect(Redis).toHaveBeenCalledWith({
        url: 'https://test.upstash.io',
        token: 'test-token',
      })
    })

    describe('get', () => {
      it('Redis.getを呼び出す', async () => {
        mockRedisGet.mockResolvedValueOnce('redis-value')

        const { getRedisClient } = await import('@/lib/redis')
        const client = getRedisClient()

        const result = await client.get('redis-key')

        expect(mockRedisGet).toHaveBeenCalledWith('redis-key')
        expect(result).toBe('redis-value')
      })
    })

    describe('set', () => {
      it('有効期限なしでRedis.setを呼び出す', async () => {
        mockRedisSet.mockResolvedValueOnce('OK')

        const { getRedisClient } = await import('@/lib/redis')
        const client = getRedisClient()

        await client.set('redis-key', 'redis-value')

        expect(mockRedisSet).toHaveBeenCalledWith('redis-key', 'redis-value')
      })

      it('有効期限付きでRedis.setを呼び出す', async () => {
        mockRedisSet.mockResolvedValueOnce('OK')

        const { getRedisClient } = await import('@/lib/redis')
        const client = getRedisClient()

        await client.set('redis-key', 'redis-value', { ex: 60 })

        expect(mockRedisSet).toHaveBeenCalledWith('redis-key', 'redis-value', { ex: 60 })
      })
    })

    describe('del', () => {
      it('Redis.delを呼び出す', async () => {
        mockRedisDel.mockResolvedValueOnce(1)

        const { getRedisClient } = await import('@/lib/redis')
        const client = getRedisClient()

        await client.del('redis-key')

        expect(mockRedisDel).toHaveBeenCalledWith('redis-key')
      })
    })

    describe('incr', () => {
      it('Redis.incrを呼び出す', async () => {
        mockRedisIncr.mockResolvedValueOnce(5)

        const { getRedisClient } = await import('@/lib/redis')
        const client = getRedisClient()

        const result = await client.incr('counter')

        expect(mockRedisIncr).toHaveBeenCalledWith('counter')
        expect(result).toBe(5)
      })
    })

    describe('expire', () => {
      it('Redis.expireを呼び出す', async () => {
        mockRedisExpire.mockResolvedValueOnce(1)

        const { getRedisClient } = await import('@/lib/redis')
        const client = getRedisClient()

        await client.expire('redis-key', 120)

        expect(mockRedisExpire).toHaveBeenCalledWith('redis-key', 120)
      })
    })

    describe('ttl', () => {
      it('Redis.ttlを呼び出す', async () => {
        mockRedisTtl.mockResolvedValueOnce(45)

        const { getRedisClient } = await import('@/lib/redis')
        const client = getRedisClient()

        const result = await client.ttl('redis-key')

        expect(mockRedisTtl).toHaveBeenCalledWith('redis-key')
        expect(result).toBe(45)
      })
    })
  })

  // ============================================================
  // redis Export Tests
  // ============================================================

  describe('redis エクスポート', () => {
    it('redis.clientでクライアントにアクセスできる', async () => {
      const { redis } = await import('@/lib/redis')

      expect(redis.client).toBeDefined()
      expect(redis.client.get).toBeDefined()
    })

    it('redis.clientは毎回同じインスタンスを返す', async () => {
      const { redis } = await import('@/lib/redis')

      const client1 = redis.client
      const client2 = redis.client

      expect(client1).toBe(client2)
    })
  })
})
