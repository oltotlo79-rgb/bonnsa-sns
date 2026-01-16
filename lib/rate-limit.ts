// シンプルなインメモリレート制限
// 注意: 本番環境では Redis などの分散キャッシュを使用することを推奨

interface RateLimitEntry {
  count: number
  resetTime: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

// 古いエントリをクリーンアップ（メモリリーク防止）
const cleanupInterval = setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key)
    }
  }
}, 60000) // 1分ごとにクリーンアップ

// Node.js終了時にクリーンアップ
if (typeof process !== 'undefined') {
  process.on('exit', () => clearInterval(cleanupInterval))
}

interface RateLimitOptions {
  windowMs: number      // 時間窓（ミリ秒）
  maxRequests: number   // 最大リクエスト数
}

interface RateLimitResult {
  success: boolean
  remaining: number
  resetTime: number
}

export function rateLimit(
  identifier: string,
  options: RateLimitOptions
): RateLimitResult {
  const { windowMs, maxRequests } = options
  const now = Date.now()
  const key = identifier

  const entry = rateLimitStore.get(key)

  // 新しいエントリまたは期限切れの場合
  if (!entry || entry.resetTime < now) {
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + windowMs,
    })
    return {
      success: true,
      remaining: maxRequests - 1,
      resetTime: now + windowMs,
    }
  }

  // 制限内の場合
  if (entry.count < maxRequests) {
    entry.count++
    return {
      success: true,
      remaining: maxRequests - entry.count,
      resetTime: entry.resetTime,
    }
  }

  // 制限超過
  return {
    success: false,
    remaining: 0,
    resetTime: entry.resetTime,
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
export function checkRateLimit(
  request: Request,
  limitType: keyof typeof RATE_LIMITS,
  additionalKey?: string
): RateLimitResult {
  const ip = getClientIp(request)
  const key = additionalKey ? `${limitType}:${ip}:${additionalKey}` : `${limitType}:${ip}`
  return rateLimit(key, RATE_LIMITS[limitType])
}
