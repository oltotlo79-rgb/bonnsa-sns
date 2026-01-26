/**
 * 認証関連のServer Actions
 *
 * このファイルは、ユーザー認証に関する
 * サーバーサイドの処理を提供します。
 *
 * ## 機能概要
 * - ログイン試行のレート制限
 * - ログイン失敗の記録
 * - ユーザー登録
 * - パスワードリセット（メール送信・実行・トークン検証）
 *
 * ## セキュリティ機能
 * - ブルートフォース攻撃防止（レート制限）
 * - パスワードのハッシュ化（bcrypt）
 * - パスワードリセットトークンのハッシュ化（SHA-256）
 * - セキュリティログの記録
 * - 列挙攻撃防止（ユーザー存在確認でも成功を返す）
 *
 * ## パスワード要件
 * - 8文字以上
 * - アルファベットと数字を両方含む
 *
 * @module lib/actions/auth
 */

'use server'

// ============================================================
// インポート
// ============================================================

/**
 * Prismaクライアント
 * データベース操作に使用
 */
import { prisma } from '@/lib/db'

/**
 * bcryptjs
 * パスワードのハッシュ化に使用
 *
 * bcrypt: 安全なパスワードハッシュアルゴリズム
 * ソルト（ランダム文字列）を自動付与し、レインボーテーブル攻撃を防ぐ
 */
import bcrypt from 'bcryptjs'

/**
 * crypto
 * パスワードリセットトークンの生成・ハッシュ化に使用
 *
 * Node.js標準の暗号化モジュール
 */
import crypto from 'crypto'

/**
 * Next.jsのheaders関数
 * リクエストヘッダー（IPアドレス等）の取得に使用
 */
import { headers } from 'next/headers'

/**
 * パスワードリセットメール送信関数
 */
import { sendPasswordResetEmail } from '@/lib/email'

/**
 * ロガー
 * デバッグ・エラーログの記録に使用
 */
import logger from '@/lib/logger'

/**
 * ログイン試行トラッカー
 * ブルートフォース攻撃防止のレート制限に使用
 */
import {
  checkLoginAttempt,
  recordFailedLogin,
  resetLoginAttempts,
  getLoginKey,
} from '@/lib/login-tracker'

/**
 * 入力サニタイズ
 * XSS攻撃防止のため入力値をクリーンアップ
 */
import { sanitizeInput } from '@/lib/sanitize'

/**
 * セキュリティログ関数
 * 認証関連イベントの記録に使用
 */
import {
  logLoginFailure,
  logLoginLockout,
  logRegisterSuccess,
  logPasswordResetRequest,
  logPasswordResetSuccess,
} from '@/lib/security-logger'

/**
 * レート制限関数
 * パスワードリセット等のブルートフォース攻撃防止に使用
 */
import { rateLimit } from '@/lib/rate-limit'

// ============================================================
// IPアドレス取得（内部関数）
// ============================================================

/**
 * クライアントのIPアドレスを取得（内部関数）
 *
 * ## 取得優先順位
 * 1. cf-connecting-ip (Cloudflare)
 * 2. x-forwarded-for (プロキシ/ロードバランサー)
 * 3. x-real-ip (Nginx)
 * 4. 'unknown' (取得できない場合)
 *
 * ## 用途
 * - レート制限のキー生成
 * - セキュリティログの記録
 *
 * @returns IPアドレス文字列
 */
async function getClientIp(): Promise<string> {
  /**
   * リクエストヘッダーを取得
   */
  const headersList = await headers()

  /**
   * Cloudflare経由の場合
   */
  const cfIp = headersList.get('cf-connecting-ip')
  if (cfIp) return cfIp

  /**
   * プロキシ/ロードバランサー経由の場合
   *
   * x-forwarded-for は複数のIPがカンマ区切りで含まれる場合がある
   * 最初のIPがクライアントのもの
   */
  const xForwardedFor = headersList.get('x-forwarded-for')
  if (xForwardedFor) return xForwardedFor.split(',')[0].trim()

  /**
   * Nginx経由の場合
   */
  const xRealIp = headersList.get('x-real-ip')
  if (xRealIp) return xRealIp

  /**
   * IPアドレスを取得できない場合
   */
  return 'unknown'
}

// ============================================================
// ログイン前チェック（レート制限）
// ============================================================

/**
 * ログインが許可されているかチェック
 *
 * ## 機能概要
 * ブルートフォース攻撃防止のため、
 * ログイン試行回数をチェックします。
 *
 * ## レート制限
 * - 一定回数失敗するとロックアウト
 * - ロックアウト後は一定時間経過で解除
 *
 * @param email - メールアドレス
 * @returns ログイン許可状態
 *
 * @example
 * ```typescript
 * const check = await checkLoginAllowed(email)
 *
 * if (!check.allowed) {
 *   setError(check.message)
 *   return
 * }
 * ```
 */
