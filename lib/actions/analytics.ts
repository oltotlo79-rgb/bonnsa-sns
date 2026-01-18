/**
 * アナリティクス機能のServer Actions
 *
 * このファイルは、ユーザーの活動分析機能に関する
 * サーバーサイドの処理を提供します。
 *
 * ## 機能概要
 * - 投稿パフォーマンス分析
 * - いいね分析（時間帯別、曜日別）
 * - 引用投稿分析
 * - キーワード分析
 * - エンゲージメント推移
 * - 詳細アナリティクス
 * - ユーザー活動の記録
 *
 * ## 有料会員限定機能
 * 詳細な分析機能はプレミアム会員のみ利用可能:
 * - getPostAnalytics
 * - getLikeAnalytics
 * - getQuoteAnalytics
 * - getKeywordAnalytics
 * - getEngagementTrend
 * - getDetailedAnalytics
 *
 * ## 無料ユーザー向け機能
 * - getBasicStats（基本統計）
 *
 * ## 記録機能（内部API）
 * - recordProfileView
 * - recordPostView
 * - recordLikeReceived
 * - recordNewFollower
 *
 * @module lib/actions/analytics
 */

'use server'

// ============================================================
// インポート
// ============================================================

/**
 * Prismaクライアント
 * データベース操作に使用
 */
import { prisma } from '@/lib/db'

/**
 * 認証関数
 * NextAuth.jsのセッション取得に使用
 */
import { auth } from '@/lib/auth'

/**
 * プレミアム会員判定関数
 * 有料機能のアクセス制御に使用
 */
import { isPremiumUser } from '@/lib/premium'

/**
 * ロガー
 * エラーログの記録に使用
 */
import logger from '@/lib/logger'

// ============================================================
// 投稿パフォーマンス分析
// ============================================================

/**
 * 投稿パフォーマンス分析を取得
 *
 * ## 機能概要
 * 指定期間内の投稿のパフォーマンス（いいね数、コメント数）を分析します。
 *
 * ## 有料会員限定
 * プレミアム会員のみ利用可能
 *
 * ## 取得内容
 * - 総投稿数
 * - 総いいね数
 * - 総コメント数
 * - 平均エンゲージメント
 * - ベストパフォーマンス投稿（上位5件）
 * - 全投稿のリスト
 *
 * @param days - 分析対象期間（デフォルト: 30日）
 * @returns 分析結果、または { error: string }
 *
 * @example
 * ```typescript
 * const analytics = await getPostAnalytics(30)
 *
 * console.log(`総投稿数: ${analytics.totalPosts}`)
 * console.log(`平均エンゲージメント: ${analytics.avgEngagement}`)
 * ```
 */
