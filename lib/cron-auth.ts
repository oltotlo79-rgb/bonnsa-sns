/**
 * Cron Job認証ユーティリティ
 *
 * HMACベースの署名検証とタイムスタンプ検証を提供します。
 *
 * ## セキュリティ機能
 * - HMAC-SHA256署名検証
 * - タイムスタンプ検証（リプレイ攻撃対策）
 * - 定数時間比較（タイミング攻撃対策）
 *
 * @module lib/cron-auth
 */

import crypto from 'crypto'

/**
 * 許容するタイムスタンプの誤差（ミリ秒）
 * 5分以内のリクエストのみ受け付ける
 */
const TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000

/**
 * Cron認証ヘッダーを検証
 *
 * @param authHeader - Authorizationヘッダーの値
 * @param timestampHeader - X-Cron-Timestampヘッダーの値
 * @returns 認証結果 { valid: boolean, error?: string }
 *
 * @example
 * ```typescript
 * const authHeader = request.headers.get('authorization')
 * const timestampHeader = request.headers.get('x-cron-timestamp')
 * const result = verifyCronAuth(authHeader, timestampHeader)
 * if (!result.valid) {
 *   return NextResponse.json({ error: result.error }, { status: 401 })
 * }
 * ```
 */
export function verifyCronAuth(
  authHeader: string | null,
  timestampHeader: string | null
): { valid: boolean; error?: string } {
  const cronSecret = process.env.CRON_SECRET

  // CRON_SECRETが未設定の場合（開発環境など）
  if (!cronSecret) {
    // 本番環境では必ず設定が必要
    if (process.env.NODE_ENV === 'production') {
      return { valid: false, error: 'CRON_SECRET is not configured' }
    }
    // 開発環境では警告を出してパス
    console.warn('Warning: CRON_SECRET is not set. Cron authentication is disabled.')
    return { valid: true }
  }

  // レガシー認証（Bearer token）のサポート
  // 新しいHMAC認証に移行中の互換性のため
  if (authHeader === `Bearer ${cronSecret}`) {
    // タイムスタンプヘッダーがない場合はレガシー認証として許可
    // ただし本番環境では警告
    if (!timestampHeader) {
      if (process.env.NODE_ENV === 'production') {
        console.warn('Warning: Using legacy Bearer token authentication for cron job')
      }
      return { valid: true }
    }
  }

  // HMAC認証
  if (!authHeader?.startsWith('HMAC ')) {
    return { valid: false, error: 'Invalid authorization scheme' }
  }

  if (!timestampHeader) {
    return { valid: false, error: 'Missing timestamp header' }
  }

  // タイムスタンプ検証
  const timestamp = parseInt(timestampHeader, 10)
  if (isNaN(timestamp)) {
    return { valid: false, error: 'Invalid timestamp format' }
  }

  const now = Date.now()
  const timeDiff = Math.abs(now - timestamp)
  if (timeDiff > TIMESTAMP_TOLERANCE_MS) {
    return { valid: false, error: 'Request timestamp is too old or too far in the future' }
  }

  // 署名検証
  const providedSignature = authHeader.slice(5) // 'HMAC ' を除去
  const expectedSignature = generateCronSignature(timestampHeader, cronSecret)

  // 定数時間比較（タイミング攻撃対策）
  if (!crypto.timingSafeEqual(
    Buffer.from(providedSignature),
    Buffer.from(expectedSignature)
  )) {
    return { valid: false, error: 'Invalid signature' }
  }

  return { valid: true }
}

/**
 * Cron認証用の署名を生成
 *
 * @param timestamp - タイムスタンプ文字列
 * @param secret - CRON_SECRET
 * @returns HMAC-SHA256署名（hex）
 */
export function generateCronSignature(timestamp: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(timestamp)
    .digest('hex')
}

/**
 * Cronリクエスト用の認証ヘッダーを生成（クライアント側用）
 *
 * Vercel Cronから呼び出す場合は直接Bearerトークンが使用されるため、
 * この関数は手動テストや外部からの呼び出し用
 *
 * @returns { authorization: string, 'x-cron-timestamp': string }
 */
export function generateCronHeaders(): { authorization: string; 'x-cron-timestamp': string } {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    throw new Error('CRON_SECRET is not set')
  }

  const timestamp = Date.now().toString()
  const signature = generateCronSignature(timestamp, cronSecret)

  return {
    authorization: `HMAC ${signature}`,
    'x-cron-timestamp': timestamp,
  }
}
