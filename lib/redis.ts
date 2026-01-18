// Redis クライアント設定
// 本番環境では Redis を使用、開発環境ではインメモリフォールバック

interface RedisLikeStore {
  get(key: string): Promise<string | null>
  set(key: string, value: string, options?: { ex?: number }): Promise<void>
  del(key: string): Promise<void>
  incr(key: string): Promise<number>
  expire(key: string, seconds: number): Promise<void>
  ttl(key: string): Promise<number>
}

// インメモリストア（開発/テスト用フォールバック）
class InMemoryStore implements RedisLikeStore {
  private store = new Map<string, { value: string; expiresAt: number | null }>()

  private cleanExpired() {
    const now = Date.now()
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt && entry.expiresAt < now) {
        this.store.delete(key)
      }
    }
  }

  async get(key: string): Promise<string | null> {
    this.cleanExpired()
    const entry = this.store.get(key)
    if (!entry) return null
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.store.delete(key)
      return null
    }
    return entry.value
  }

  async set(key: string, value: string, options?: { ex?: number }): Promise<void> {
    const expiresAt = options?.ex ? Date.now() + options.ex * 1000 : null
    this.store.set(key, { value, expiresAt })
  }

  async del(key: string): Promise<void> {
    this.store.delete(key)
  }

  async incr(key: string): Promise<number> {
    const entry = this.store.get(key)
    const currentValue = entry ? parseInt(entry.value, 10) || 0 : 0
    const newValue = currentValue + 1
    this.store.set(key, { value: newValue.toString(), expiresAt: entry?.expiresAt ?? null })
    return newValue
  }

  async expire(key: string, seconds: number): Promise<void> {
    const entry = this.store.get(key)
    if (entry) {
      entry.expiresAt = Date.now() + seconds * 1000
    }
  }

  async ttl(key: string): Promise<number> {
    const entry = this.store.get(key)
    if (!entry || !entry.expiresAt) return -1
    const remaining = Math.ceil((entry.expiresAt - Date.now()) / 1000)
    return remaining > 0 ? remaining : -2
  }
}

// Upstash Redis クライアント（本番用）
class UpstashRedisStore implements RedisLikeStore {
  private baseUrl: string
  private token: string

  constructor(url: string, token: string) {
    this.baseUrl = url
    this.token = token
  }

  private async command<T>(cmd: string[]): Promise<T> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000) // 5秒タイムアウト

    try {
      const response = await fetch(`${this.baseUrl}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(cmd),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`Redis command failed: ${response.statusText}`)
      }

      const data = await response.json()
      return data.result as T
    } catch (error) {
      clearTimeout(timeoutId)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Redis request timed out')
      }
      throw error
    }
  }

  async get(key: string): Promise<string | null> {
    return this.command<string | null>(['GET', key])
  }

  async set(key: string, value: string, options?: { ex?: number }): Promise<void> {
    if (options?.ex) {
      await this.command(['SET', key, value, 'EX', options.ex.toString()])
    } else {
      await this.command(['SET', key, value])
    }
  }

  async del(key: string): Promise<void> {
    await this.command(['DEL', key])
  }

  async incr(key: string): Promise<number> {
    return this.command<number>(['INCR', key])
  }

  async expire(key: string, seconds: number): Promise<void> {
    await this.command(['EXPIRE', key, seconds.toString()])
  }

  async ttl(key: string): Promise<number> {
    return this.command<number>(['TTL', key])
  }
}

// シングルトンインスタンス
let redisClient: RedisLikeStore | null = null

export function getRedisClient(): RedisLikeStore {
  if (redisClient) return redisClient

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN

  if (redisUrl && redisToken) {
    console.log('Using Upstash Redis')
    redisClient = new UpstashRedisStore(redisUrl, redisToken)
  } else {
    console.log('Using in-memory store (Redis not configured)')
    redisClient = new InMemoryStore()
  }

  return redisClient
}

// 便利なエクスポート
export const redis = {
  get client() {
    return getRedisClient()
  },
}
