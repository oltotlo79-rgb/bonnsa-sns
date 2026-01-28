'use server'

/**
 * メンテナンスモード管理用のServer Actions
 * @module lib/actions/maintenance
 */

import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { isAdmin } from '@/lib/actions/admin'
import { revalidatePath } from 'next/cache'

/**
 * メンテナンス設定の型
 */
export interface MaintenanceSettings {
  enabled: boolean
  startTime: string | null // ISO 8601形式
  endTime: string | null   // ISO 8601形式
  message: string
}

/**
 * デフォルトのメンテナンス設定
 */
const DEFAULT_SETTINGS: MaintenanceSettings = {
  enabled: false,
  startTime: null,
  endTime: null,
  message: 'ただいまメンテナンス中です。しばらくお待ちください。',
}

const MAINTENANCE_SETTING_KEY = 'maintenance_mode'

/**
 * メンテナンス設定を取得
 * キャッシュせず常に最新を取得
 */
export async function getMaintenanceSettings(): Promise<MaintenanceSettings> {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: MAINTENANCE_SETTING_KEY },
    })

    if (!setting) {
      return DEFAULT_SETTINGS
    }

    return setting.value as unknown as MaintenanceSettings
  } catch (error) {
    console.error('Failed to get maintenance settings:', error)
    return DEFAULT_SETTINGS
  }
}

/**
 * メンテナンスモードが有効かどうかをチェック
 * 時間範囲も考慮する
 */
export async function isMaintenanceMode(): Promise<boolean> {
  const settings = await getMaintenanceSettings()

  if (!settings.enabled) {
    return false
  }

  const now = new Date()

  // 開始時間が設定されている場合、まだ開始前ならfalse
  if (settings.startTime) {
    const startTime = new Date(settings.startTime)
    if (now < startTime) {
      return false
    }
  }

  // 終了時間が設定されている場合、終了後ならfalse
  if (settings.endTime) {
    const endTime = new Date(settings.endTime)
    if (now > endTime) {
      return false
    }
  }

  return true
}

/**
 * 現在のユーザーが管理者かどうかをチェック
 * ミドルウェアから呼び出し可能なバージョン
 */
export async function checkIsAdmin(userId: string): Promise<boolean> {
  try {
    const adminUser = await prisma.adminUser.findUnique({
      where: { userId },
    })
    return !!adminUser
  } catch {
    return false
  }
}

/**
 * メンテナンス設定を更新（管理者のみ）
 */
export async function updateMaintenanceSettings(
  settings: Partial<MaintenanceSettings>
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: '認証が必要です' }
    }

    const isAdminUser = await isAdmin()
    if (!isAdminUser) {
      return { success: false, error: '管理者権限が必要です' }
    }

    // 現在の設定を取得
    const currentSettings = await getMaintenanceSettings()

    // 新しい設定をマージ
    const newSettings: MaintenanceSettings = {
      ...currentSettings,
      ...settings,
    }

    // 設定を保存（Prisma Json型に変換）
    const jsonValue = JSON.parse(JSON.stringify(newSettings))
    await prisma.systemSetting.upsert({
      where: { key: MAINTENANCE_SETTING_KEY },
      update: {
        value: jsonValue,
        updatedBy: session.user.id,
      },
      create: {
        key: MAINTENANCE_SETTING_KEY,
        value: jsonValue,
        updatedBy: session.user.id,
      },
    })

    // 管理者ログに記録
    await prisma.adminLog.create({
      data: {
        adminId: session.user.id,
        action: settings.enabled ? 'maintenance_enabled' : 'maintenance_updated',
        targetType: 'system_setting',
        targetId: MAINTENANCE_SETTING_KEY,
        details: jsonValue,
      },
    })

    revalidatePath('/admin/maintenance')

    return { success: true }
  } catch (error) {
    console.error('Failed to update maintenance settings:', error)
    return { success: false, error: '設定の更新に失敗しました' }
  }
}

/**
 * メンテナンスモードを即座に有効/無効にする
 */
export async function toggleMaintenanceMode(
  enabled: boolean
): Promise<{ success: boolean; error?: string }> {
  return updateMaintenanceSettings({ enabled })
}