export async function checkLoginAllowed(email: string) {
  // ------------------------------------------------------------
  // キーの生成
  // ------------------------------------------------------------

  /**
   * IPアドレスを取得
   */
  const ip = await getClientIp()

  /**
   * レート制限のキーを生成
   *
   * IPアドレスとメールアドレスの組み合わせでキーを作成
   * これにより、同じIPからの異なるアカウントへの攻撃も検出可能
   */
  const key = getLoginKey(ip, sanitizeInput(email))

  // ------------------------------------------------------------
  // ログイン試行をチェック
  // ------------------------------------------------------------

  const result = await checkLoginAttempt(key)

  return {
    allowed: result.allowed,
    message: result.message,
    remainingAttempts: result.remainingAttempts,
  }
}

// ============================================================
// ログイン失敗の記録
// ============================================================

/**
 * ログイン失敗を記録
 *
 * ## 機能概要
 * ログイン失敗時に呼び出し、失敗回数をカウントします。
 *
 * ## 処理内容
 * 1. 失敗回数をインクリメント
 * 2. セキュリティログに記録
 * 3. ロックアウト判定
 *
 * @param email - メールアドレス
 * @returns ロック状態と残り試行回数
 *
 * @example
 * ```typescript
 * // ログイン失敗時
 * const result = await recordLoginFailure(email)
 *
 * if (result.locked) {
 *   setError('アカウントがロックされました')
 * } else {
 *   setError(`残り${result.remainingAttempts}回`)
 * }
 * ```
 */
export async function recordLoginFailure(email: string) {
  // ------------------------------------------------------------
  // キーの生成
  // ------------------------------------------------------------

  const ip = await getClientIp()
  const sanitizedEmail = sanitizeInput(email)
  const key = getLoginKey(ip, sanitizedEmail)

  // ------------------------------------------------------------
  // 失敗を記録
  // ------------------------------------------------------------

  const result = await recordFailedLogin(key)

  // ------------------------------------------------------------
  // セキュリティログに記録
  // ------------------------------------------------------------

  /**
   * ログイン失敗をログに記録
   */
  logLoginFailure(sanitizedEmail, ip, 'invalid_credentials')

  /**
   * ロックアウトになった場合は追加でログ記録
   */
  if (!result.allowed) {
    logLoginLockout(sanitizedEmail, ip)
  }

  return {
    locked: !result.allowed,
    message: result.message,
    remainingAttempts: result.remainingAttempts,
  }
}

// ============================================================
// ログイン成功時のリセット
// ============================================================

/**
 * ログイン成功時に試行回数をリセット
 *
 * ## 機能概要
 * ログイン成功時に呼び出し、失敗回数をクリアします。
 *
 * @param email - メールアドレス
 *
 * @example
 * ```typescript
 * // ログイン成功時
 * await clearLoginAttempts(email)
 * ```
 */
export async function clearLoginAttempts(email: string) {
  const ip = await getClientIp()
  const key = getLoginKey(ip, sanitizeInput(email))

  /**
   * ログイン試行回数をリセット
   */
  await resetLoginAttempts(key)
}

// ============================================================
// ユーザー登録
// ============================================================

/**
 * ユーザーを登録
 *
 * ## 機能概要
 * 新規ユーザーを作成します。
 *
 * ## 処理フロー
 * 1. メールアドレスの重複チェック
 * 2. パスワードのハッシュ化
 * 3. ユーザー作成
 * 4. セキュリティログに記録
 *
 * ## パスワードハッシュ化
 * bcryptを使用し、ソルトラウンド10で安全にハッシュ化
 *
 * @param data - 登録データ（email, password, nickname）
 * @returns 成功時は { success: true, userId }、失敗時は { error: string }
 *
 * @example
 * ```typescript
 * const result = await registerUser({
 *   email: 'user@example.com',
 *   password: 'SecurePass123',
 *   nickname: 'ユーザー名',
 * })
 * ```
 */
