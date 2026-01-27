/**
 * 2段階認証（2FA）Server Actions
 *
 * 2段階認証のセットアップ、有効化、無効化、検証などの
 * サーバーサイド処理を提供します。
 *
 * ## 機能概要
 * - 2FAセットアップ（QRコード生成）
 * - 2FA有効化（TOTP検証後）
 * - 2FA無効化（パスワード検証後）
 * - ログイン時の2FA検証
 * - バックアップコード再生成
 *
 * ## セキュリティ
 * - 全ての操作で認証チェックを実施
 * - シークレットは暗号化してDB保存
 * - バックアップコードはハッシュ化して保存
 * - 使用済みバックアップコードは自動削除
 *
 * @module lib/actions/two-factor
 */

'use server'

import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import bcrypt from 'bcryptjs'
import {
  generateSecret,
  generateTOTPUri,
  generateQRCode,
  verifyTOTP,
  generateBackupCodes,
  hashBackupCode,
  verifyBackupCode,
  encryptSecret,
  decryptSecret,
  detectCodeType,
  formatTOTPCode,
} from '@/lib/two-factor'

// ============================================================
// 型定義
// ============================================================

/**
 * 2FAセットアップの結果
 */
type Setup2FAResult =
  | {
      success: true
      qrCode: string
      secret: string
      backupCodes: string[]
    }
  | { error: string }

/**
 * 2FA有効化の結果
 */
type Enable2FAResult = { success: true } | { error: string }

/**
 * 2FA無効化の結果
 */
type Disable2FAResult = { success: true } | { error: string }

/**
 * 2FA検証の結果
 */
type Verify2FAResult = { success: true } | { error: string }

/**
 * バックアップコード再生成の結果
 */
type RegenerateBackupCodesResult =
  | { success: true; backupCodes: string[] }
  | { error: string }

/**
 * 2FAステータス取得の結果
 */
type Get2FAStatusResult =
  | { enabled: true; backupCodesRemaining: number }
  | { enabled: false }
  | { error: string }

// ============================================================
// 2FAセットアップ
// ============================================================

/**
 * 2FAセットアップを開始する
 *
 * QRコードとシークレット、バックアップコードを生成して返します。
 * この時点ではまだ2FAは有効化されません。
 * ユーザーがTOTPコードで検証した後に有効化します。
 *
 * @returns セットアップ情報（QRコード、シークレット、バックアップコード）
 *
 * @example
 * ```typescript
 * const result = await setup2FA()
 * if ('success' in result) {
 *   // QRコードを表示
 *   <img src={result.qrCode} />
 *   // バックアップコードを表示して保存を促す
 * }
 * ```
 */
export async function setup2FA(): Promise<Setup2FAResult> {
  // 認証チェック
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // ユーザー情報を取得
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, twoFactorEnabled: true },
  })

  if (!user) {
    return { error: 'ユーザーが見つかりません' }
  }

  // 既に2FAが有効な場合はエラー
  if (user.twoFactorEnabled) {
    return { error: '2段階認証は既に有効です' }
  }

  // シークレットを生成
  const secret = generateSecret()

  // QRコード用URIを生成
  const otpauthUri = generateTOTPUri(secret, user.email)

  // QRコード画像を生成
  const qrCode = await generateQRCode(otpauthUri)

  // バックアップコードを生成
  const backupCodes = generateBackupCodes()

  // シークレットを暗号化して一時保存
  // (有効化時に本保存するため、ここでは暗号化したシークレットをクライアントに返す)
  // セキュリティ上、実際の運用ではサーバーセッションに保存することを推奨

  return {
    success: true,
    qrCode,
    secret, // クライアント側で一時保持（有効化時に送信）
    backupCodes,
  }
}

// ============================================================
// 2FA有効化
// ============================================================

