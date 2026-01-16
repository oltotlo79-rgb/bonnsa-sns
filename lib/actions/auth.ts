'use server'

import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { headers } from 'next/headers'
import { sendPasswordResetEmail } from '@/lib/email'
import {
  checkLoginAttempt,
  recordFailedLogin,
  resetLoginAttempts,
  getLoginKey,
} from '@/lib/login-tracker'
import { sanitizeInput } from '@/lib/sanitize'
import {
  logLoginFailure,
  logLoginLockout,
  logRegisterSuccess,
  logPasswordResetRequest,
  logPasswordResetSuccess,
} from '@/lib/security-logger'

// IPアドレス取得
async function getClientIp(): Promise<string> {
  const headersList = await headers()
  const cfIp = headersList.get('cf-connecting-ip')
  if (cfIp) return cfIp
  const xForwardedFor = headersList.get('x-forwarded-for')
  if (xForwardedFor) return xForwardedFor.split(',')[0].trim()
  const xRealIp = headersList.get('x-real-ip')
  if (xRealIp) return xRealIp
  return 'unknown'
}

// ログイン前のチェック（レート制限）
export async function checkLoginAllowed(email: string) {
  const ip = await getClientIp()
  const key = getLoginKey(ip, sanitizeInput(email))
  const result = checkLoginAttempt(key)

  return {
    allowed: result.allowed,
    message: result.message,
    remainingAttempts: result.remainingAttempts,
  }
}

// ログイン失敗を記録
export async function recordLoginFailure(email: string) {
  const ip = await getClientIp()
  const sanitizedEmail = sanitizeInput(email)
  const key = getLoginKey(ip, sanitizedEmail)
  const result = recordFailedLogin(key)

  // セキュリティログに記録
  logLoginFailure(sanitizedEmail, ip, 'invalid_credentials')

  if (!result.allowed) {
    logLoginLockout(sanitizedEmail, ip)
  }

  return {
    locked: !result.allowed,
    message: result.message,
    remainingAttempts: result.remainingAttempts,
  }
}

// ログイン成功時のリセット
export async function clearLoginAttempts(email: string) {
  const ip = await getClientIp()
  const key = getLoginKey(ip, sanitizeInput(email))
  resetLoginAttempts(key)
}

export async function registerUser(data: {
  email: string
  password: string
  nickname: string
}) {
  // メール重複チェック
  const existingUser = await prisma.user.findUnique({
    where: { email: data.email },
  })

  if (existingUser) {
    return { error: 'このメールアドレスは既に登録されています' }
  }

  // パスワードハッシュ化
  const hashedPassword = await bcrypt.hash(data.password, 10)

  // ユーザー作成
  const user = await prisma.user.create({
    data: {
      email: data.email,
      password: hashedPassword,
      nickname: data.nickname,
    },
  })

  // セキュリティログに記録
  const ip = await getClientIp()
  logRegisterSuccess(user.id, ip)

  return { success: true, userId: user.id }
}

/**
 * パスワードリセットメール送信
 */
export async function requestPasswordReset(email: string) {
  const ip = await getClientIp()

  // セキュリティログに記録
  logPasswordResetRequest(email, ip)

  // ユーザーの存在確認（セキュリティのため、存在しなくても成功を返す）
  const user = await prisma.user.findUnique({
    where: { email },
  })

  if (!user) {
    // セキュリティ: ユーザーが存在しなくても成功を返す（列挙攻撃防止）
    return { success: true }
  }

  // 既存のトークンを削除
  await prisma.passwordResetToken.deleteMany({
    where: { email },
  })

  // 新しいトークンを生成
  const token = crypto.randomBytes(32).toString('hex')
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex')

  // トークンを保存（1時間有効）
  await prisma.passwordResetToken.create({
    data: {
      email,
      token: hashedToken,
      expires: new Date(Date.now() + 60 * 60 * 1000), // 1時間後
    },
  })

  // リセットURLを生成
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const resetUrl = `${baseUrl}/password-reset/confirm?token=${token}&email=${encodeURIComponent(email)}`

  // メール送信
  console.log('Attempting to send password reset email to:', email)
  console.log('Reset URL:', resetUrl)

  const result = await sendPasswordResetEmail(email, resetUrl)

  console.log('Email send result:', JSON.stringify(result))

  if (!result.success) {
    console.error('Failed to send password reset email:', result.error)
    return { error: 'メールの送信に失敗しました。しばらく経ってからお試しください。' }
  }

  return { success: true }
}

/**
 * パスワードリセット実行
 */
export async function resetPassword(data: {
  email: string
  token: string
  newPassword: string
}) {
  const { email, token, newPassword } = data

  // パスワードバリデーション
  if (newPassword.length < 8) {
    return { error: 'パスワードは8文字以上で入力してください' }
  }

  const hasLetter = /[a-zA-Z]/.test(newPassword)
  const hasNumber = /[0-9]/.test(newPassword)
  if (!hasLetter || !hasNumber) {
    return { error: 'パスワードはアルファベットと数字を両方含めてください' }
  }

  // トークンをハッシュ化して検索
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex')

  const resetToken = await prisma.passwordResetToken.findFirst({
    where: {
      email,
      token: hashedToken,
      expires: { gt: new Date() }, // 有効期限内
    },
  })

  if (!resetToken) {
    return { error: 'リセットリンクが無効または期限切れです。もう一度お試しください。' }
  }

  // ユーザー確認
  const user = await prisma.user.findUnique({
    where: { email },
  })

  if (!user) {
    return { error: 'ユーザーが見つかりません' }
  }

  // パスワードを更新
  const hashedPassword = await bcrypt.hash(newPassword, 10)

  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPassword },
  })

  // 使用済みトークンを削除
  await prisma.passwordResetToken.deleteMany({
    where: { email },
  })

  // セキュリティログに記録
  logPasswordResetSuccess(user.id)

  return { success: true }
}

/**
 * パスワードリセットトークンの検証
 */
export async function verifyPasswordResetToken(email: string, token: string) {
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex')

  const resetToken = await prisma.passwordResetToken.findFirst({
    where: {
      email,
      token: hashedToken,
      expires: { gt: new Date() },
    },
  })

  return { valid: !!resetToken }
}
