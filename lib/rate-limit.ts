/**
 * レート制限ユーティリティ
 *
 * このファイルは、APIリクエストのレート制限（回数制限）機能を提供します。
 * スパム防止、DDoS対策、リソース保護のために使用されます。
 *
 * ## レート制限とは？
 * 一定時間内のリクエスト数を制限する仕組み
 * 例: 「1分間に60回まで」「15分間に5回まで」
 *
 * ## なぜレート制限が必要か？
 *
 * ### 1. スパム/ボット対策
 * - 自動化されたスパム投稿を防止
 * - ブルートフォース攻撃（パスワード総当たり）を防止
 *
 * ### 2. サーバーリソース保護
 * - 一人のユーザーがリソースを独占することを防止
 * - サーバーの安定性を維持
 *
 * ### 3. 公平性の確保
 * - すべてのユーザーが公平にサービスを利用できるように
 *
 * ## このファイルの設計
 * - Redisベースのカウンター（分散環境対応）
 * - インメモリフォールバック（開発環境）
 * - プリセット設定による簡単な適用
 *
 * @module lib/rate-limit
 */

// ============================================================
// インポート部分
// ============================================================

/**
 * getRedisClient: Redisクライアント取得関数
 *
 * レート制限のカウンターを保存するために使用
 * Redisが設定されていない場合はインメモリストアにフォールバック
 */
import { getRedisClient } from './redis'

/**
 * logger: 環境対応ロギングユーティリティ
 *
 * エラー発生時のログ出力に使用
 */
import logger from '@/lib/logger'

// ============================================================
// 型定義
// ============================================================

/**
 * レート制限オプション
 *
 * ## windowMs（時間窓）
 * 制限をカウントする期間（ミリ秒）
 * 例: 60000 = 1分
 *
 * ## maxRequests（最大リクエスト数）
 * 時間窓内で許可される最大リクエスト数
 * 例: 60 = 1分間に60回まで
 */
interface RateLimitOptions {
  windowMs: number      // 時間窓（ミリ秒）
  maxRequests: number   // 最大リクエスト数
}

/**
 * レート制限の結果
 *
 * ## success
 * - true: リクエスト許可
 * - false: 制限超過（拒否）
 *
 * ## remaining
 * 時間窓内の残りリクエスト可能数
 *
 * ## resetTime
 * 制限がリセットされる時刻（タイムスタンプ）
 */
interface RateLimitResult {
  success: boolean
  remaining: number
  resetTime: number
}

// ============================================================
// メイン関数
// ============================================================

/**
 * レート制限をチェック
 *
 * ## 機能概要
 * 指定されたキーに対するリクエスト数をカウントし、
 * 制限を超えていないかチェック
 *
 * ## パラメータ
 * @param identifier - 制限の識別子（例: "login:192.168.1.1"）
 * @param options - レート制限オプション
 *
 * ## 戻り値
 * @returns RateLimitResult - 制限チェックの結果
 *
 * ## アルゴリズム（固定ウィンドウ方式）
 * 1. キーの現在のカウントを取得
 * 2. カウントが存在しない場合、新しいウィンドウを開始
 * 3. カウントが制限以上の場合、拒否
 * 4. カウントをインクリメントして許可
 *
 * ## 固定ウィンドウ vs スライディングウィンドウ
 * - 固定ウィンドウ: シンプルだが境界で急増の可能性
 * - スライディングウィンドウ: より正確だが複雑
 * このファイルでは固定ウィンドウを採用（シンプルさ優先）
 *
 * ## 使用例
 * ```typescript
 * const result = await rateLimit('login:192.168.1.1', {
 *   windowMs: 15 * 60 * 1000,  // 15分
 *   maxRequests: 5,             // 5回まで
 * })
 *
 * if (!result.success) {
 *   return new Response('Too many requests', { status: 429 })
 * }
 * ```
 */
