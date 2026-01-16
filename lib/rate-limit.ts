// レート制限（Redis対応、インメモリフォールバック付き）
// UPSTASH_REDIS_REST_URL と UPSTASH_REDIS_REST_TOKEN が設定されている場合は Redis を使用

import { getRedisClient } from './redis'

interface RateLimitOptions {
  windowMs: number      // 時間窓（ミリ秒）
  maxRequests: number   // 最大リクエスト数
}

interface RateLimitResult {
  success: boolean
  remaining: number
  resetTime: number
}

export async function rateLimit(
  identifier: string,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const { windowMs, maxRequests } = options
  const redis = getRedisClient()
  const key = `ratelimit:${identifier}`
  const windowSeconds = Math.ceil(windowMs / 1000)

  try {
    // 現在のカウントを取得
    const currentStr = await redis.get(key)
    const ttl = await redis.ttl(key)

    if (!currentStr || ttl < 0) {
      // 新しいウィンドウを開始
      await redis.set(key, '1', { ex: windowSeconds })
      return {
        success: true,
        remaining: maxRequests - 1,
        resetTime: Date.now() + windowMs,
      }
    }

    const current = parseInt(currentStr, 10)

    if (current >= maxRequests) {
      // 制限超過
      return {
        success: false,
        remaining: 0,
        resetTime: Date.now() + ttl * 1000,
      }
    }

    // カウントを増加
    const newCount = await redis.incr(key)
    return {
      success: true,
      remaining: Math.max(0, maxRequests - newCount),
      resetTime: Date.now() + ttl * 1000,
    }
  } catch (error) {
    console.error('Rate limit error:', error)
    // Redis エラー時は許可（フェイルオープン）
    return {
      success: true,
      remaining: maxRequests,
      resetTime: Date.now() + windowMs,
    }
  }
}

// プリセット設定
export const RATE_LIMITS = {
  // 一般的なAPI（1分あたり60リクエスト）
  api: { windowMs: 60000, maxRequests: 60 },

  // ログイン試行（15分あたり5回）
  login: { windowMs: 15 * 60 * 1000, maxRequests: 5 },

  // ユーザー登録（1時間あたり3回）
  register: { windowMs: 60 * 60 * 1000, maxRequests: 3 },

  // パスワードリセット（1時間あたり3回）
  passwordReset: { windowMs: 60 * 60 * 1000, maxRequests: 3 },

  // ファイルアップロード（1分あたり10回）
  upload: { windowMs: 60000, maxRequests: 10 },

  // 検索（1分あたり30回）
  search: { windowMs: 60000, maxRequests: 30 },

  // コメント投稿（1分あたり10回）
  comment: { windowMs: 60000, maxRequests: 10 },
} as const

// IPアドレス取得ヘルパー
export function getClientIp(request: Request): string {
  // Cloudflare
  const cfIp = request.headers.get('cf-connecting-ip')
  if (cfIp) return cfIp

  // X-Forwarded-For（プロキシ経由）
  const xForwardedFor = request.headers.get('x-forwarded-for')
  if (xForwardedFor) {
    return xForwardedFor.split(',')[0].trim()
  }

  // X-Real-IP
  const xRealIp = request.headers.get('x-real-ip')
  if (xRealIp) return xRealIp

  // フォールバック
  return 'unknown'
}

// レート制限チェック用ヘルパー
export async function checkRateLimit(
  request: Request,
  limitType: keyof typeof RATE_LIMITS,
  additionalKey?: string
): Promise<RateLimitResult> {
  const ip = getClientIp(request)
  const key = additionalKey ? `${limitType}:${ip}:${additionalKey}` : `${limitType}:${ip}`
  return rateLimit(key, RATE_LIMITS[limitType])
}
