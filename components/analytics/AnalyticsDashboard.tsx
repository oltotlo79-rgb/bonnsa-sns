/**
 * @file AnalyticsDashboard.tsx
 * @description アナリティクスダッシュボードコンポーネント
 *
 * ユーザーの投稿活動に関する統計情報を一覧表示するダッシュボードコンポーネント。
 * 投稿数、いいね数、コメント数などの基本統計から、時間帯別分析、キーワード分析、
 * 引用投稿一覧まで、包括的なアナリティクス情報を提供する。
 *
 * @features
 * - 投稿数、いいね数、コメント数、平均エンゲージメントの統計カード表示
 * - エンゲージメント推移のチャート表示
 * - 時間帯別・曜日別のいいねヒートマップ
 * - よく使用するキーワードのクラウド表示
 * - 引用された投稿の一覧表示
 *
 * @example
 * // 使用例
 * <AnalyticsDashboard
 *   postAnalytics={postData}
 *   likeAnalytics={likeData}
 *   quoteAnalytics={quoteData}
 *   keywordAnalytics={keywordData}
 *   engagementTrend={trendData}
 * />
 */
'use client'

// UIコンポーネント: shadcn/uiのカードコンポーネント（カード型レイアウト用）
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// 統計カードコンポーネント: 数値とアイコンを組み合わせた統計表示
import { StatCard } from './StatCard'

// いいねチャートコンポーネント: 日別のいいね・コメント推移を表示
import { LikeChart } from './LikeChart'

// キーワードクラウドコンポーネント: よく使うキーワードを視覚的に表示
import { KeywordCloud } from './KeywordCloud'

// 引用投稿一覧コンポーネント: 自分の投稿が引用された一覧を表示
import { QuoteList } from './QuoteList'

// 時間帯別ヒートマップコンポーネント: 時間帯・曜日別のいいね分布を表示
import { TimeHeatmap } from './TimeHeatmap'

// アイコンライブラリ: 各統計項目に対応するアイコン
// FileText: 投稿数用、Heart: いいね用、MessageSquare: コメント用、TrendingUp: エンゲージメント用
import { FileText, Heart, MessageSquare, TrendingUp } from 'lucide-react'

/**
 * 投稿分析データの型定義
 * ユーザーの投稿に関する統計情報を保持
 */
type PostAnalytics = {
  /** 総投稿数 */
  totalPosts: number
  /** 獲得した総いいね数 */
  totalLikes: number
  /** 獲得した総コメント数 */
  totalComments: number
  /** 平均エンゲージメント率（いいね+コメント / 投稿数） */
  avgEngagement: number
  /** エンゲージメントが高い上位投稿の配列 */
  topPosts: {
    /** 投稿ID */
    id: string
    /** 投稿内容（nullの場合はメディアのみの投稿） */
    content: string | null
    /** 投稿日時 */
    createdAt: Date
    /** いいね数 */
    likeCount: number
    /** コメント数 */
    commentCount: number
  }[]
  /** 全投稿の配列 */
  posts: {
    /** 投稿ID */
    id: string
    /** 投稿内容 */
    content: string | null
    /** 投稿日時 */
    createdAt: Date
    /** いいね数 */
    likeCount: number
    /** コメント数 */
    commentCount: number
  }[]
}

/**
 * いいね分析データの型定義
 * いいねの獲得パターンを時間帯・曜日で分析
 */
type LikeAnalytics = {
  /** 獲得した総いいね数 */
  totalLikes: number
  /** 時間帯別いいね数（0-23時の配列、24要素） */
  hourlyData: number[]
  /** 曜日別いいね数（日-土の配列、7要素） */
  weekdayData: number[]
  /** 日別いいね数の推移データ */
  dailyData: { date: string; count: number }[]
  /** 最もいいねが多い時間帯（0-23） */
  peakHour: number
  /** 最もいいねが多い曜日（0=日曜 - 6=土曜） */
  peakWeekday: number
}

/**
 * 引用・リポスト分析データの型定義
 * 自分の投稿がどのように引用・リポストされたかの統計
 */
type QuoteAnalytics = {
  /** 引用された総数 */
  totalQuotes: number
  /** リポストされた総数 */
  totalReposts: number
  /** 引用投稿の詳細一覧 */
  quotes: {
    /** 引用投稿のID */
    id: string
    /** 引用投稿のコンテンツ */
    content: string | null
    /** 引用したユーザー情報 */
    user: { id: string; nickname: string; avatarUrl: string | null }
    /** 元の投稿（自分の投稿）のID */
    originalPostId: string | null
    /** 元の投稿（自分の投稿）のコンテンツ */
    originalContent: string | null
    /** 引用投稿が獲得したいいね数 */
    likeCount: number
    /** 引用投稿が獲得したコメント数 */
    commentCount: number
    /** 引用投稿の作成日時 */
    createdAt: Date
  }[]
}

/**
 * キーワード分析データの型定義
 * 投稿でよく使用されるキーワードの統計
 */
type KeywordAnalytics = {
  /** キーワードと出現回数のペア配列（出現回数順） */
  keywords: { word: string; count: number }[]
  /** 投稿内の総単語数 */
  totalWords: number
  /** ユニークな単語数 */
  uniqueWords: number
}

/**
 * エンゲージメント推移データの型定義
 * 日別のエンゲージメント推移を追跡
 */