export async function rateLimit(
  identifier: string,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const { windowMs, maxRequests } = options
  const redis = getRedisClient()

  /**
   * Redisキーの生成
   *
   * "ratelimit:" プレフィックスを付けて名前空間を分離
   * これにより、他のRedisデータと衝突しない
   */
  const key = `ratelimit:${identifier}`

  /**
   * 秒数への変換
   *
   * RedisのEXPIREコマンドは秒単位
   * Math.ceil: 切り上げ（端数は次の秒に繰り上げ）
   */
  const windowSeconds = Math.ceil(windowMs / 1000)

  try {
    /**
     * 現在のカウントとTTL（残り時間）を取得
     *
     * TTL (Time To Live): キーの残り有効期限
     * - 正の数: 残り秒数
     * - -1: 無期限
     * - -2: キーが存在しない
     */
    const currentStr = await redis.get(key)
    const ttl = await redis.ttl(key)

    /**
     * 新しいウィンドウを開始するケース
     *
     * - currentStr が null: キーが存在しない
     * - ttl < 0: キーが期限切れまたは存在しない
     */
    if (!currentStr || ttl < 0) {
      // 新しいウィンドウを開始
      await redis.set(key, '1', { ex: windowSeconds })
      return {
        success: true,
        remaining: maxRequests - 1,
        resetTime: Date.now() + windowMs,
      }
    }

    /**
     * 現在のカウントを数値に変換
     *
     * parseInt(currentStr, 10): 10進数として解析
     */
    const current = parseInt(currentStr, 10)

    /**
     * 制限超過チェック
     *
     * カウントが最大値以上の場合は拒否
     */
    if (current >= maxRequests) {
      // 制限超過
      return {
        success: false,
        remaining: 0,
        resetTime: Date.now() + ttl * 1000,  // TTLをミリ秒に変換
      }
    }

    /**
     * カウントをインクリメントして許可
     *
     * INCR: アトミックにカウントを増やす
     * 複数のリクエストが同時に来ても正確にカウント
     */
    const newCount = await redis.incr(key)
    return {
      success: true,
      remaining: Math.max(0, maxRequests - newCount),
      resetTime: Date.now() + ttl * 1000,
    }
  } catch (error) {
    /**
     * エラー処理（フェイルオープン）
     *
     * ## フェイルオープン vs フェイルクローズ
     * - フェイルオープン: エラー時は許可（ユーザー体験優先）
     * - フェイルクローズ: エラー時は拒否（セキュリティ優先）
     *
     * このファイルではフェイルオープンを採用
     * 理由: Redisの一時的な障害でユーザーがブロックされるのを防ぐ
     *
     * ## 注意
     * セキュリティが最重要の機能（認証など）では
     * フェイルクローズを検討することを推奨
     */
    logger.error('Rate limit error:', error)
    // Redis エラー時は許可（フェイルオープン）
    return {
      success: true,
      remaining: maxRequests,
      resetTime: Date.now() + windowMs,
    }
  }
}

// ============================================================
// プリセット設定
// ============================================================

/**
 * 機能別のレート制限プリセット
 *
 * ## 設計思想
 * - 各機能の特性に合わせた制限を設定
 * - 一般的な操作は緩め、セキュリティ重要な操作は厳しめ
 *
 * ## as const について
 * - オブジェクトを読み取り専用として扱う
 * - 型推論がより厳密になる
 * - keyof typeof RATE_LIMITS で正確なキーの型が得られる
 */
export const RATE_LIMITS = {
  /**
   * 一般的なAPI（1分あたり60リクエスト）
   *
   * 用途: 通常のAPI呼び出し
   * 理由: ほとんどの操作に十分な頻度
   */
  api: { windowMs: 60000, maxRequests: 60 },

  /**
   * ログイン試行（15分あたり5回）
   *
   * 用途: ログインフォームの送信
   * 理由: ブルートフォース攻撃の防止
   *       5回失敗したら15分待つ必要がある
   */
  login: { windowMs: 15 * 60 * 1000, maxRequests: 5 },

  /**
   * ユーザー登録（1時間あたり3回）
   *
   * 用途: 新規アカウント作成
   * 理由: スパムアカウント作成の防止
   *       同一IPから大量のアカウントを作れないように
   */
  register: { windowMs: 60 * 60 * 1000, maxRequests: 3 },

  /**
   * パスワードリセット（1時間あたり3回）
   *
   * 用途: パスワードリセットメール送信
   * 理由: メール爆撃の防止
   *       ユーザーのメールボックスを攻撃から保護
   */
  passwordReset: { windowMs: 60 * 60 * 1000, maxRequests: 3 },

  /**
   * ファイルアップロード（1分あたり5回）
   *
   * 用途: 画像/動画のアップロード
   * 理由: R2ストレージの書き込み回数（Class A Operations）保護
   */
  upload: { windowMs: 60000, maxRequests: 5 },

  /**
   * 検索（1分あたり20回）
   *
   * 用途: 検索クエリの実行
   * 理由: 検索はDBに負荷がかかるため、厳しめに
   */
  search: { windowMs: 60000, maxRequests: 20 },

  /**
   * コメント投稿（1分あたり5回）
   *
   * 用途: コメントの投稿
   * 理由: スパムコメントの防止
   */
  comment: { windowMs: 60000, maxRequests: 5 },

  /**
   * 投稿作成（1分あたり3回）
   *
   * 用途: 投稿、引用、リポストの作成
   * 理由: スパム投稿の防止、DB負荷軽減
   */
  post: { windowMs: 60000, maxRequests: 3 },

  /**
   * いいね/ブックマーク（1分あたり30回）
   *
   * 用途: いいね、ブックマークの追加/解除
   * 理由: 連打防止、DB負荷軽減
   */
  engagement: { windowMs: 60000, maxRequests: 30 },

  /**
   * タイムライン取得（1分あたり30回）
   *
   * 用途: フィード、タイムラインの取得
   * 理由: DB負荷の高いクエリを保護
   */
  timeline: { windowMs: 60000, maxRequests: 30 },

  /**
   * 一般的な読み取り操作（1分あたり60回）
   *
   * 用途: フォロワー一覧、フォロー中一覧など
   * 理由: 列挙攻撃の防止、DB負荷軽減
   */
  read: { windowMs: 60000, maxRequests: 60 },
} as const

