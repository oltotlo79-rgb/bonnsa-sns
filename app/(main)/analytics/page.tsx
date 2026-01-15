import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { isPremiumUser } from '@/lib/premium'
import {
  getPostAnalytics,
  getLikeAnalytics,
  getQuoteAnalytics,
  getKeywordAnalytics,
  getEngagementTrend,
} from '@/lib/actions/analytics'
import { AnalyticsDashboard } from '@/components/analytics/AnalyticsDashboard'
import { PremiumUpgradeCard } from '@/components/subscription/PremiumUpgradeCard'
import { BarChart3 } from 'lucide-react'

export const metadata = {
  title: '投稿分析 | BONLOG',
}

export default async function AnalyticsPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/login')
  }

  const isPremium = await isPremiumUser(session.user.id)

  if (!isPremium) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4">
        <div className="flex items-center gap-3 mb-6">
          <BarChart3 className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-bold">投稿分析</h1>
        </div>
        <PremiumUpgradeCard
          title="投稿分析は有料会員限定機能です"
          description="プレミアム会員になると、投稿のパフォーマンスを詳しく分析できます。"
        />
      </div>
    )
  }

  const [postAnalytics, likeAnalytics, quoteAnalytics, keywordAnalytics, engagementTrend] =
    await Promise.all([
      getPostAnalytics(),
      getLikeAnalytics(),
      getQuoteAnalytics(),
      getKeywordAnalytics(),
      getEngagementTrend(),
    ])

  return (
    <div className="max-w-4xl mx-auto py-4 px-4">
      <div className="flex items-center gap-3 mb-6">
        <BarChart3 className="w-6 h-6 text-primary" />
        <h1 className="text-xl font-bold">投稿分析</h1>
        <span className="text-sm text-muted-foreground">過去30日</span>
      </div>

      <AnalyticsDashboard
        postAnalytics={'error' in postAnalytics ? null : postAnalytics}
        likeAnalytics={'error' in likeAnalytics ? null : likeAnalytics}
        quoteAnalytics={'error' in quoteAnalytics ? null : quoteAnalytics}
        keywordAnalytics={'error' in keywordAnalytics ? null : keywordAnalytics}
        engagementTrend={'error' in engagementTrend ? null : engagementTrend}
      />
    </div>
  )
}
