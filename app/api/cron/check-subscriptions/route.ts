import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendSubscriptionExpiringEmail, sendSubscriptionExpiredEmail } from '@/lib/email'

// Vercel Cron Job用 - サブスクリプション期限切れチェック
// cron: 0 0 * * * (毎日0時に実行)

export async function GET(request: NextRequest) {
  // Vercel CronまたはAPIキー認証
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()

    // 期限切れのプレミアム会員を取得
    const expiredUsers = await prisma.user.findMany({
      where: {
        isPremium: true,
        premiumExpiresAt: { lt: now },
      },
      select: {
        id: true,
        email: true,
        nickname: true,
        premiumExpiresAt: true,
      },
    })

    if (expiredUsers.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No expired subscriptions found',
        processedCount: 0,
      })
    }

    // プレミアムステータスをリセット
    const result = await prisma.user.updateMany({
      where: {
        id: { in: expiredUsers.map((u: typeof expiredUsers[number]) => u.id) },
      },
      data: {
        isPremium: false,
        // stripeCustomerIdとstripeSubscriptionIdは保持（再購読用）
      },
    })

    // 期限切れユーザーの予約投稿をキャンセル（pending状態のもののみ）
    const cancelledPosts = await prisma.scheduledPost.updateMany({
      where: {
        userId: { in: expiredUsers.map((u: typeof expiredUsers[number]) => u.id) },
        status: 'pending',
      },
      data: {
        status: 'cancelled',
      },
    })

    // 期限切れユーザーにメール通知を送信
    const emailResults = await Promise.allSettled(
      expiredUsers.map((user: typeof expiredUsers[number]) =>
        sendSubscriptionExpiredEmail(user.email, user.nickname)
      )
    )

    const emailsSent = emailResults.filter(
      (r) => r.status === 'fulfilled' && r.value.success
    ).length
    const emailsFailed = emailResults.filter(
      (r) => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)
    ).length

    console.log(
      `Subscription check: ${result.count} users expired, ${cancelledPosts.count} scheduled posts cancelled, ${emailsSent} emails sent, ${emailsFailed} emails failed`
    )

    return NextResponse.json({
      success: true,
      message: `Processed ${result.count} expired subscriptions`,
      processedCount: result.count,
      cancelledPostsCount: cancelledPosts.count,
      emailsSent,
      emailsFailed,
      expiredUsers: expiredUsers.map((u: typeof expiredUsers[number]) => ({
        id: u.id,
        nickname: u.nickname,
        expiredAt: u.premiumExpiresAt,
      })),
    })
  } catch (error) {
    console.error('Cron job error (check-subscriptions):', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// 期限切れ間近の通知（オプション）
export async function POST(request: NextRequest) {
  // Vercel CronまたはAPIキー認証
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()
    const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)

    // 3日以内に期限切れになるユーザーを取得
    const expiringUsers = await prisma.user.findMany({
      where: {
        isPremium: true,
        premiumExpiresAt: {
          gt: now,
          lte: threeDaysLater,
        },
      },
      select: {
        id: true,
        email: true,
        nickname: true,
        premiumExpiresAt: true,
      },
    })

    // 期限切れ間近のユーザーにメール通知を送信
    const emailResults = await Promise.allSettled(
      expiringUsers.map((user: typeof expiringUsers[number]) =>
        sendSubscriptionExpiringEmail(
          user.email,
          user.nickname,
          user.premiumExpiresAt!
        )
      )
    )

    const emailsSent = emailResults.filter(
      (r) => r.status === 'fulfilled' && r.value.success
    ).length
    const emailsFailed = emailResults.filter(
      (r) => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)
    ).length

    // アプリ内通知を作成（期限切れ3日前に1回のみ）
    // 重複を避けるため、通知を確認
    for (const user of expiringUsers) {
      const existingNotification = await prisma.notification.findFirst({
        where: {
          userId: user.id,
          type: 'subscription_expiring',
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // 過去24時間以内
        },
      })

      if (!existingNotification) {
        await prisma.notification.create({
          data: {
            userId: user.id,
            actorId: user.id, // システム通知は自身のIDを使用
            type: 'subscription_expiring',
          },
        }).catch((err) => {
          console.error('Failed to create in-app notification:', err)
        })
      }
    }

    console.log(
      `Subscription warning: ${expiringUsers.length} users expiring within 3 days, ${emailsSent} emails sent, ${emailsFailed} emails failed`
    )

    return NextResponse.json({
      success: true,
      message: `Found ${expiringUsers.length} users with expiring subscriptions`,
      expiringCount: expiringUsers.length,
      emailsSent,
      emailsFailed,
    })
  } catch (error) {
    console.error('Cron job error (check-subscriptions warning):', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// Vercel Cron設定
export const dynamic = 'force-dynamic'
export const maxDuration = 60