type EngagementTrend = {
  /** 日別の推移データ配列 */
  trend: {
    /** 日付（YYYY-MM-DD形式） */
    date: string
    /** その日の投稿数 */
    posts: number
    /** その日のいいね数 */
    likes: number
    /** その日のコメント数 */
    comments: number
    /** その日のエンゲージメント率 */
    engagement: number
  }[]
}

/**
 * AnalyticsDashboardコンポーネントのProps型定義
 * 各種分析データをオプショナルで受け取る（データがない場合はnull）
 */
type AnalyticsDashboardProps = {
  /** 投稿分析データ（取得できない場合はnull） */
  postAnalytics: PostAnalytics | null
  /** いいね分析データ（取得できない場合はnull） */
  likeAnalytics: LikeAnalytics | null
  /** 引用分析データ（取得できない場合はnull） */
  quoteAnalytics: QuoteAnalytics | null
  /** キーワード分析データ（取得できない場合はnull） */
  keywordAnalytics: KeywordAnalytics | null
  /** エンゲージメント推移データ（取得できない場合はnull） */
  engagementTrend: EngagementTrend | null
}

/**
 * アナリティクスダッシュボードコンポーネント
 *
 * ユーザーの投稿活動に関する包括的な統計情報を表示する。
 * 各セクションは対応するデータが存在する場合のみレンダリングされる。
 *
 * @param props - AnalyticsDashboardProps
 * @param props.postAnalytics - 投稿に関する統計データ
 * @param props.likeAnalytics - いいねの時間帯・曜日別分析データ
 * @param props.quoteAnalytics - 引用・リポストの分析データ
 * @param props.keywordAnalytics - キーワード使用頻度の分析データ
 * @param props.engagementTrend - エンゲージメントの日別推移データ
 * @returns アナリティクスダッシュボードのJSX要素
 */
export function AnalyticsDashboard({
  postAnalytics,
  likeAnalytics,
  quoteAnalytics,
  keywordAnalytics,
  engagementTrend,
}: AnalyticsDashboardProps) {
  return (
    <div className="space-y-6">
      {/*
        統計サマリーセクション
        投稿数、いいね数、コメント数、平均エンゲージメントの4つの統計カードを表示
        レスポンシブ対応: モバイルは2列、デスクトップは4列
      */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* 投稿数カード: ユーザーの総投稿数を表示 */}
        <StatCard
          title="投稿数"
          value={postAnalytics?.totalPosts ?? 0}
          icon={FileText}
        />
        {/* いいねカード: 獲得した総いいね数を表示 */}
        <StatCard
          title="いいね"
          value={postAnalytics?.totalLikes ?? 0}
          icon={Heart}
        />
        {/* コメントカード: 獲得した総コメント数を表示 */}
        <StatCard
          title="コメント"
          value={postAnalytics?.totalComments ?? 0}
          icon={MessageSquare}
        />
        {/* 平均エンゲージメントカード: 投稿あたりの平均エンゲージメントを小数点1桁で表示 */}
        <StatCard
          title="平均エンゲージメント"
          value={postAnalytics?.avgEngagement?.toFixed(1) ?? '0'}
          icon={TrendingUp}
        />
      </div>

      {/*
        エンゲージメント推移チャートセクション
        日別のいいね・コメント数の推移を積み上げ棒グラフで表示
        engagementTrendデータが存在する場合のみ表示
      */}
      {engagementTrend && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">エンゲージメント推移</CardTitle>
          </CardHeader>
          <CardContent>
            {/* LikeChartに日別データを渡してチャート描画 */}
            <LikeChart data={engagementTrend.trend.map(t => ({ date: t.date, likes: t.likes, comments: t.comments }))} />
          </CardContent>
        </Card>
      )}

      {/*
        時間帯別ヒートマップセクション
        いつの時間帯・曜日にいいねが多いかをヒートマップで視覚化
        likeAnalyticsデータが存在する場合のみ表示
      */}
      {likeAnalytics && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">時間帯別いいね</CardTitle>
          </CardHeader>
          <CardContent>
            {/* TimeHeatmapに時間帯別・曜日別データを渡してヒートマップ描画 */}
            <TimeHeatmap
              hourlyData={likeAnalytics.hourlyData}
              weekdayData={likeAnalytics.weekdayData}
            />
          </CardContent>
        </Card>
      )}

      {/*
        2カラムセクション: キーワードクラウドと引用投稿一覧
        デスクトップでは横並び、モバイルでは縦並び
      */}
      <div className="grid md:grid-cols-2 gap-6">
        {/*
          キーワードクラウドセクション
          投稿でよく使用されるキーワードを視覚的に表示
          keywordAnalyticsデータが存在する場合のみ表示
        */}
        {keywordAnalytics && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">よく使うキーワード</CardTitle>
            </CardHeader>
            <CardContent>
              {/* KeywordCloudにキーワードデータを渡して描画 */}
              <KeywordCloud keywords={keywordAnalytics.keywords} />
            </CardContent>
          </Card>
        )}

        {/*
          引用投稿一覧セクション
          自分の投稿が他ユーザーに引用された一覧を表示
          quoteAnalyticsデータが存在する場合のみ表示
        */}
        {quoteAnalytics && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {/* 引用された総数をタイトルに表示 */}
                引用された投稿 ({quoteAnalytics.totalQuotes})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* QuoteListに引用投稿データを渡して一覧描画 */}
              <QuoteList quotes={quoteAnalytics.quotes} />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
