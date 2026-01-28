/**
 * メンテナンス状態確認API
 * ミドルウェアから呼び出されてメンテナンス状態と管理者かどうかを返す
 */

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * メンテナンス設定の型
 */
interface MaintenanceSettings {
  enabled: boolean
  startTime: string | null
  endTime: string | null
  message: string
}

/**
 * メンテナンスモードが有効かどうかをチェック
 */
function checkMaintenanceMode(settings: MaintenanceSettings): boolean {
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

export async function GET() {
  try {
    // セッション取得
    const session = await auth()
    const userId = session?.user?.id

    // 管理者かどうかチェック
    let isAdmin = false
    if (userId) {
      const adminUser = await prisma.adminUser.findUnique({
        where: { userId },
      })
      isAdmin = !!adminUser
    }

    // メンテナンス設定を取得
    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'maintenance_mode' },
    })

    let isMaintenanceMode = false
    if (setting) {
      const settings = setting.value as unknown as MaintenanceSettings
      isMaintenanceMode = checkMaintenanceMode(settings)
    }

    return NextResponse.json({
      isMaintenanceMode,
      isAdmin,
    })
  } catch (error) {
    console.error('Maintenance status check error:', error)
    // エラー時はメンテナンスモードではないとして扱う
    return NextResponse.json({
      isMaintenanceMode: false,
      isAdmin: false,
    })
  }
}
