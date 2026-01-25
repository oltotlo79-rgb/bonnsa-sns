/**
 * @file 投稿分析ページコンポーネント
 * @description ユーザーの投稿パフォーマンスを分析・表示するダッシュボードページ
 *              - プレミアム会員限定機能
 *              - 投稿数、いいね数、引用数、キーワード分析などを表示
 *              - Server Componentとして実装し、分析データをサーバーサイドで取得
 */

// Next.js のリダイレクト関数 - 未認証ユーザーをログインページへ誘導
import { redirect } from 'next/navigation'

// NextAuth.js の認証関数 - 現在のセッション情報を取得
import { auth } from '@/lib/auth'

// プレミアム会員判定関数 - ユーザーがプレミアム会員かどうかを確認
import { isPremiumUser } from '@/lib/premium'

// 分析データ取得用のServer Actions
// - getPostAnalytics: 投稿数の推移分析
// - getLikeAnalytics: いいね数の分析
// - getQuoteAnalytics: 引用・リポスト数の分析
// - getKeywordAnalytics: 投稿内のキーワード分析
// - getEngagementTrend: エンゲージメント（反応率）の推移
import {
  getPostAnalytics,
  getLikeAnalytics,
  getQuoteAnalytics,
  getKeywordAnalytics,
  getEngagementTrend,
} from '@/lib/actions/analytics'

// 分析ダッシュボードコンポーネント - グラフや統計情報を表示
import { AnalyticsDashboard } from '@/components/analytics/AnalyticsDashboard'

// プレミアムアップグレード促進カードコンポーネント - 無料会員向けの案内表示
import { PremiumUpgradeCard } from '@/components/subscription/PremiumUpgradeCard'

// lucide-react の棒グラフアイコン - ページヘッダーに使用
import { BarChart3 } from 'lucide-react'

/**
 * ページのメタデータ定義
 * ブラウザのタブに表示されるタイトルを設定
 */
export const metadata = {
  title: '投稿分析 | BONLOG',
}

/**
 * 投稿分析ページのメインコンポーネント
 *
 * @description
 * - 認証チェックを行い、未ログインユーザーはログインページへリダイレクト
 * - プレミアム会員かどうかを判定
 * - 無料会員の場合はプレミアムアップグレード案内を表示
 * - プレミアム会員の場合は各種分析データを並列取得してダッシュボードを表示
 *
 * @returns 投稿分析ページのJSX
 */
export default async function AnalyticsPage() {
  // 現在のセッション情報を取得
  const session = await auth()

  // 未認証の場合はログインページへリダイレクト
  if (!session?.user?.id) {
    redirect('/login')
  }

  // プレミアム会員かどうかを判定
  const isPremium = await isPremiumUser(session.user.id)

  // 無料会員の場合はプレミアムアップグレード案内を表示
  if (!isPremium) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4">
        {/* ページヘッダー */}
        <div className="flex items-center gap-3 mb-6">
          <BarChart3 className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-bold">投稿分析</h1>
        </div>

        {/* プレミアム会員へのアップグレード促進カード */}
        <PremiumUpgradeCard
          title="投稿分析は有料会員限定機能です"
          description="プレミアム会員になると、投稿のパフォーマンスを詳しく分析できます。"
        />
      </div>
    )
  }

  // プレミアム会員の場合: 各種分析データを並列で取得（パフォーマンス最適化）
  const [postAnalytics, likeAnalytics, quoteAnalytics, keywordAnalytics, engagementTrend] =
    await Promise.all([
      getPostAnalytics(),      // 投稿数の推移
      getLikeAnalytics(),      // いいね数の分析
      getQuoteAnalytics(),     // 引用・リポスト数の分析
      getKeywordAnalytics(),   // キーワード分析
      getEngagementTrend(),    // エンゲージメント推移
    ])

  return (
    <div className="max-w-4xl mx-auto py-4 px-4">
      {/* ページヘッダー */}
      <div className="flex items-center gap-3 mb-6">
        <BarChart3 className="w-6 h-6 text-primary" />
        <h1 className="text-xl font-bold">投稿分析</h1>
        {/* 分析期間の表示 */}
        <span className="text-sm text-muted-foreground">過去30日</span>
      </div>

      {/* 分析ダッシュボード */}
      {/* 各分析データをコンポーネントに渡す（エラーの場合はnullを渡す） */}
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
