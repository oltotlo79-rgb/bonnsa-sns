/**
 * 2段階認証（2FA）ユーティリティ
 *
 * TOTP（Time-based One-Time Password）認証と
 * バックアップコードの生成・検証機能を提供します。
 *
 * ## 機能概要
 * - TOTPシークレットの生成
 * - QRコード用URIの生成
 * - TOTPコードの検証
 * - バックアップコードの生成・検証
 * - シークレットの暗号化・復号化
 *
 * ## セキュリティ
 * - シークレットはAES-256-GCMで暗号化してDBに保存
 * - バックアップコードはSHA-256でハッシュ化して保存
 * - 使用済みバックアップコードは自動的に無効化
 *
 * @module lib/two-factor
 */

import { OTP } from 'otplib'
import * as QRCode from 'qrcode'
import crypto from 'crypto'

// OTPインスタンスを作成（TOTP戦略）
const otp = new OTP({ strategy: 'totp' })

// ============================================================
// 定数
// ============================================================

/**
 * TOTPの設定
 */
const TOTP_ISSUER = 'BON-LOG'
const TOTP_WINDOW = 1 // 前後1ステップを許容（30秒x3 = 90秒の猶予）

/**
 * バックアップコード設定
 */
const BACKUP_CODE_COUNT = 10 // 生成するバックアップコードの数
const BACKUP_CODE_LENGTH = 8 // 各コードの文字数

/**
 * 暗号化設定
 */
const ENCRYPTION_ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16 // 初期化ベクトルの長さ
const AUTH_TAG_LENGTH = 16 // 認証タグの長さ

// ============================================================
// 暗号化キー取得
// ============================================================

/**
 * 暗号化キーを取得する
 *
 * 環境変数から暗号化キーを取得します。
 * キーが設定されていない場合はエラーをスローします。
 *
 * @returns 暗号化キー（Buffer）
 * @throws 環境変数が設定されていない場合
 */
function getEncryptionKey(): Buffer {
  const key = process.env.TWO_FACTOR_ENCRYPTION_KEY

  if (!key) {
    throw new Error('TWO_FACTOR_ENCRYPTION_KEY is not configured')
  }

  // hex文字列をBufferに変換（32バイト = 256ビット）
  return Buffer.from(key, 'hex')
}

// ============================================================
// シークレット生成
// ============================================================

/**
 * TOTPシークレットを生成する
 *
 * Google Authenticator等で使用可能な
 * ランダムなBase32エンコードのシークレットを生成します。
 *
 * @returns 生成されたシークレット（Base32エンコード）
 *
 * @example
 * ```typescript
 * const secret = generateSecret()
 * // "JBSWY3DPEHPK3PXP" のような文字列
 * ```
 */
export function generateSecret(): string {
  return otp.generateSecret()
}

// ============================================================
// QRコード生成
// ============================================================

/**
 * TOTP用のotpauth URIを生成する
 *
 * @param secret - TOTPシークレット
 * @param email - ユーザーのメールアドレス
 * @returns otpauth URI
 *
 * @example
 * ```typescript
 * const uri = generateTOTPUri(secret, 'user@example.com')
 * // "otpauth://totp/BON-LOG:user@example.com?secret=XXX&issuer=BON-LOG"
 * ```
 */
export function generateTOTPUri(secret: string, email: string): string {
  return otp.generateURI({
    secret,
    issuer: TOTP_ISSUER,
    label: email,
    period: 30,
    digits: 6,
    algorithm: 'sha1',
  })
}

/**
 * QRコードをData URL（Base64）として生成する
 *
 * @param otpauthUri - otpauth URI
 * @returns QRコードのData URL（Base64形式）
 *
 * @example
 * ```typescript
 * const uri = generateTOTPUri(secret, email)
 * const qrCode = await generateQRCode(uri)
 * // "data:image/png;base64,..." のような文字列
 * ```
 */
export async function generateQRCode(otpauthUri: string): Promise<string> {
  return QRCode.toDataURL(otpauthUri, {
    errorCorrectionLevel: 'M',
    type: 'image/png',
    margin: 2,
    width: 256,
  })
}

// ============================================================
// TOTP検証
// ============================================================

/**
 * TOTPコードを検証する
 *
 * ユーザーが入力した6桁のTOTPコードが正しいかどうかを検証します。
 * 時間のずれを考慮して、前後1ステップ（合計90秒）を許容します。
 *
 * @param token - ユーザーが入力した6桁のコード
 * @param secret - 保存されているシークレット（平文）
 * @returns 検証成功ならtrue、失敗ならfalse
 *
 * @example
 * ```typescript
 * const isValid = verifyTOTP('123456', secret)
 * if (isValid) {
 *   // 認証成功
 * }
 * ```
 */
export async function verifyTOTP(token: string, secret: string): Promise<boolean> {
  // 数字以外を除去して6桁に正規化
  const normalizedToken = token.replace(/\D/g, '').slice(0, 6)

  if (normalizedToken.length !== 6) {
    return false
  }

  try {
    // OTPインスタンスを使用して検証（epochToleranceで前後の許容範囲を設定）
    // TOTP_WINDOW * 30秒 = 許容する時間ウィンドウ
    const result = await otp.verify({
      secret,
      token: normalizedToken,
      epochTolerance: TOTP_WINDOW * 30, // 前後30秒を許容
    })
    return result.valid
  } catch {
    return false
  }
}

// ============================================================
// バックアップコード
// ============================================================

