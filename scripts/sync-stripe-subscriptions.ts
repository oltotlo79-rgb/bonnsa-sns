/**
 * Stripeサブスクリプション同期バッチスクリプト
 *
 * DBとStripeの状態を整合性チェックし、必要に応じて修正
 *
 * 使用方法:
 * npx ts-node scripts/sync-stripe-subscriptions.ts
 *
 * cronで毎日1時に実行する場合:
 * 0 1 * * * cd /path/to/project && npx ts-node scripts/sync-stripe-subscriptions.ts >> /var/log/cron.log 2>&1
 */

import { PrismaClient } from '@prisma/client'
import Stripe from 'stripe'

const prisma = new PrismaClient()
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-12-15.clover',
})

async function syncStripeSubscriptions() {
  const now = new Date()
  console.log(`[${now.toISOString()}] Stripeサブスクリプション同期を開始...`)

  try {
    // サブスクリプションIDを持つユーザーを取得
    const usersWithSubscription = await prisma.user.findMany({
      where: {
        stripeSubscriptionId: { not: null },
      },
      select: {
        id: true,
        email: true,
        nickname: true,
        isPremium: true,
        stripeSubscriptionId: true,
        premiumExpiresAt: true,
      },
    })

    console.log(`  対象ユーザー: ${usersWithSubscription.length}件`)

    let syncedCount = 0
    let errorCount = 0

    for (const user of usersWithSubscription) {
      try {
        // Stripeからサブスクリプション情報を取得
        const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId!)
        const subData = subscription as unknown as {
          status: string
          current_period_end: number
        }

        const shouldBePremium = subData.status === 'active' || subData.status === 'trialing'
        const currentPeriodEnd = new Date(subData.current_period_end * 1000)

        // 状態が一致しない場合は更新
        if (user.isPremium !== shouldBePremium ||
            user.premiumExpiresAt?.getTime() !== currentPeriodEnd.getTime()) {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              isPremium: shouldBePremium,
              premiumExpiresAt: shouldBePremium ? currentPeriodEnd : null,
            },
          })

          console.log(`  [同期] User: ${user.nickname}`)
          console.log(`    isPremium: ${user.isPremium} -> ${shouldBePremium}`)
          console.log(`    期限: ${user.premiumExpiresAt?.toISOString()} -> ${currentPeriodEnd.toISOString()}`)
          syncedCount++
        }
      } catch (error: unknown) {
        const stripeError = error as { code?: string }
        // サブスクリプションが見つからない場合は削除された可能性
        if (stripeError.code === 'resource_missing') {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              isPremium: false,
              stripeSubscriptionId: null,
              premiumExpiresAt: null,
            },
          })
          console.log(`  [削除] User: ${user.nickname} - サブスクリプションが見つかりません`)
          syncedCount++
        } else {
          console.error(`  [エラー] User: ${user.nickname}`, error)
          errorCount++
        }
      }
    }

    console.log(`[${new Date().toISOString()}] 処理完了: 同期=${syncedCount}, エラー=${errorCount}`)
  } catch (error) {
    console.error('Stripe同期処理でエラーが発生:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

syncStripeSubscriptions()