// ============================================================
// ヘルパー関数
// ============================================================

/**
 * クライアントのIPアドレスを取得
 *
 * ## なぜIPアドレスが必要か？
 * - ユーザーを一意に識別するため
 * - 未認証ユーザーの制限に必要
 *
 * ## プロキシ/CDN環境での考慮
 * ユーザーのリクエストは通常、プロキシやCDNを経由する
 * その場合、直接のIPはプロキシのIPになってしまう
 *
 * ## IPアドレスの取得順序
 * 1. cf-connecting-ip: Cloudflare経由の場合
 * 2. x-forwarded-for: 一般的なプロキシヘッダー（カンマ区切りの最初）
 * 3. x-real-ip: nginxなどのリバースプロキシ
 * 4. 'unknown': すべて失敗した場合のフォールバック
 *
 * @param request - HTTPリクエスト
 * @returns クライアントのIPアドレス
 */
export function getClientIp(request: Request): string {
  /**
   * Cloudflare経由のIPアドレス
   *
   * Cloudflare CDN使用時に設定される
   * 最も信頼性が高い
   */
  const cfIp = request.headers.get('cf-connecting-ip')
  if (cfIp) return cfIp

  /**
   * X-Forwarded-For ヘッダー
   *
   * 形式: "client, proxy1, proxy2"
   * 最初の値がオリジナルのクライアントIP
   *
   * ## 注意
   * このヘッダーは偽装可能
   * 信頼できるプロキシ/CDNの後ろでのみ信頼すべき
   */
  const xForwardedFor = request.headers.get('x-forwarded-for')
  if (xForwardedFor) {
    return xForwardedFor.split(',')[0].trim()
  }

  /**
   * X-Real-IP ヘッダー
   *
   * nginx等のリバースプロキシが設定することがある
   */
  const xRealIp = request.headers.get('x-real-ip')
  if (xRealIp) return xRealIp

  /**
   * フォールバック
   *
   * IPアドレスが取得できない場合
   * 'unknown'を返し、この場合は同一扱いになる
   *
   * ## 注意
   * 本番環境では通常発生しないはずだが、
   * 発生した場合は制限が共有されるリスクがある
   */
  return 'unknown'
}

/**
 * レート制限チェック用のヘルパー関数
 *
 * ## 機能概要
 * プリセット設定を使用して簡単にレート制限をチェック
 *
 * ## パラメータ
 * @param request - HTTPリクエスト
 * @param limitType - プリセットの種類（RATE_LIMITSのキー）
 * @param additionalKey - 追加の識別子（オプション）
 *
 * ## 戻り値
 * @returns RateLimitResult - 制限チェックの結果
 *
 * ## キーの生成
 * additionalKeyがある場合: "limitType:ip:additionalKey"
 * additionalKeyがない場合: "limitType:ip"
 *
 * ## 使用例
 * ```typescript
 * // APIルートで使用
 * export async function POST(request: Request) {
 *   const rateLimitResult = await checkRateLimit(request, 'login')
 *
 *   if (!rateLimitResult.success) {
 *     return new Response('Too many requests', {
 *       status: 429,
 *       headers: {
 *         'Retry-After': String(Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)),
 *       },
 *     })
 *   }
 *
 *   // 処理を続行...
 * }
 * ```
 *
 * ## additionalKeyの使用例
 * ```typescript
 * // ユーザーごとに制限（ログイン済みの場合）
 * await checkRateLimit(request, 'upload', userId)
 *
 * // エンドポイントごとに制限
 * await checkRateLimit(request, 'api', '/api/posts')
 * ```
 */