/**
 * バックアップコードを生成する
 *
 * 2FA認証のバックアップとして使用できるランダムなコードを生成します。
 * 各コードは1回のみ使用可能です。
 *
 * @returns 生成されたバックアップコードの配列（平文）
 *
 * @example
 * ```typescript
 * const codes = generateBackupCodes()
 * // ["ABCD1234", "EFGH5678", ...] のような配列
 * ```
 */
export function generateBackupCodes(): string[] {
  const codes: string[] = []
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    let code = ''
    const randomBytes = crypto.randomBytes(BACKUP_CODE_LENGTH)

    for (let j = 0; j < BACKUP_CODE_LENGTH; j++) {
      code += chars[randomBytes[j] % chars.length]
    }

    codes.push(code)
  }

  return codes
}

/**
 * バックアップコードをハッシュ化する
 *
 * バックアップコードをSHA-256でハッシュ化します。
 * DBに保存する際は必ずハッシュ化してから保存します。
 *
 * @param code - バックアップコード（平文）
 * @returns ハッシュ化されたコード
 */
export function hashBackupCode(code: string): string {
  // 大文字に正規化してからハッシュ化
  const normalizedCode = code.toUpperCase().replace(/[^A-Z0-9]/g, '')
  return crypto.createHash('sha256').update(normalizedCode).digest('hex')
}

/**
 * バックアップコードを検証する
 *
 * ユーザーが入力したバックアップコードが、
 * 保存されているハッシュと一致するかを検証します。
 *
 * @param inputCode - ユーザーが入力したコード
 * @param hashedCodes - DBに保存されているハッシュ化コードの配列
 * @returns 一致するコードのインデックス（見つからない場合は-1）
 *
 * @example
 * ```typescript
 * const index = verifyBackupCode('ABCD1234', hashedCodes)
 * if (index !== -1) {
 *   // 認証成功、hashedCodes[index]を削除して使用済みにする
 * }
 * ```
 */
export function verifyBackupCode(
  inputCode: string,
  hashedCodes: string[]
): number {
  const inputHash = hashBackupCode(inputCode)

  for (let i = 0; i < hashedCodes.length; i++) {
    // タイミング攻撃を防ぐため、crypto.timingSafeEqualを使用
    const storedHash = Buffer.from(hashedCodes[i], 'hex')
    const inputHashBuffer = Buffer.from(inputHash, 'hex')

    if (
      storedHash.length === inputHashBuffer.length &&
      crypto.timingSafeEqual(storedHash, inputHashBuffer)
    ) {
      return i
    }
  }

  return -1
}

// ============================================================
// シークレット暗号化
// ============================================================

/**
 * シークレットを暗号化する
 *
 * AES-256-GCMを使用してシークレットを暗号化します。
 * 結果は「IV:暗号文:認証タグ」の形式でBase64エンコードされます。
 *
 * @param plainSecret - 暗号化するシークレット（平文）
 * @returns 暗号化されたシークレット
 *
 * @example
 * ```typescript
 * const encrypted = encryptSecret('JBSWY3DPEHPK3PXP')
 * // "base64encodedstring..." のような文字列
 * ```
 */
export function encryptSecret(plainSecret: string): string {
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(IV_LENGTH)

  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv)

  let encrypted = cipher.update(plainSecret, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  const authTag = cipher.getAuthTag()

  // IV + 暗号文 + 認証タグをBase64でエンコード
  const combined = Buffer.concat([
    iv,
    Buffer.from(encrypted, 'hex'),
    authTag,
  ])

  return combined.toString('base64')
}

/**
 * シークレットを復号化する
 *
 * 暗号化されたシークレットを復号化して平文に戻します。
 *
 * @param encryptedSecret - 暗号化されたシークレット
 * @returns 復号化されたシークレット（平文）
 * @throws 復号化に失敗した場合
 *
 * @example
 * ```typescript
 * const secret = decryptSecret(encryptedSecret)
 * // "JBSWY3DPEHPK3PXP" のような文字列
 * ```
 */
export function decryptSecret(encryptedSecret: string): string {
  const key = getEncryptionKey()

  const combined = Buffer.from(encryptedSecret, 'base64')

  // IV、暗号文、認証タグを分離
  const iv = combined.subarray(0, IV_LENGTH)
  const authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH)
  const encrypted = combined.subarray(IV_LENGTH, combined.length - AUTH_TAG_LENGTH)

  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encrypted)
  decrypted = Buffer.concat([decrypted, decipher.final()])

  return decrypted.toString('utf8')
}

// ============================================================
// ユーティリティ関数
// ============================================================

/**
 * TOTPコードをフォーマットする
 *
 * 入力されたコードを6桁の数字に正規化します。
 * スペースやハイフンを除去します。
 *
 * @param code - 入力されたコード
 * @returns フォーマットされたコード（数字のみ）
 */
export function formatTOTPCode(code: string): string {
  return code.replace(/[^0-9]/g, '').slice(0, 6)
}

/**
 * バックアップコードをフォーマットする
 *
 * 入力されたコードを正規化します。
 * スペースやハイフンを除去し、大文字に変換します。
 *
 * @param code - 入力されたコード
 * @returns フォーマットされたコード
 */
export function formatBackupCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

/**
 * コードがTOTPかバックアップコードかを判定する
 *
 * @param code - 入力されたコード
 * @returns 'totp' または 'backup'
 */
export function detectCodeType(code: string): 'totp' | 'backup' {
  const cleaned = code.replace(/[^A-Za-z0-9]/g, '')

  // 数字のみで6桁ならTOTP
  if (/^\d{6}$/.test(cleaned)) {
    return 'totp'
  }

  // それ以外はバックアップコード
  return 'backup'
}
