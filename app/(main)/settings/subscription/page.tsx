import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getSubscriptionStatus } from '@/lib/actions/subscription'
import { SubscriptionStatus } from '@/components/subscription/SubscriptionStatus'
import { PricingCard } from '@/components/subscription/PricingCard'
import { PaymentHistory } from '@/components/subscription/PaymentHistory'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle, XCircle, Crown } from 'lucide-react'

export const metadata = {
  title: 'プラン管理 | BONLOG',
}

async function getPaymentHistory(userId: string) {
  return prisma.payment.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })
}

export default async function SubscriptionPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; canceled?: string }>
}) {
  const params = await searchParams
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/login')
  }

  const [statusResult, payments] = await Promise.all([
    getSubscriptionStatus(),
    getPaymentHistory(session.user.id),
  ])

  const isPremium = 'error' in statusResult ? false : statusResult.isPremium
  const premiumExpiresAt = 'error' in statusResult ? null : statusResult.premiumExpiresAt
  const subscription = 'error' in statusResult ? null : statusResult.subscription

  const monthlyPriceId = process.env.STRIPE_PRICE_ID_MONTHLY || ''
  const yearlyPriceId = process.env.STRIPE_PRICE_ID_YEARLY || ''

  return (
    <div className="max-w-2xl mx-auto py-4 px-4">
      <div className="flex items-center gap-3 mb-6">
        <Crown className="w-6 h-6 text-primary" />
        <h1 className="text-xl font-bold">プラン管理</h1>
      </div>

      {/* 成功/キャンセルメッセージ */}
      {params.success === 'true' && (
        <Alert className="mb-6 border-green-200 bg-green-50">
          <CheckCircle className="w-4 h-4 text-green-600" />
          <AlertDescription className="text-green-800">
            プレミアム会員への登録が完了しました。すべての機能をご利用いただけます。
          </AlertDescription>
        </Alert>
      )}

      {params.canceled === 'true' && (
        <Alert className="mb-6 border-yellow-200 bg-yellow-50">
          <XCircle className="w-4 h-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            登録がキャンセルされました。いつでも再度お申し込みいただけます。
          </AlertDescription>
        </Alert>
      )}

      {/* 現在のプラン */}
      {isPremium && (
        <div className="mb-6">
          <SubscriptionStatus
            isPremium={isPremium}
            premiumExpiresAt={premiumExpiresAt}
            subscription={subscription}
          />
        </div>
      )}

      {/* 料金プラン */}
      {!isPremium && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-4">料金プラン</h2>
          <div className="grid gap-4 md:grid-cols-2 pt-4">
            <PricingCard
              isPremium={isPremium}
              priceId={monthlyPriceId}
              priceType="monthly"
              planName="月額プラン"
              price={350}
              period="月"
              popular
            />
            <PricingCard
              isPremium={isPremium}
              priceId={yearlyPriceId}
              priceType="yearly"
              planName="年額プラン"
              price={3500}
              period="年"
              description="2ヶ月分お得"
            />
          </div>
        </div>
      )}

      {/* 支払い履歴 */}
      {payments.length > 0 && (
        <PaymentHistory payments={payments} />
      )}

      {/* 注意事項 */}
      <div className="mt-8 text-xs text-muted-foreground space-y-1">
        <p>・ お支払いはクレジットカードで承ります</p>
        <p>・ サブスクリプションはいつでもキャンセルできます</p>
        <p>・ キャンセル後も期間終了まで機能をご利用いただけます</p>
        <p>・ 料金は税込表示です</p>
      </div>
    </div>
  )
}