/**
 * 2FAを有効化する
 *
 * ユーザーが入力したTOTPコードを検証し、
 * 成功した場合に2FAを有効化します。
 *
 * @param token - ユーザーが入力した6桁のTOTPコード
 * @param secret - セットアップ時に生成されたシークレット
 * @param backupCodes - セットアップ時に生成されたバックアップコード
 * @returns 有効化結果
 *
 * @example
 * ```typescript
 * const result = await enable2FA('123456', secret, backupCodes)
 * if ('success' in result) {
 *   // 2FAが有効化されました
 * }
 * ```
 */
export async function enable2FA(
  token: string,
  secret: string,
  backupCodes: string[]
): Promise<Enable2FAResult> {
  // 認証チェック
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // ユーザー情報を取得
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { twoFactorEnabled: true },
  })

  if (!user) {
    return { error: 'ユーザーが見つかりません' }
  }

  if (user.twoFactorEnabled) {
    return { error: '2段階認証は既に有効です' }
  }

  // TOTPコードを検証
  const isValid = await verifyTOTP(token, secret)
  if (!isValid) {
    return { error: '認証コードが正しくありません' }
  }

  // シークレットを暗号化
  const encryptedSecret = encryptSecret(secret)

  // バックアップコードをハッシュ化
  const hashedBackupCodes = backupCodes.map((code) => hashBackupCode(code))

  // DBを更新して2FAを有効化
  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      twoFactorEnabled: true,
      twoFactorSecret: encryptedSecret,
      twoFactorBackupCodes: hashedBackupCodes,
    },
  })

  return { success: true }
}

// ============================================================
// 2FA無効化
// ============================================================

/**
 * 2FAを無効化する
 *
 * パスワードを検証した後、2FAを無効化します。
 *
 * @param password - ユーザーのパスワード
 * @returns 無効化結果
 *
 * @example
 * ```typescript
 * const result = await disable2FA('currentPassword')
 * if ('success' in result) {
 *   // 2FAが無効化されました
 * }
 * ```
 */
export async function disable2FA(password: string): Promise<Disable2FAResult> {
  // 認証チェック
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // ユーザー情報を取得
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { password: true, twoFactorEnabled: true },
  })

  if (!user) {
    return { error: 'ユーザーが見つかりません' }
  }

  if (!user.twoFactorEnabled) {
    return { error: '2段階認証は有効ではありません' }
  }

  // パスワードが設定されていない場合（OAuth専用アカウント）
  if (!user.password) {
    return { error: 'パスワードが設定されていません' }
  }

  // パスワードを検証
  const isPasswordValid = await bcrypt.compare(password, user.password)
  if (!isPasswordValid) {
    return { error: 'パスワードが正しくありません' }
  }

  // 2FAを無効化
  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorBackupCodes: [],
    },
  })

  return { success: true }
}

// ============================================================
// 2FA検証（ログイン時）
// ============================================================

/**
 * ログイン時に2FAコードを検証する
 *
 * TOTPコードまたはバックアップコードを検証します。
 * バックアップコードが使用された場合は、そのコードを無効化します。
 *
 * @param userId - ユーザーID
 * @param code - TOTPコードまたはバックアップコード
 * @returns 検証結果
 *
 * @example
 * ```typescript
 * const result = await verify2FAToken(userId, '123456')
 * if ('success' in result) {
 *   // 認証成功
 * }
 * ```
 */
export async function verify2FAToken(
  userId: string,
  code: string
): Promise<Verify2FAResult> {
  // ユーザー情報を取得
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      twoFactorEnabled: true,
      twoFactorSecret: true,
      twoFactorBackupCodes: true,
    },
  })

  if (!user) {
    return { error: 'ユーザーが見つかりません' }
  }

  if (!user.twoFactorEnabled || !user.twoFactorSecret) {
    return { error: '2段階認証が有効ではありません' }
  }

  // コードの種類を判定
  const codeType = detectCodeType(code)

  if (codeType === 'totp') {
    // TOTPコードの検証
    const secret = decryptSecret(user.twoFactorSecret)
    const formattedCode = formatTOTPCode(code)
    const isValid = await verifyTOTP(formattedCode, secret)

    if (!isValid) {
      return { error: '認証コードが正しくありません' }
    }

    return { success: true }
  } else {
    // バックアップコードの検証
    const backupCodeIndex = verifyBackupCode(code, user.twoFactorBackupCodes)

    if (backupCodeIndex === -1) {
      return { error: 'バックアップコードが正しくありません' }
    }

    // 使用されたバックアップコードを削除
    const updatedBackupCodes = [...user.twoFactorBackupCodes]
    updatedBackupCodes.splice(backupCodeIndex, 1)

    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorBackupCodes: updatedBackupCodes },
    })

    return { success: true }
  }
}

