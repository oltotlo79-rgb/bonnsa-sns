// 検索結果キャッシング
// Redisが利用可能な場合は使用、なければインメモリキャッシュ

import { getRedisClient } from './redis'

interface CacheOptions {
  ttlSeconds?: number
}

const DEFAULT_TTL = 300 // 5分

/**
 * 検索結果をキャッシュ
 */
export async function cacheSearchResult<T>(
  key: string,
  data: T,
  options: CacheOptions = {}
): Promise<void> {
  const { ttlSeconds = DEFAULT_TTL } = options
  const redis = getRedisClient()
  const cacheKey = `search:${key}`

  try {
    await redis.set(cacheKey, JSON.stringify(data), { ex: ttlSeconds })
  } catch (error) {
    console.error('Cache set error:', error)
  }
}

/**
 * キャッシュから検索結果を取得
 */
export async function getCachedSearchResult<T>(key: string): Promise<T | null> {
  const redis = getRedisClient()
  const cacheKey = `search:${key}`

  try {
    const data = await redis.get(cacheKey)
    if (!data) return null
    return JSON.parse(data) as T
  } catch (error) {
    console.error('Cache get error:', error)
    return null
  }
}

/**
 * キャッシュを無効化
 */
export async function invalidateSearchCache(pattern?: string): Promise<void> {
  // パターン指定での削除はRedis側での実装が複雑なため、
  // 個別キーの削除のみサポート
  if (pattern) {
    const redis = getRedisClient()
    const key = `search:${pattern}`
    try {
      await redis.del(key)
    } catch (error) {
      console.error('Cache invalidation error:', error)
    }
  }
}

/**
 * 検索クエリからキャッシュキーを生成
 */
export function generateSearchCacheKey(params: {
  type: 'posts' | 'users' | 'shops' | 'events'
  query?: string
  genreId?: string
  page?: number
  limit?: number
  sortBy?: string
}): string {
  const parts: string[] = [params.type]

  if (params.query) {
    parts.push(`q:${params.query.toLowerCase().trim()}`)
  }
  if (params.genreId) {
    parts.push(`g:${params.genreId}`)
  }
  if (params.page) {
    parts.push(`p:${params.page}`)
  }
  if (params.limit) {
    parts.push(`l:${params.limit}`)
  }
  if (params.sortBy) {
    parts.push(`s:${params.sortBy}`)
  }

  return parts.join(':')
}

/**
 * キャッシュ付き検索実行
 */
export async function cachedSearch<T>(
  cacheKey: string,
  searchFn: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  // キャッシュからの取得を試行
  const cached = await getCachedSearchResult<T>(cacheKey)
  if (cached !== null) {
    return cached
  }

  // キャッシュミス時は検索実行
  const result = await searchFn()

  // 結果をキャッシュ
  await cacheSearchResult(cacheKey, result, options)

  return result
}
