/**
 * 有料会員の期限切れチェックバッチスクリプト
 *
 * 使用方法:
 * npx ts-node scripts/check-premium-expiry.ts
 *
 * cronで毎日0時に実行する場合:
 * 0 0 * * * cd /path/to/project && npx ts-node scripts/check-premium-expiry.ts >> /var/log/cron.log 2>&1
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkPremiumExpiry() {
  const now = new Date()
  console.log(`[${now.toISOString()}] 有料会員の期限切れチェックを開始...`)

  try {
    // 期限切れの有料会員を取得
    const expiredUsers = await prisma.user.findMany({
      where: {
        isPremium: true,
        premiumExpiresAt: {
          lt: now,
        },
      },
      select: {
        id: true,
        email: true,
        nickname: true,
        premiumExpiresAt: true,
      },
    })

    console.log(`  期限切れ件数: ${expiredUsers.length}件`)

    if (expiredUsers.length > 0) {
      // 一括で無効化
      await prisma.user.updateMany({
        where: {
          id: { in: expiredUsers.map(u => u.id) },
        },
        data: {
          isPremium: false,
        },
      })

      // ログ出力
      for (const user of expiredUsers) {
        console.log(`  [無効化] User: ${user.nickname} (${user.email}), 期限: ${user.premiumExpiresAt?.toISOString()}`)
      }
    }

    console.log(`[${new Date().toISOString()}] 処理完了`)
  } catch (error) {
    console.error('有料会員の期限切れチェックでエラーが発生:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

checkPremiumExpiry()