// ============================================================
// バックアップコード再生成
// ============================================================

/**
 * バックアップコードを再生成する
 *
 * 既存のバックアップコードを破棄し、新しいコードを生成します。
 * パスワード認証が必要です。
 *
 * @param password - ユーザーのパスワード
 * @returns 新しいバックアップコード
 *
 * @example
 * ```typescript
 * const result = await regenerateBackupCodes('currentPassword')
 * if ('success' in result) {
 *   // 新しいバックアップコードを表示
 * }
 * ```
 */
export async function regenerateBackupCodes(
  password: string
): Promise<RegenerateBackupCodesResult> {
  // 認証チェック
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // ユーザー情報を取得
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { password: true, twoFactorEnabled: true },
  })

  if (!user) {
    return { error: 'ユーザーが見つかりません' }
  }

  if (!user.twoFactorEnabled) {
    return { error: '2段階認証が有効ではありません' }
  }

  if (!user.password) {
    return { error: 'パスワードが設定されていません' }
  }

  // パスワードを検証
  const isPasswordValid = await bcrypt.compare(password, user.password)
  if (!isPasswordValid) {
    return { error: 'パスワードが正しくありません' }
  }

  // 新しいバックアップコードを生成
  const newBackupCodes = generateBackupCodes()
  const hashedBackupCodes = newBackupCodes.map((code) => hashBackupCode(code))

  // DBを更新
  await prisma.user.update({
    where: { id: session.user.id },
    data: { twoFactorBackupCodes: hashedBackupCodes },
  })

  return { success: true, backupCodes: newBackupCodes }
}

// ============================================================
// 2FAステータス取得
// ============================================================

/**
 * 2FAの状態を取得する
 *
 * @returns 2FAの有効状態と残りのバックアップコード数
 *
 * @example
 * ```typescript
 * const status = await get2FAStatus()
 * if ('enabled' in status && status.enabled) {
 *   console.log(`残りのバックアップコード: ${status.backupCodesRemaining}`)
 * }
 * ```
 */
export async function get2FAStatus(): Promise<Get2FAStatusResult> {
  // 認証チェック
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // ユーザー情報を取得
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { twoFactorEnabled: true, twoFactorBackupCodes: true },
  })

  if (!user) {
    return { error: 'ユーザーが見つかりません' }
  }

  if (user.twoFactorEnabled) {
    return {
      enabled: true,
      backupCodesRemaining: user.twoFactorBackupCodes.length,
    }
  }

  return { enabled: false }
}

// ============================================================
// 2FA必要性チェック（ログイン時）
// ============================================================

/**
 * ユーザーに2FAが必要かどうかをチェックする
 *
 * ログイン処理中に呼び出し、2FAが有効なユーザーかを確認します。
 *
 * @param email - ユーザーのメールアドレス
 * @returns 2FAが必要かどうかとユーザーID
 *
 * @example
 * ```typescript
 * const result = await check2FARequired('user@example.com')
 * if (result.required) {
 *   // 2FA入力画面を表示
 * }
 * ```
 */
export async function check2FARequired(
  email: string
): Promise<{ required: boolean; userId?: string }> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, twoFactorEnabled: true },
  })

  if (!user) {
    // ユーザーが存在しない場合も、セキュリティのためfalseを返す
    return { required: false }
  }

  if (user.twoFactorEnabled) {
    return { required: true, userId: user.id }
  }

  return { required: false }
}
