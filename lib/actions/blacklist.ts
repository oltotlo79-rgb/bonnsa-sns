/**
 * ブラックリスト管理用Server Actions
 *
 * メールアドレスとデバイスフィンガープリントのブラックリスト管理機能を提供します。
 *
 * @module lib/actions/blacklist
 */

'use server'

import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { isAdmin } from '@/lib/actions/admin'
import { revalidatePath } from 'next/cache'

// ============================================================
// 型定義
// ============================================================

type ActionResult<T = void> = { success: true; data?: T } | { error: string }

interface EmailBlacklistItem {
  id: string
  email: string
  reason: string | null
  createdBy: string
  createdAt: Date
}

interface DeviceBlacklistItem {
  id: string
  fingerprint: string
  reason: string | null
  originalEmail: string | null
  createdBy: string
  createdAt: Date
}

// ============================================================
// メールブラックリスト管理
// ============================================================

/**
 * メールアドレスをブラックリストに追加する
 */
export async function addEmailToBlacklist(
  email: string,
  reason?: string
): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  const isAdminUser = await isAdmin()
  if (!isAdminUser) {
    return { error: '管理者権限が必要です' }
  }

  // メールアドレスを小文字に正規化
  const normalizedEmail = email.toLowerCase().trim()

  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    return { error: '有効なメールアドレスを入力してください' }
  }

  try {
    // 既に登録されているかチェック
    const existing = await prisma.emailBlacklist.findUnique({
      where: { email: normalizedEmail },
    })

    if (existing) {
      return { error: 'このメールアドレスは既にブラックリストに登録されています' }
    }

    await prisma.emailBlacklist.create({
      data: {
        email: normalizedEmail,
        reason: reason || null,
        createdBy: session.user.id,
      },
    })

    revalidatePath('/admin/blacklist')
    return { success: true }
  } catch (error) {
    console.error('Failed to add email to blacklist:', error)
    return { error: 'ブラックリストへの追加に失敗しました' }
  }
}

/**
 * メールアドレスをブラックリストから削除する
 */
export async function removeEmailFromBlacklist(id: string): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  const isAdminUser = await isAdmin()
  if (!isAdminUser) {
    return { error: '管理者権限が必要です' }
  }

  try {
    await prisma.emailBlacklist.delete({
      where: { id },
    })

    revalidatePath('/admin/blacklist')
    return { success: true }
  } catch (error) {
    console.error('Failed to remove email from blacklist:', error)
    return { error: 'ブラックリストからの削除に失敗しました' }
  }
}

/**
 * メールブラックリストを取得する
 */
export async function getEmailBlacklist(options?: {
  search?: string
  limit?: number
  offset?: number
}): Promise<ActionResult<{ items: EmailBlacklistItem[]; total: number }>> {
  const isAdminUser = await isAdmin()
  if (!isAdminUser) {
    return { error: '管理者権限が必要です' }
  }

  const { search, limit = 50, offset = 0 } = options || {}

  try {
    const where = search
      ? { email: { contains: search, mode: 'insensitive' as const } }
      : {}

    const [items, total] = await Promise.all([
      prisma.emailBlacklist.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.emailBlacklist.count({ where }),
    ])

    return { success: true, data: { items, total } }
  } catch (error) {
    console.error('Failed to get email blacklist:', error)
    return { error: 'ブラックリストの取得に失敗しました' }
  }
}

/**
 * メールアドレスがブラックリストに登録されているかチェックする
 * （登録時のチェック用 - 管理者権限不要）
 */
export async function isEmailBlacklisted(email: string): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim()

  try {
    const entry = await prisma.emailBlacklist.findUnique({
      where: { email: normalizedEmail },
    })

    return !!entry
  } catch (error) {
    console.error('Failed to check email blacklist:', error)
    return false
  }
}

// ============================================================
// デバイスブラックリスト管理
// ============================================================

/**
 * デバイスをブラックリストに追加する
 */
export async function addDeviceToBlacklist(
  fingerprint: string,
  reason?: string,
  originalEmail?: string
): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  const isAdminUser = await isAdmin()
  if (!isAdminUser) {
    return { error: '管理者権限が必要です' }
  }

  if (!fingerprint || fingerprint.length < 10) {
    return { error: '有効なデバイスフィンガープリントを入力してください' }
  }

  try {
    // 既に登録されているかチェック
    const existing = await prisma.deviceBlacklist.findUnique({
      where: { fingerprint },
    })

    if (existing) {
      return { error: 'このデバイスは既にブラックリストに登録されています' }
    }

    await prisma.deviceBlacklist.create({
      data: {
        fingerprint,
        reason: reason || null,
        originalEmail: originalEmail || null,
        createdBy: session.user.id,
      },
    })

    revalidatePath('/admin/blacklist')
    return { success: true }
  } catch (error) {
    console.error('Failed to add device to blacklist:', error)
    return { error: 'ブラックリストへの追加に失敗しました' }
  }
}

/**
 * デバイスをブラックリストから削除する
 */
