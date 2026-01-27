/**
 * 古いイベントを削除するCronジョブ
 *
 * 終了日から6ヶ月経過したイベントをデータベースから削除します。
 * Vercel Cron Jobsにより毎月1日0時(JST)に自動実行されます。
 *
 * @module app/api/cron/cleanup-events
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * Cron Job用のシークレットキーを検証
 * Vercelの環境変数 CRON_SECRET と一致するか確認
 */
function validateCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  // CRON_SECRETが未設定の場合はVercel環境からの呼び出しのみ許可
  if (!cronSecret) {
    // Vercel Cron Jobsは自動的にAuthorizationヘッダーを付与
    return authHeader === `Bearer ${process.env.VERCEL_CRON_SECRET}`
  }

  return authHeader === `Bearer ${cronSecret}`
}

/**
 * GET /api/cron/cleanup-events
 *
 * 終了日から6ヶ月以上経過したイベントを削除
 */
export async function GET(request: NextRequest) {
  // 認証チェック
  if (!validateCronSecret(request)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    // 6ヶ月前の日付を計算
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    // 終了日がnullの場合は開始日を使用
    // 終了日または開始日が6ヶ月以上前のイベントを削除
    const result = await prisma.event.deleteMany({
      where: {
        OR: [
          // 終了日がある場合：終了日が6ヶ月以上前
          {
            endDate: {
              not: null,
              lt: sixMonthsAgo,
            },
          },
          // 終了日がない場合：開始日が6ヶ月以上前
          {
            endDate: null,
            startDate: {
              lt: sixMonthsAgo,
            },
          },
        ],
      },
    })

    console.log(`[Cron] Deleted ${result.count} old events`)

    return NextResponse.json({
      success: true,
      deletedCount: result.count,
      cutoffDate: sixMonthsAgo.toISOString(),
    })
  } catch (error) {
    console.error('[Cron] Event cleanup error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