export async function registerUser(data: {
  email: string
  password: string
  nickname: string
}) {
  // ------------------------------------------------------------
  // メール重複チェック
  // ------------------------------------------------------------

  /**
   * 同じメールアドレスが既に登録されていないか確認
   */
  const existingUser = await prisma.user.findUnique({
    where: { email: data.email },
  })

  if (existingUser) {
    return { error: 'このメールアドレスは既に登録されています' }
  }

  // ------------------------------------------------------------
  // パスワードハッシュ化
  // ------------------------------------------------------------

  /**
   * bcrypt.hash でパスワードをハッシュ化
   *
   * 第2引数の 10 はソルトラウンド（コスト係数）
   * 高いほど安全だが処理時間が長くなる
   * 10 は現在の推奨値
   */
  const hashedPassword = await bcrypt.hash(data.password, 10)

  // ------------------------------------------------------------
  // ユーザー作成
  // ------------------------------------------------------------

  const user = await prisma.user.create({
    data: {
      email: data.email,
      password: hashedPassword,
      nickname: data.nickname,
    },
  })

  // ------------------------------------------------------------
  // セキュリティログに記録
  // ------------------------------------------------------------

  const ip = await getClientIp()

  /**
   * 登録成功をログに記録
   */
  logRegisterSuccess(user.id, ip)

  return { success: true, userId: user.id }
}

// ============================================================
// パスワードリセットメール送信
// ============================================================

/**
 * パスワードリセットメールを送信
 *
 * ## 機能概要
 * パスワードリセット用のメールを送信します。
 *
 * ## 処理フロー
 * 1. セキュリティログに記録
 * 2. ユーザーの存在確認
 * 3. 既存トークンの削除
 * 4. 新しいトークンの生成・保存
 * 5. リセットメールの送信
 *
 * ## セキュリティ
 * - ユーザーが存在しなくても成功を返す（列挙攻撃防止）
 * - トークンはSHA-256でハッシュ化して保存
 * - トークンの有効期限は1時間
 *
 * @param email - メールアドレス
 * @returns 成功時は { success: true }、失敗時は { error: string }
 *
 * @example
 * ```typescript
 * const result = await requestPasswordReset('user@example.com')
 *
 * if (result.success) {
 *   toast.success('リセットメールを送信しました')
 * }
 * ```
 */
export async function requestPasswordReset(email: string) {
  const ip = await getClientIp()

  // ------------------------------------------------------------
  // レート制限チェック（メールスパム防止）
  // ------------------------------------------------------------

  /**
   * IPアドレスベースのレート制限
   * 1時間に3回まで（メールスパム攻撃防止）
   */
  const rateLimitResult = await rateLimit(`password-reset:${ip}`, {
    windowMs: 60 * 60 * 1000, // 1時間
    maxRequests: 3,           // 3回まで
  })

  if (!rateLimitResult.success) {
    return { error: 'パスワードリセットの要求が多すぎます。しばらく経ってからお試しください。' }
  }

  // ------------------------------------------------------------
  // セキュリティログに記録
  // ------------------------------------------------------------

  /**
   * パスワードリセット要求をログに記録
   */
  logPasswordResetRequest(email, ip)

  // ------------------------------------------------------------
  // ユーザーの存在確認
  // ------------------------------------------------------------

  const user = await prisma.user.findUnique({
    where: { email },
  })

  if (!user) {
    /**
     * セキュリティ: ユーザーが存在しなくても成功を返す
     *
     * これにより、攻撃者がメールアドレスの存在を確認できない
     * （列挙攻撃の防止）
     */
    return { success: true }
  }

  // ------------------------------------------------------------
  // 既存トークンの削除
  // ------------------------------------------------------------

  /**
   * 同じメールアドレスの既存トークンを削除
   *
   * 一度に1つのリセットトークンのみ有効にする
   */
  await prisma.passwordResetToken.deleteMany({
    where: { email },
  })

  // ------------------------------------------------------------
  // 新しいトークンの生成
  // ------------------------------------------------------------

  /**
   * ランダムなトークンを生成
   *
   * crypto.randomBytes(32): 32バイト（256ビット）のランダムデータ
   * toString('hex'): 16進数文字列に変換（64文字）
   */
  const token = crypto.randomBytes(32).toString('hex')

  /**
   * トークンをハッシュ化
   *
   * データベースにはハッシュ化したものを保存
   * 万が一DBが漏洩しても、元のトークンは復元できない
   */
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex')

  // ------------------------------------------------------------
  // トークンを保存
  // ------------------------------------------------------------

  /**
   * 1時間有効のトークンを作成
   */
  await prisma.passwordResetToken.create({
    data: {
      email,
      token: hashedToken,
      expires: new Date(Date.now() + 60 * 60 * 1000), // 1時間後
    },
  })

  // ------------------------------------------------------------
  // リセットURLを生成
  // ------------------------------------------------------------

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  /**
   * リセットURL
   *
   * メールに含めるURL
   * ハッシュ化していない元のトークンを使用
   */
  const resetUrl = `${baseUrl}/password-reset/confirm?token=${token}&email=${encodeURIComponent(email)}`

  // ------------------------------------------------------------
  // メール送信
  // ------------------------------------------------------------

  logger.log('Attempting to send password reset email to:', email)
  logger.debug('Reset URL generated')

  const result = await sendPasswordResetEmail(email, resetUrl)

  logger.log('Email send result:', result.success ? 'success' : 'failed')

  if (!result.success) {
    logger.error('Failed to send password reset email:', result.error)
    return { error: 'メールの送信に失敗しました。しばらく経ってからお試しください。' }
  }

  return { success: true }
}