export async function removeDeviceFromBlacklist(id: string): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  const isAdminUser = await isAdmin()
  if (!isAdminUser) {
    return { error: '管理者権限が必要です' }
  }

  try {
    await prisma.deviceBlacklist.delete({
      where: { id },
    })

    revalidatePath('/admin/blacklist')
    return { success: true }
  } catch (error) {
    console.error('Failed to remove device from blacklist:', error)
    return { error: 'ブラックリストからの削除に失敗しました' }
  }
}

/**
 * デバイスブラックリストを取得する
 */
export async function getDeviceBlacklist(options?: {
  search?: string
  limit?: number
  offset?: number
}): Promise<ActionResult<{ items: DeviceBlacklistItem[]; total: number }>> {
  const isAdminUser = await isAdmin()
  if (!isAdminUser) {
    return { error: '管理者権限が必要です' }
  }

  const { search, limit = 50, offset = 0 } = options || {}

  try {
    const where = search
      ? {
          OR: [
            { fingerprint: { contains: search, mode: 'insensitive' as const } },
            { originalEmail: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}

    const [items, total] = await Promise.all([
      prisma.deviceBlacklist.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.deviceBlacklist.count({ where }),
    ])

    return { success: true, data: { items, total } }
  } catch (error) {
    console.error('Failed to get device blacklist:', error)
    return { error: 'ブラックリストの取得に失敗しました' }
  }
}

/**
 * デバイスがブラックリストに登録されているかチェックする
 * （登録・ログイン時のチェック用 - 管理者権限不要）
 */
export async function isDeviceBlacklisted(fingerprint: string): Promise<boolean> {
  if (!fingerprint) return false

  try {
    const entry = await prisma.deviceBlacklist.findUnique({
      where: { fingerprint },
    })

    return !!entry
  } catch (error) {
    console.error('Failed to check device blacklist:', error)
    return false
  }
}

// ============================================================
// ユーザーデバイス管理
// ============================================================

/**
 * ユーザーのデバイス情報を記録する
 */
export async function recordUserDevice(
  userId: string,
  fingerprint: string,
  userAgent?: string,
  ipAddress?: string
): Promise<void> {
  if (!userId || !fingerprint) return

  try {
    await prisma.userDevice.upsert({
      where: {
        userId_fingerprint: { userId, fingerprint },
      },
      create: {
        userId,
        fingerprint,
        userAgent: userAgent || null,
        ipAddress: ipAddress || null,
      },
      update: {
        lastSeenAt: new Date(),
        userAgent: userAgent || undefined,
        ipAddress: ipAddress || undefined,
      },
    })
  } catch (error) {
    console.error('Failed to record user device:', error)
  }
}

/**
 * ユーザーのデバイス一覧を取得する
 */
export async function getUserDevices(userId: string) {
  const isAdminUser = await isAdmin()
  if (!isAdminUser) {
    return { error: '管理者権限が必要です' }
  }

  try {
    const devices = await prisma.userDevice.findMany({
      where: { userId },
      orderBy: { lastSeenAt: 'desc' },
    })

    return { success: true, data: devices }
  } catch (error) {
    console.error('Failed to get user devices:', error)
    return { error: 'デバイス情報の取得に失敗しました' }
  }
}

/**
 * ユーザーの全デバイスをブラックリストに追加する
 */
export async function blacklistUserDevices(
  userId: string,
  reason?: string
): Promise<ActionResult<{ count: number }>> {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  const isAdminUser = await isAdmin()
  if (!isAdminUser) {
    return { error: '管理者権限が必要です' }
  }

  try {
    // ユーザー情報を取得
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    })

    // ユーザーのデバイスを取得
    const devices = await prisma.userDevice.findMany({
      where: { userId },
      select: { fingerprint: true },
    })

    if (devices.length === 0) {
      return { error: 'このユーザーに関連付けられたデバイスがありません' }
    }

    // 既存のブラックリストエントリを除外
    const existingBlacklist = await prisma.deviceBlacklist.findMany({
      where: {
        fingerprint: { in: devices.map((d) => d.fingerprint) },
      },
      select: { fingerprint: true },
    })

    const existingFingerprints = new Set(existingBlacklist.map((e) => e.fingerprint))
    const newDevices = devices.filter((d) => !existingFingerprints.has(d.fingerprint))

    if (newDevices.length === 0) {
      return { error: '全てのデバイスは既にブラックリストに登録されています' }
    }

    // 新規デバイスをブラックリストに追加
    await prisma.deviceBlacklist.createMany({
      data: newDevices.map((d) => ({
        fingerprint: d.fingerprint,
        reason: reason || `ユーザー ${userId} のデバイスを一括ブロック`,
        originalEmail: user?.email || null,
        createdBy: session.user.id,
      })),
    })

    revalidatePath('/admin/blacklist')
    return { success: true, data: { count: newDevices.length } }
  } catch (error) {
    console.error('Failed to blacklist user devices:', error)
    return { error: 'デバイスのブラックリスト追加に失敗しました' }
  }
}
