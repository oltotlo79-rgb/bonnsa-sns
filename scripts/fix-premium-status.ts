/**
 * プレミアムステータスを手動で修正するスクリプト
 *
 * 使用方法:
 * npx tsx scripts/fix-premium-status.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const userId = 'cmkioi9h5000004jpe7r1nkld'
  const stripeCustomerId = 'cus_TpfU3BsT6GgCe3'
  const stripeSubscriptionId = 'sub_1Ss0EnCvNmTUMgj1gBhkDpS2'

  // 1ヶ月後の日付を設定
  const premiumExpiresAt = new Date()
  premiumExpiresAt.setMonth(premiumExpiresAt.getMonth() + 1)

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      isPremium: true,
      stripeCustomerId,
      stripeSubscriptionId,
      premiumExpiresAt,
    },
  })

  console.log('✅ プレミアムステータスを更新しました:')
  console.log(`  ユーザーID: ${user.id}`)
  console.log(`  ニックネーム: ${user.nickname}`)
  console.log(`  isPremium: ${user.isPremium}`)
  console.log(`  有効期限: ${user.premiumExpiresAt}`)
}

main()
  .catch((e) => {
    console.error('❌ エラー:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
