/**
 * CSRF保護ユーティリティ
 *
 * Server ActionsにCSRF保護を追加するためのユーティリティ。
 * Next.js 13以降のServer Actionsにはデフォルトで基本的なCSRF保護があるが、
 * このモジュールは多層防御として追加のOriginヘッダー検証を提供する。
 *
 * ## Next.jsのデフォルトCSRF保護
 * - Server ActionsはPOSTリクエストのみ受け付ける
 * - Same-Originポリシーによる保護
 * - Cookieベースの認証との連携
 *
 * ## このモジュールが提供する追加保護
 * - Originヘッダーの明示的な検証
 * - 許可されたオリジンのホワイトリスト
 * - セキュリティログとの連携
 *
 * @module lib/csrf
 */

import crypto from 'crypto'

import { headers } from 'next/headers'

/**
 * 許可されたオリジンのリスト
 *
 * 環境変数から取得するか、デフォルト値を使用
 */
function getAllowedOrigins(): string[] {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const additionalOrigins = process.env.ALLOWED_ORIGINS?.split(',') || []

  // URLからオリジン部分のみを抽出
  const appOrigin = new URL(appUrl).origin

  return [appOrigin, ...additionalOrigins].filter(Boolean)
}

/**
 * Originヘッダーを検証
 *
 * リクエストのOriginヘッダーが許可されたオリジンかどうかを確認する。
 *
 * ## 検証ロジック
 * 1. Originヘッダーを取得
 * 2. Originがない場合はRefererヘッダーをフォールバックとして使用
 * 3. どちらもない場合はSame-Originリクエストと見なす（ブラウザ挙動）
 * 4. 許可されたオリジンリストと照合
 *
 * ## 使用例
 * ```typescript
 * 'use server'
 *
 * export async function sensitiveAction() {
 *   const originCheck = await validateOrigin()
 *   if (!originCheck.valid) {
 *     return { error: originCheck.error }
 *   }
 *   // 処理を続行
 * }
 * ```
 *
 * @returns 検証結果
 */
export async function validateOrigin(): Promise<{
  valid: boolean
  error?: string
  origin?: string
}> {
  try {
    const headersList = await headers()
    const origin = headersList.get('origin')
    const referer = headersList.get('referer')

    // Originヘッダーがない場合
    if (!origin) {
      // Refererからオリジンを抽出して検証
      if (referer) {
        try {
          const refererOrigin = new URL(referer).origin
          const allowedOrigins = getAllowedOrigins()

          if (!allowedOrigins.includes(refererOrigin)) {
            return {
              valid: false,
              error: '不正なリクエスト元です',
              origin: refererOrigin,
            }
          }
          return { valid: true, origin: refererOrigin }
        } catch {
          // Refererのパースに失敗
          return { valid: false, error: '不正なリクエストです' }
        }
      }

      // OriginもRefererもない場合
      // Same-Originリクエスト（フォーム送信など）と見なす
      // ブラウザはSame-Originリクエストではこれらのヘッダーを送信しない場合がある
      return { valid: true }
    }

    // Originヘッダーがある場合は検証
    const allowedOrigins = getAllowedOrigins()

    if (!allowedOrigins.includes(origin)) {
      return {
        valid: false,
        error: '不正なリクエスト元です',
        origin,
      }
    }

    return { valid: true, origin }
  } catch (error) {
    // ヘッダー取得に失敗した場合は拒否
    console.error('Origin validation error:', error)
    return { valid: false, error: '不正なリクエストです' }
  }
}

/**
 * CSRFトークンを生成
 *
 * セッションに紐づいたCSRFトークンを生成する。
 * より厳密なCSRF保護が必要な場合に使用。
 *
 * 注意: 通常のServer ActionsではvalidateOrigin()で十分な保護が得られる。
 * このトークン方式は、外部APIとの連携や特別なセキュリティ要件がある場合に使用。
 *
 * @param sessionId - セッションID
 * @returns CSRFトークン
 */
export function generateCsrfToken(sessionId: string): string {
  const secret = process.env.NEXTAUTH_SECRET || 'development-secret'

  return crypto
    .createHmac('sha256', secret)
    .update(sessionId)
    .digest('hex')
}

/**
 * CSRFトークンを検証
 *
 * @param token - 検証するトークン
 * @param sessionId - セッションID
 * @returns 検証結果
 */
export function verifyCsrfToken(token: string, sessionId: string): boolean {
  const expectedToken = generateCsrfToken(sessionId)

  // タイミング攻撃を防ぐための定数時間比較
  return crypto.timingSafeEqual(
    Buffer.from(token),
    Buffer.from(expectedToken)
  )
}