export async function checkRateLimit(
  request: Request,
  limitType: keyof typeof RATE_LIMITS,
  additionalKey?: string
): Promise<RateLimitResult> {
  // クライアントIPを取得
  const ip = getClientIp(request)

  // キーを生成
  const key = additionalKey ? `${limitType}:${ip}:${additionalKey}` : `${limitType}:${ip}`

  // プリセット設定でレート制限をチェック
  return rateLimit(key, RATE_LIMITS[limitType])
}

// ============================================================
// 日次制限
// ============================================================

/**
 * 日次制限の設定
 *
 * ## 設計思想
 * 分単位のレート制限に加えて、1日あたりの総操作数を制限
 * クラウド課金対策として特に重要
 *
 * ## 制限値の根拠
 * - upload: R2 Class A Operations（$4.50/100万回）対策
 *   無料会員20件×6枚=120回/日を想定、余裕を見て50回
 */
export const DAILY_LIMITS = {
  /**
   * アップロード（1日50回）
   *
   * 用途: 画像/動画のアップロード回数制限
   * 計算: 投稿20件×最大6枚=120枚が上限だが、
   *       投稿を削除して再投稿する攻撃を防ぐため厳しめに
   */
  upload: 50,
} as const

/**
 * 日次制限をチェック
 *
 * ## 機能概要
 * 1日あたりの操作回数を制限します。
 * 毎日0時（UTC）にリセットされます。
 *
 * ## パラメータ
 * @param userId - ユーザーID
 * @param limitType - 制限タイプ（DAILY_LIMITSのキー）
 *
 * ## 戻り値
 * @returns { allowed: boolean, count: number, limit: number }
 *
 * ## 使用例
 * ```typescript
 * const result = await checkDailyLimit(userId, 'upload')
 * if (!result.allowed) {
 *   return { error: `1日のアップロード上限（${result.limit}回）に達しました` }
 * }
 * ```
 */
export async function checkDailyLimit(
  userId: string,
  limitType: keyof typeof DAILY_LIMITS
): Promise<{ allowed: boolean; count: number; limit: number }> {
  const redis = getRedisClient()
  const limit = DAILY_LIMITS[limitType]

  /**
   * 日付ベースのキー生成
   *
   * UTC日付を使用して、毎日0時にリセット
   * キー例: "daily:upload:user123:2024-01-15"
   */
  const today = new Date().toISOString().split('T')[0]
  const key = `daily:${limitType}:${userId}:${today}`

  try {
    const currentStr = await redis.get(key)
    const current = currentStr ? parseInt(currentStr, 10) : 0

    if (current >= limit) {
      return { allowed: false, count: current, limit }
    }

    // カウントをインクリメント（24時間後に自動削除）
    await redis.incr(key)
    const ttl = await redis.ttl(key)
    if (ttl < 0) {
      // TTLが設定されていない場合、24時間後に期限切れ
      await redis.expire(key, 24 * 60 * 60)
    }

    return { allowed: true, count: current + 1, limit }
  } catch (error) {
    logger.error('Daily limit check error:', error)
    // エラー時はフェイルオープン
    return { allowed: true, count: 0, limit }
  }
}

/**
 * ユーザーIDベースのレート制限チェック
 *
 * ## 機能概要
 * IPではなくユーザーIDでレート制限を行う
 * 認証済みユーザー向けの制限に使用
 *
 * ## パラメータ
 * @param userId - ユーザーID
 * @param limitType - プリセットの種類
 *
 * ## 使用例
 * ```typescript
 * const result = await checkUserRateLimit(session.user.id, 'post')
 * if (!result.success) {
 *   return { error: '操作が多すぎます。しばらく待ってから再試行してください' }
 * }
 * ```
 */
export async function checkUserRateLimit(
  userId: string,
  limitType: keyof typeof RATE_LIMITS
): Promise<RateLimitResult> {
  const key = `${limitType}:user:${userId}`
  return rateLimit(key, RATE_LIMITS[limitType])
}