export async function getPostAnalytics(days = 30) {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // ------------------------------------------------------------
  // 有料会員チェック
  // ------------------------------------------------------------

  /**
   * プレミアム会員かどうかを確認
   */
  const isPremium = await isPremiumUser(session.user.id)
  if (!isPremium) {
    return { error: '分析機能は有料会員限定です' }
  }

  // ------------------------------------------------------------
  // 期間の計算
  // ------------------------------------------------------------

  /**
   * 開始日を計算
   * 現在日時から days 日前
   */
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  // ------------------------------------------------------------
  // 投稿データの取得
  // ------------------------------------------------------------

  /**
   * 指定期間内の自分の投稿を取得
   *
   * _count でいいね数とコメント数を集計
   */
  const posts = await prisma.post.findMany({
    where: {
      userId: session.user.id,
      createdAt: { gte: startDate },
    },
    include: {
      _count: { select: { likes: true, comments: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  // ------------------------------------------------------------
  // 集計
  // ------------------------------------------------------------

  /**
   * 総いいね数を計算
   *
   * reduce で配列を1つの値に集約
   */
  const totalLikes = posts.reduce((sum: number, p: typeof posts[number]) => sum + p._count.likes, 0)

  /**
   * 総コメント数を計算
   */
  const totalComments = posts.reduce((sum: number, p: typeof posts[number]) => sum + p._count.comments, 0)

  /**
   * 平均エンゲージメントを計算
   *
   * エンゲージメント = いいね数 + コメント数
   */
  const avgEngagement = posts.length > 0
    ? (totalLikes + totalComments) / posts.length
    : 0

  // ------------------------------------------------------------
  // ベストパフォーマンス投稿の抽出
  // ------------------------------------------------------------

  /**
   * エンゲージメント順にソートして上位5件を取得
   *
   * [...posts] でコピーを作成（元の配列を変更しない）
   */
  type PostWithCount = typeof posts[number]
  const topPosts = [...posts]
    .sort((a: PostWithCount, b: PostWithCount) => (b._count.likes + b._count.comments) - (a._count.likes + a._count.comments))
    .slice(0, 5)

  // ------------------------------------------------------------
  // 結果の整形と返却
  // ------------------------------------------------------------

  return {
    totalPosts: posts.length,
    totalLikes,
    totalComments,
    /**
     * 小数点第1位に丸める
     */
    avgEngagement: Math.round(avgEngagement * 10) / 10,
    /**
     * ベストパフォーマンス投稿
     */
    topPosts: topPosts.map((p: PostWithCount) => ({
      id: p.id,
      content: p.content?.slice(0, 100) ?? null,  // 100文字に切り詰め
      createdAt: p.createdAt,
      likeCount: p._count.likes,
      commentCount: p._count.comments,
    })),
    /**
     * 全投稿
     */
    posts: posts.map((p: PostWithCount) => ({
      id: p.id,
      content: p.content?.slice(0, 100) ?? null,
      createdAt: p.createdAt,
      likeCount: p._count.likes,
      commentCount: p._count.comments,
    })),
  }
}

// ============================================================
// いいね分析
// ============================================================

/**
 * いいね分析を取得（時間帯別、曜日別）
 *
 * ## 機能概要
 * 自分の投稿へのいいねを時間帯・曜日別に分析します。
 *
 * ## 有料会員限定
 * プレミアム会員のみ利用可能
 *
 * ## 取得内容
 * - 総いいね数
 * - 時間帯別データ（0〜23時）
 * - 曜日別データ（日〜土）
 * - 日別データ
 * - ピーク時間帯
 * - ピーク曜日
 *
 * ## 活用方法
 * 最もエンゲージメントが高い時間帯・曜日を把握し、
 * 投稿タイミングを最適化できる
 *
 * @param days - 分析対象期間（デフォルト: 30日）
 * @returns 分析結果、または { error: string }
 *
 * @example
 * ```typescript
 * const analytics = await getLikeAnalytics(30)
 *
 * console.log(`ピーク時間帯: ${analytics.peakHour}時`)
 * console.log(`ピーク曜日: ${['日', '月', '火', '水', '木', '金', '土'][analytics.peakWeekday]}`)
 * ```
 */
export async function getLikeAnalytics(days = 30) {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // ------------------------------------------------------------
  // 有料会員チェック
  // ------------------------------------------------------------

  const isPremium = await isPremiumUser(session.user.id)
  if (!isPremium) {
    return { error: '分析機能は有料会員限定です' }
  }

  // ------------------------------------------------------------
  // 期間の計算
  // ------------------------------------------------------------

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  // ------------------------------------------------------------
  // いいねデータの取得
  // ------------------------------------------------------------

  /**
   * 自分の投稿へのいいねを取得
   *
   * post: { userId: session.user.id } で
   * 自分の投稿へのいいねに絞り込み
   */
  const likes = await prisma.like.findMany({
    where: {
      post: { userId: session.user.id },
      createdAt: { gte: startDate },
    },
    select: { createdAt: true },
  })

  // ------------------------------------------------------------
  // 時間帯別・曜日別・日別の集計
  // ------------------------------------------------------------

  /**
   * 時間帯別集計（0〜23時）
   *
   * Array(24).fill(0) で24要素の配列を0で初期化
   */
  const hourlyData = Array(24).fill(0)

  /**
   * 曜日別集計（0=日曜日 〜 6=土曜日）
   */
  const weekdayData = Array(7).fill(0)

  /**
   * 日別集計
   *
   * Record<string, number> は { [日付]: 数 } の形式
   */
  const dailyData: Record<string, number> = {}

  /**
   * 各いいねを集計
   */
  likes.forEach((like: typeof likes[number]) => {
    const date = new Date(like.createdAt)
    hourlyData[date.getHours()]++        // 時間帯
    weekdayData[date.getDay()]++         // 曜日

    /**
     * 日付を YYYY-MM-DD 形式に変換
     */
    const dateKey = date.toISOString().split('T')[0]
    dailyData[dateKey] = (dailyData[dateKey] || 0) + 1
  })

  // ------------------------------------------------------------
  // 日別データを配列に変換
  // ------------------------------------------------------------

  /**
   * Object.entries でキー・バリューの配列に変換
   */
  const dailyArray = Object.entries(dailyData)
    .map(([date, count]: [string, number]) => ({ date, count }))
    .sort((a: { date: string }, b: { date: string }) => a.date.localeCompare(b.date))

  // ------------------------------------------------------------
  // 結果の整形と返却
  // ------------------------------------------------------------

  return {
    totalLikes: likes.length,
    hourlyData,
    weekdayData,
    dailyData: dailyArray,
    /**
     * ピーク時間帯
     *
     * indexOf で最大値のインデックス（時間）を取得
     */
    peakHour: hourlyData.indexOf(Math.max(...hourlyData)),
    /**
     * ピーク曜日
     */
    peakWeekday: weekdayData.indexOf(Math.max(...weekdayData)),
  }
}

// ============================================================
// 引用投稿分析
// ============================================================

/**
 * 引用投稿分析を取得
 *
 * ## 機能概要
 * 自分の投稿を引用・リポストした投稿を分析します。
 *
 * ## 有料会員限定
 * プレミアム会員のみ利用可能
 *
 * ## 取得内容
 * - 総引用数
 * - 総リポスト数
 * - 引用投稿の詳細リスト
 *
 * ## 引用とリポストの違い
 * - 引用: コメント付きで元投稿を共有
 * - リポスト: コメントなしでそのまま共有
 *
 * @returns 分析結果、または { error: string }
 *
 * @example
 * ```typescript
 * const analytics = await getQuoteAnalytics()
 *
 * console.log(`引用数: ${analytics.totalQuotes}`)
 * console.log(`リポスト数: ${analytics.totalReposts}`)
 * ```
 */
export async function getQuoteAnalytics() {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // ------------------------------------------------------------
  // 有料会員チェック
  // ------------------------------------------------------------

  const isPremium = await isPremiumUser(session.user.id)
  if (!isPremium) {
    return { error: '分析機能は有料会員限定です' }
  }

  // ------------------------------------------------------------
  // 引用投稿の取得
  // ------------------------------------------------------------

  /**
   * 自分の投稿を引用した投稿を取得
   *
   * quotePost: { userId: session.user.id } で
   * 自分の投稿を引用したものに絞り込み
   */
  const quotes = await prisma.post.findMany({
    where: {
      quotePost: { userId: session.user.id },
    },
    include: {
      user: { select: { id: true, nickname: true, avatarUrl: true } },
      quotePost: { select: { id: true, content: true } },
      _count: { select: { likes: true, comments: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,  // 最新50件
  })

  // ------------------------------------------------------------
  // リポスト数の取得
  // ------------------------------------------------------------

  /**
   * 自分の投稿をリポストした数をカウント
   */
  const repostCount = await prisma.post.count({
    where: {
      repostPost: { userId: session.user.id },
    },
  })

  // ------------------------------------------------------------
  // 結果の整形と返却
  // ------------------------------------------------------------

  return {
    totalQuotes: quotes.length,
    totalReposts: repostCount,
    quotes: quotes.map((q: typeof quotes[number]) => ({
      id: q.id,
      content: q.content?.slice(0, 200) ?? null,  // 200文字に切り詰め
      user: q.user,
      originalPostId: q.quotePost?.id ?? null,
      originalContent: q.quotePost?.content?.slice(0, 100) ?? null,
      likeCount: q._count.likes,
      commentCount: q._count.comments,
      createdAt: q.createdAt,
    })),
  }
}

// ============================================================
// キーワード分析
// ============================================================

/**
 * キーワード分析を取得
 *
 * ## 機能概要
 * 自分の投稿に含まれるキーワードを分析します。
 *
 * ## 有料会員限定
 * プレミアム会員のみ利用可能
 *
 * ## 取得内容
 * - 上位キーワード（30件）
 * - 総単語数
 * - ユニーク単語数
 *
 * ## 注意
 * 簡易的なトークン化を使用しているため、
 * 形態素解析（MeCab、kuromoji等）ほど正確ではありません
 *
 * @param days - 分析対象期間（デフォルト: 30日）
 * @returns 分析結果、または { error: string }
 *
 * @example
 * ```typescript
 * const analytics = await getKeywordAnalytics(30)
 *
 * console.log('よく使うキーワード:')
 * analytics.keywords.forEach(k => {
 *   console.log(`${k.word}: ${k.count}回`)
 * })
 * ```
 */
export async function getKeywordAnalytics(days = 30) {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // ------------------------------------------------------------
  // 有料会員チェック
  // ------------------------------------------------------------

  const isPremium = await isPremiumUser(session.user.id)
  if (!isPremium) {
    return { error: '分析機能は有料会員限定です' }
  }

  // ------------------------------------------------------------
  // 期間の計算
  // ------------------------------------------------------------

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  // ------------------------------------------------------------
  // 投稿データの取得
  // ------------------------------------------------------------

  /**
   * 指定期間内の自分の投稿（本文あり）を取得
   */
  const posts = await prisma.post.findMany({
    where: {
      userId: session.user.id,
      createdAt: { gte: startDate },
      content: { not: null },
    },
    select: { content: true },
  })

  // ------------------------------------------------------------
  // 単語の出現回数をカウント
  // ------------------------------------------------------------

  /**
   * 単語カウント用オブジェクト
   */
  const wordCount: Record<string, number> = {}

  /**
   * ストップワード（除外する一般的な単語）
   *
   * 助詞、助動詞、一般的な動詞などを除外
   */
  const stopWords = new Set([
    'の', 'は', 'が', 'を', 'に', 'で', 'と', 'も', 'や', 'か',
    'です', 'ます', 'した', 'して', 'する', 'ある', 'いる',
    'この', 'その', 'あの', 'こと', 'もの', 'ため',
    'から', 'まで', 'より', 'など', 'ない', 'なる',
    'いう', 'れる', 'られ', 'せる', 'させ', 'よう',
    'という', 'これ', 'それ', 'あれ', 'どれ',
  ])

  /**
   * 各投稿を処理
   */
  posts.forEach((post: typeof posts[number]) => {
    if (!post.content) return

    /**
     * 簡易的なトークン化
     *
     * 1. URLを削除
     * 2. 句読点・括弧・空白で分割
     * 3. 2文字以上かつストップワードでない単語を抽出
     *
     * 実際はMeCabやkuromojiを使用することを推奨
     */
    const words = post.content
      .replace(/https?:\/\/[^\s]+/g, '')  // URL削除
      .replace(/[、。！？「」『』【】（）\s\n]/g, ' ')  // 句読点を空白に
      .split(' ')
      .filter((w: string) => w.length >= 2 && !stopWords.has(w))

    /**
     * 各単語をカウント
     */
    words.forEach((word: string) => {
      wordCount[word] = (wordCount[word] || 0) + 1
    })
  })

  // ------------------------------------------------------------
  // 上位キーワードを抽出
  // ------------------------------------------------------------

  /**
   * 出現回数順にソートして上位30件を取得
   */
  const keywords = Object.entries(wordCount)
    .sort((a: [string, number], b: [string, number]) => b[1] - a[1])
    .slice(0, 30)
    .map(([word, count]: [string, number]) => ({ word, count }))

  // ------------------------------------------------------------
  // 結果の整形と返却
  // ------------------------------------------------------------

  return {
    keywords,
    /**
     * 総単語数
     */
    totalWords: Object.values(wordCount).reduce((a: number, b: number) => a + b, 0),
    /**
     * ユニーク単語数
     */
    uniqueWords: Object.keys(wordCount).length,
  }
}

// ============================================================
// エンゲージメント推移
// ============================================================

/**
 * エンゲージメント推移を取得
 *
 * ## 機能概要
 * 日別のエンゲージメント（投稿数、いいね数、コメント数）の推移を取得します。
 *
 * ## 有料会員限定
 * プレミアム会員のみ利用可能
 *
 * ## 取得内容
 * - 日別の投稿数
 * - 日別のいいね数
 * - 日別のコメント数
 * - 日別のエンゲージメント合計
 *
 * ## グラフ表示
 * このデータを使ってエンゲージメントの推移をグラフ表示できる
 *
 * @param days - 分析対象期間（デフォルト: 30日）
 * @returns 分析結果、または { error: string }
 *
 * @example
 * ```typescript
 * const { trend } = await getEngagementTrend(30)
 *
 * // グラフライブラリに渡すデータとして使用
 * <LineChart data={trend} />
 * ```
 */
export async function getEngagementTrend(days = 30) {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // ------------------------------------------------------------
  // 有料会員チェック
  // ------------------------------------------------------------

  const isPremium = await isPremiumUser(session.user.id)
  if (!isPremium) {
    return { error: '分析機能は有料会員限定です' }
  }

  // ------------------------------------------------------------
  // 期間の計算
  // ------------------------------------------------------------

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  // ------------------------------------------------------------
  // 投稿データの取得
  // ------------------------------------------------------------

  /**
   * 日別の投稿数、いいね数、コメント数を取得
   */
  const posts = await prisma.post.findMany({
    where: {
      userId: session.user.id,
      createdAt: { gte: startDate },
    },
    include: {
      _count: { select: { likes: true, comments: true } },
    },
    orderBy: { createdAt: 'asc' },  // 古い順
  })

  // ------------------------------------------------------------
  // 日別データを集計
  // ------------------------------------------------------------

  /**
   * 日別統計の型定義
   */
  const dailyStats: Record<string, { posts: number; likes: number; comments: number }> = {}

  /**
   * 期間内の全日付を初期化
   *
   * これにより、投稿がない日もデータに含まれる
   */
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate)
    date.setDate(date.getDate() + i)
    const dateKey = date.toISOString().split('T')[0]
    dailyStats[dateKey] = { posts: 0, likes: 0, comments: 0 }
  }

  /**
   * 投稿データを集計
   */
  posts.forEach((post: typeof posts[number]) => {
    const dateKey = post.createdAt.toISOString().split('T')[0]
    if (dailyStats[dateKey]) {
      dailyStats[dateKey].posts++
      dailyStats[dateKey].likes += post._count.likes
      dailyStats[dateKey].comments += post._count.comments
    }
  })

  // ------------------------------------------------------------
  // 結果の整形と返却
  // ------------------------------------------------------------

  /**
   * 日付順にソートした配列に変換
   */
  type DailyStatsEntry = { posts: number; likes: number; comments: number }
  const trend = Object.entries(dailyStats)
    .map(([date, stats]: [string, DailyStatsEntry]) => ({
      date,
      ...stats,
      engagement: stats.likes + stats.comments,  // エンゲージメント合計
    }))
    .sort((a: { date: string }, b: { date: string }) => a.date.localeCompare(b.date))

  return { trend }
}

// ============================================================
// 分析ダッシュボード
// ============================================================

/**
 * 分析ダッシュボードの全データを取得
 *
 * ## 機能概要
 * 全ての分析データを一括で取得します。
 * ダッシュボードページでの表示に使用します。
 *
 * ## 有料会員限定
 * プレミアム会員のみ利用可能
 *
 * ## 取得内容
 * - 投稿パフォーマンス分析
 * - いいね分析
 * - 引用投稿分析
 * - キーワード分析
 * - エンゲージメント推移
 *
 * ## パフォーマンス最適化
 * Promise.all で全ての分析を並列実行
 *
 * @param days - 分析対象期間（デフォルト: 30日）
 * @returns 全分析データ、または { error: string }
 *
 * @example
 * ```typescript
 * const dashboard = await getAnalyticsDashboard(30)
 *
 * if (dashboard.postAnalytics) {
 *   console.log(`総投稿数: ${dashboard.postAnalytics.totalPosts}`)
 * }
 * ```
 */
export async function getAnalyticsDashboard(days = 30) {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // ------------------------------------------------------------
  // 有料会員チェック
  // ------------------------------------------------------------

  const isPremium = await isPremiumUser(session.user.id)
  if (!isPremium) {
    return { error: '分析機能は有料会員限定です' }
  }

  // ------------------------------------------------------------
  // 並列で全データを取得
  // ------------------------------------------------------------

  /**
   * Promise.all で複数の分析を同時実行
   *
   * 各分析は独立しているため、並列実行で高速化
   */
  const [
    postAnalytics,
    likeAnalytics,
    quoteAnalytics,
    keywordAnalytics,
    engagementTrend,
  ] = await Promise.all([
    getPostAnalytics(days),
    getLikeAnalytics(days),
    getQuoteAnalytics(),
    getKeywordAnalytics(days),
    getEngagementTrend(days),
  ])

  // ------------------------------------------------------------
  // 結果の整形と返却
  // ------------------------------------------------------------

  /**
   * エラーの場合は null を返す
   *
   * 'error' in result でエラーかどうかを判定
   */
  return {
    postAnalytics: 'error' in postAnalytics ? null : postAnalytics,
    likeAnalytics: 'error' in likeAnalytics ? null : likeAnalytics,
    quoteAnalytics: 'error' in quoteAnalytics ? null : quoteAnalytics,
    keywordAnalytics: 'error' in keywordAnalytics ? null : keywordAnalytics,
    engagementTrend: 'error' in engagementTrend ? null : engagementTrend,
  }
}

// ============================================================
// UserAnalyticsモデル用関数（記録系）
// ============================================================

/**
 * プロフィール閲覧を記録
 *
 * ## 機能概要
 * ユーザーのプロフィールが閲覧されたことを記録します。
 *
 * ## 内部API
 * この関数はシステム内部で使用され、
 * プロフィールページのアクセス時に自動的に呼び出されます。
 *
 * ## upsert
 * - 今日のレコードが存在: profileViews を +1
 * - 今日のレコードが存在しない: 新規作成
 *
 * @param userId - 閲覧されたユーザーのID
 *
 * @example
 * ```typescript
 * // プロフィールページの Server Component で呼び出し
 * await recordProfileView(userId)
 * ```
 */
export async function recordProfileView(userId: string) {
  try {
    /**
     * 今日の0時を取得
     */
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    /**
     * upsert で既存レコードを更新、または新規作成
     *
     * userId_date は複合ユニークキー
     */
    await prisma.userAnalytics.upsert({
      where: { userId_date: { userId, date: today } },
      update: { profileViews: { increment: 1 } },  // +1
      create: { userId, date: today, profileViews: 1 },
    })
  } catch (error) {
    /**
     * エラーが発生してもページ表示は継続
     */
    logger.error('Record profile view error:', error)
  }
}

/**
 * 投稿閲覧を記録
 *
 * ## 機能概要
 * ユーザーの投稿が閲覧されたことを記録します。
 *
 * ## 内部API
 * 投稿詳細ページのアクセス時に自動的に呼び出されます。
 *
 * @param userId - 投稿者のユーザーID
 */
export async function recordPostView(userId: string) {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    await prisma.userAnalytics.upsert({
      where: { userId_date: { userId, date: today } },
      update: { postViews: { increment: 1 } },
      create: { userId, date: today, postViews: 1 },
    })
  } catch (error) {
    logger.error('Record post view error:', error)
  }
}

/**
 * いいね受信を記録
 *
 * ## 機能概要
 * ユーザーがいいねを受け取ったことを記録します。
 *
 * ## 内部API
 * いいね作成時に自動的に呼び出されます。
 *
 * @param userId - いいねを受け取ったユーザーのID
 */
export async function recordLikeReceived(userId: string) {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    await prisma.userAnalytics.upsert({
      where: { userId_date: { userId, date: today } },
      update: { likesReceived: { increment: 1 } },
      create: { userId, date: today, likesReceived: 1 },
    })
  } catch (error) {
    logger.error('Record like received error:', error)
  }
}

/**
 * フォロワー増加を記録
 *
 * ## 機能概要
 * ユーザーがフォローされたことを記録します。
 *
 * ## 内部API
 * フォロー作成時に自動的に呼び出されます。
 *
 * @param userId - フォローされたユーザーのID
 */
export async function recordNewFollower(userId: string) {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    await prisma.userAnalytics.upsert({
      where: { userId_date: { userId, date: today } },
      update: { newFollowers: { increment: 1 } },
      create: { userId, date: today, newFollowers: 1 },
    })
  } catch (error) {
    logger.error('Record new follower error:', error)
  }
}

// ============================================================
// 詳細アナリティクス
// ============================================================

/**
 * 詳細アナリティクスデータ取得
 *
 * ## 機能概要
 * UserAnalytics テーブルに記録されたデータを取得します。
 *
 * ## 有料会員限定
 * プレミアム会員のみ利用可能
 *
 * ## 取得内容
 * - 集計値（プロフィール閲覧、投稿閲覧、いいね、フォロワー）
 * - 日別データ
 * - 期間情報
 *
 * @param days - 取得期間（デフォルト: 30日）
 * @returns 分析結果、または { error: string }
 *
 * @example
 * ```typescript
 * const analytics = await getDetailedAnalytics(30)
 *
 * console.log(`プロフィール閲覧数: ${analytics.totals.profileViews}`)
 * ```
 */
export async function getDetailedAnalytics(days: number = 30) {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // ------------------------------------------------------------
  // 有料会員チェック
  // ------------------------------------------------------------

  const isPremium = await isPremiumUser(session.user.id)
  if (!isPremium) {
    return { error: 'プレミアム会員限定機能です' }
  }

  // ------------------------------------------------------------
  // 期間の計算
  // ------------------------------------------------------------

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  startDate.setHours(0, 0, 0, 0)

  const endDate = new Date()
  endDate.setHours(23, 59, 59, 999)

  try {
    // ------------------------------------------------------------
    // アナリティクスデータの取得
    // ------------------------------------------------------------

    const analyticsData = await prisma.userAnalytics.findMany({
      where: {
        userId: session.user.id,
        date: { gte: startDate, lte: endDate },
      },
      orderBy: { date: 'asc' },
    })

    // ------------------------------------------------------------
    // 集計
    // ------------------------------------------------------------

    /**
     * reduce で全日のデータを合計
     */
    type TotalsType = { profileViews: number; postViews: number; likesReceived: number; newFollowers: number }
    const totals = analyticsData.reduce(
      (acc: TotalsType, data: typeof analyticsData[number]) => ({
        profileViews: acc.profileViews + data.profileViews,
        postViews: acc.postViews + data.postViews,
        likesReceived: acc.likesReceived + data.likesReceived,
        newFollowers: acc.newFollowers + data.newFollowers,
      }),
      { profileViews: 0, postViews: 0, likesReceived: 0, newFollowers: 0 }
    )

    // ------------------------------------------------------------
    // 日別データを配列に変換
    // ------------------------------------------------------------

    const dailyData = analyticsData.map((data: typeof analyticsData[number]) => ({
      date: data.date.toISOString().split('T')[0],
      profileViews: data.profileViews,
      postViews: data.postViews,
      likesReceived: data.likesReceived,
      newFollowers: data.newFollowers,
    }))

    // ------------------------------------------------------------
    // 結果の整形と返却
    // ------------------------------------------------------------

    return {
      totals,
      dailyData,
      period: {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0],
        days,
      },
    }
  } catch (error) {
    logger.error('Get detailed analytics error:', error)
    return { error: '分析データの取得に失敗しました' }
  }
}

// ============================================================
// 簡易統計（無料ユーザー向け）
// ============================================================

/**
 * 簡易統計（無料ユーザー向け）
 *
 * ## 機能概要
 * 基本的な統計情報を取得します。
 * 無料ユーザーでも利用可能です。
 *
 * ## 取得内容
 * - 投稿数
 * - フォロワー数
 * - フォロー中数
 * - 総いいね受信数
 *
 * ## 有料会員との違い
 * - 無料: 基本統計のみ
 * - 有料: 時系列分析、キーワード分析、エンゲージメント推移など
 *
 * @returns 基本統計、または { error: string }
 *
 * @example
 * ```typescript
 * const stats = await getBasicStats()
 *
 * return (
 *   <div>
 *     <p>投稿数: {stats.postsCount}</p>
 *     <p>フォロワー: {stats.followersCount}</p>
 *   </div>
 * )
 * ```
 */
export async function getBasicStats() {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // ------------------------------------------------------------
  // 並列で全データを取得
  // ------------------------------------------------------------

  /**
   * 4つのカウントクエリを並列実行
   */
  const [postsCount, followersCount, followingCount, likesCount] = await Promise.all([
    /**
     * 投稿数（非表示を除く）
     */
    prisma.post.count({ where: { userId: session.user.id, isHidden: false } }),
    /**
     * フォロワー数
     */
    prisma.follow.count({ where: { followingId: session.user.id } }),
    /**
     * フォロー中数
     */
    prisma.follow.count({ where: { followerId: session.user.id } }),
    /**
     * 総いいね受信数
     *
     * 自分の投稿へのいいねをカウント
     */
    prisma.like.count({
      where: {
        post: { userId: session.user.id },
      },
    }),
  ])

  // ------------------------------------------------------------
  // 結果の整形と返却
  // ------------------------------------------------------------

  return {
    postsCount,
    followersCount,
    followingCount,
    totalLikesReceived: likesCount,
  }
}