// ============================================================
// パスワードリセット実行
// ============================================================

/**
 * パスワードをリセット
 *
 * ## 機能概要
 * パスワードリセットトークンを使用して
 * 新しいパスワードを設定します。
 *
 * ## 処理フロー
 * 1. パスワードバリデーション
 * 2. トークンの検証
 * 3. パスワードの更新
 * 4. 使用済みトークンの削除
 * 5. セキュリティログに記録
 *
 * @param data - リセットデータ（email, token, newPassword）
 * @returns 成功時は { success: true }、失敗時は { error: string }
 *
 * @example
 * ```typescript
 * const result = await resetPassword({
 *   email: 'user@example.com',
 *   token: 'abc123...',
 *   newPassword: 'NewSecurePass123',
 * })
 * ```
 */
export async function resetPassword(data: {
  email: string
  token: string
  newPassword: string
}) {
  const { email, token, newPassword } = data

  // ------------------------------------------------------------
  // パスワードバリデーション
  // ------------------------------------------------------------

  /**
   * 8文字以上
   */
  if (newPassword.length < 8) {
    return { error: 'パスワードは8文字以上で入力してください' }
  }

  /**
   * アルファベットと数字を両方含む
   */
  const hasLetter = /[a-zA-Z]/.test(newPassword)
  const hasNumber = /[0-9]/.test(newPassword)
  if (!hasLetter || !hasNumber) {
    return { error: 'パスワードはアルファベットと数字を両方含めてください' }
  }

  // ------------------------------------------------------------
  // トークンの検証
  // ------------------------------------------------------------

  /**
   * 受け取ったトークンをハッシュ化
   *
   * DBに保存されているのはハッシュ化されたトークン
   */
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex')

  /**
   * トークンをDBから検索
   *
   * - email が一致
   * - token が一致
   * - expires > 現在時刻（有効期限内）
   */
  const resetToken = await prisma.passwordResetToken.findFirst({
    where: {
      email,
      token: hashedToken,
      expires: { gt: new Date() },
    },
  })

  if (!resetToken) {
    return { error: 'リセットリンクが無効または期限切れです。もう一度お試しください。' }
  }

  // ------------------------------------------------------------
  // ユーザー確認
  // ------------------------------------------------------------

  const user = await prisma.user.findUnique({
    where: { email },
  })

  if (!user) {
    return { error: 'ユーザーが見つかりません' }
  }

  // ------------------------------------------------------------
  // パスワードを更新
  // ------------------------------------------------------------

  /**
   * 新しいパスワードをハッシュ化
   */
  const hashedPassword = await bcrypt.hash(newPassword, 10)

  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPassword },
  })

  // ------------------------------------------------------------
  // 使用済みトークンを削除
  // ------------------------------------------------------------

  /**
   * 同じメールアドレスの全トークンを削除
   *
   * リセット成功後、同じトークンは使用できないようにする
   */
  await prisma.passwordResetToken.deleteMany({
    where: { email },
  })

  // ------------------------------------------------------------
  // セキュリティログに記録
  // ------------------------------------------------------------

  logPasswordResetSuccess(user.id)

  return { success: true }
}

// ============================================================
// パスワードリセットトークン検証
// ============================================================

/**
 * パスワードリセットトークンを検証
 *
 * ## 機能概要
 * パスワードリセットページでトークンの有効性を確認します。
 *
 * ## 用途
 * リセットフォームを表示する前に、
 * トークンが有効かどうかをチェック
 *
 * @param email - メールアドレス
 * @param token - リセットトークン
 * @returns { valid: boolean }
 *
 * @example
 * ```typescript
 * const { valid } = await verifyPasswordResetToken(email, token)
 *
 * if (!valid) {
 *   router.push('/password-reset')
 * }
 * ```
 */
export async function verifyPasswordResetToken(email: string, token: string) {
  /**
   * トークンをハッシュ化して検索
   */
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex')

  const resetToken = await prisma.passwordResetToken.findFirst({
    where: {
      email,
      token: hashedToken,
      expires: { gt: new Date() },
    },
  })

  /**
   * トークンが見つかれば有効
   */
  return { valid: !!resetToken }
}
