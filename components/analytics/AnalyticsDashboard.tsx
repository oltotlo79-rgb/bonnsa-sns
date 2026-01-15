'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard } from './StatCard'
import { LikeChart } from './LikeChart'
import { KeywordCloud } from './KeywordCloud'
import { QuoteList } from './QuoteList'
import { TimeHeatmap } from './TimeHeatmap'
import { FileText, Heart, MessageSquare, TrendingUp } from 'lucide-react'

type PostAnalytics = {
  totalPosts: number
  totalLikes: number
  totalComments: number
  avgEngagement: number
  topPosts: {
    id: string
    content: string | null
    createdAt: Date
    likeCount: number
    commentCount: number
  }[]
  posts: {
    id: string
    content: string | null
    createdAt: Date
    likeCount: number
    commentCount: number
  }[]
}

type LikeAnalytics = {
  totalLikes: number
  hourlyData: number[]
  weekdayData: number[]
  dailyData: { date: string; count: number }[]
  peakHour: number
  peakWeekday: number
}

type QuoteAnalytics = {
  totalQuotes: number
  totalReposts: number
  quotes: {
    id: string
    content: string | null
    user: { id: string; nickname: string; avatarUrl: string | null }
    originalPostId: string | null
    originalContent: string | null
    likeCount: number
    commentCount: number
    createdAt: Date
  }[]
}

type KeywordAnalytics = {
  keywords: { word: string; count: number }[]
  totalWords: number
  uniqueWords: number
}

type EngagementTrend = {
  trend: { date: string; posts: number; likes: number; comments: number; engagement: number }[]
}

type AnalyticsDashboardProps = {
  postAnalytics: PostAnalytics | null
  likeAnalytics: LikeAnalytics | null
  quoteAnalytics: QuoteAnalytics | null
  keywordAnalytics: KeywordAnalytics | null
  engagementTrend: EngagementTrend | null
}

export function AnalyticsDashboard({
  postAnalytics,
  likeAnalytics,
  quoteAnalytics,
  keywordAnalytics,
  engagementTrend,
}: AnalyticsDashboardProps) {
  return (
    <div className="space-y-6">
      {/* 統計サマリー */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="投稿数"
          value={postAnalytics?.totalPosts ?? 0}
          icon={FileText}
        />
        <StatCard
          title="いいね"
          value={postAnalytics?.totalLikes ?? 0}
          icon={Heart}
        />
        <StatCard
          title="コメント"
          value={postAnalytics?.totalComments ?? 0}
          icon={MessageSquare}
        />
        <StatCard
          title="平均エンゲージメント"
          value={postAnalytics?.avgEngagement?.toFixed(1) ?? '0'}
          icon={TrendingUp}
        />
      </div>

      {/* いいね推移チャート */}
      {engagementTrend && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">エンゲージメント推移</CardTitle>
          </CardHeader>
          <CardContent>
            <LikeChart data={engagementTrend.trend.map(t => ({ date: t.date, likes: t.likes, comments: t.comments }))} />
          </CardContent>
        </Card>
      )}

      {/* 時間帯別ヒートマップ */}
      {likeAnalytics && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">時間帯別いいね</CardTitle>
          </CardHeader>
          <CardContent>
            <TimeHeatmap
              hourlyData={likeAnalytics.hourlyData}
              weekdayData={likeAnalytics.weekdayData}
            />
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* キーワードクラウド */}
        {keywordAnalytics && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">よく使うキーワード</CardTitle>
            </CardHeader>
            <CardContent>
              <KeywordCloud keywords={keywordAnalytics.keywords} />
            </CardContent>
          </Card>
        )}

        {/* 引用投稿一覧 */}
        {quoteAnalytics && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                引用された投稿 ({quoteAnalytics.totalQuotes})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <QuoteList quotes={quoteAnalytics.quotes} />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
