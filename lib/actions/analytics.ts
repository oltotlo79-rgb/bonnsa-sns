'use server'

import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { isPremiumUser } from '@/lib/premium'

/**
 * 投稿パフォーマンス分析を取得
 */
export async function getPostAnalytics(days = 30) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // 有料会員チェック
  const isPremium = await isPremiumUser(session.user.id)
  if (!isPremium) {
    return { error: '分析機能は有料会員限定です' }
  }

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

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

  const totalLikes = posts.reduce((sum, p) => sum + p._count.likes, 0)
  const totalComments = posts.reduce((sum, p) => sum + p._count.comments, 0)
  const avgEngagement = posts.length > 0
    ? (totalLikes + totalComments) / posts.length
    : 0

  // ベストパフォーマンス投稿
  const topPosts = [...posts]
    .sort((a, b) => (b._count.likes + b._count.comments) - (a._count.likes + a._count.comments))
    .slice(0, 5)

  return {
    totalPosts: posts.length,
    totalLikes,
    totalComments,
    avgEngagement: Math.round(avgEngagement * 10) / 10,
    topPosts: topPosts.map(p => ({
      id: p.id,
      content: p.content?.slice(0, 100) ?? null,
      createdAt: p.createdAt,
      likeCount: p._count.likes,
      commentCount: p._count.comments,
    })),
    posts: posts.map(p => ({
      id: p.id,
      content: p.content?.slice(0, 100) ?? null,
      createdAt: p.createdAt,
      likeCount: p._count.likes,
      commentCount: p._count.comments,
    })),
  }
}

/**
 * いいね分析を取得（時間帯別、曜日別）
 */
export async function getLikeAnalytics(days = 30) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  const isPremium = await isPremiumUser(session.user.id)
  if (!isPremium) {
    return { error: '分析機能は有料会員限定です' }
  }

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  // 自分の投稿へのいいねを取得
  const likes = await prisma.like.findMany({
    where: {
      post: { userId: session.user.id },
      createdAt: { gte: startDate },
    },
    select: { createdAt: true },
  })

  // 時間帯別集計（0-23時）
  const hourlyData = Array(24).fill(0)
  // 曜日別集計（0=日曜日 〜 6=土曜日）
  const weekdayData = Array(7).fill(0)
  // 日別集計
  const dailyData: Record<string, number> = {}

  likes.forEach(like => {
    const date = new Date(like.createdAt)
    hourlyData[date.getHours()]++
    weekdayData[date.getDay()]++

    const dateKey = date.toISOString().split('T')[0]
    dailyData[dateKey] = (dailyData[dateKey] || 0) + 1
  })

  // 日別データを配列に変換
  const dailyArray = Object.entries(dailyData)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return {
    totalLikes: likes.length,
    hourlyData,
    weekdayData,
    dailyData: dailyArray,
    // ピーク時間帯
    peakHour: hourlyData.indexOf(Math.max(...hourlyData)),
    // ピーク曜日
    peakWeekday: weekdayData.indexOf(Math.max(...weekdayData)),
  }
}

/**
 * 引用投稿分析を取得
 */
export async function getQuoteAnalytics() {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  const isPremium = await isPremiumUser(session.user.id)
  if (!isPremium) {
    return { error: '分析機能は有料会員限定です' }
  }

  // 自分の投稿を引用した投稿を取得
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
    take: 50,
  })

  // リポスト数も取得
  const repostCount = await prisma.post.count({
    where: {
      repostPost: { userId: session.user.id },
    },
  })

  return {
    totalQuotes: quotes.length,
    totalReposts: repostCount,
    quotes: quotes.map(q => ({
      id: q.id,
      content: q.content?.slice(0, 200) ?? null,
      user: q.user,
      originalPostId: q.quotePost?.id ?? null,
      originalContent: q.quotePost?.content?.slice(0, 100) ?? null,
      likeCount: q._count.likes,
      commentCount: q._count.comments,
      createdAt: q.createdAt,
    })),
  }
}

/**
 * キーワード分析を取得
 */
export async function getKeywordAnalytics(days = 30) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  const isPremium = await isPremiumUser(session.user.id)
  if (!isPremium) {
    return { error: '分析機能は有料会員限定です' }
  }

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  const posts = await prisma.post.findMany({
    where: {
      userId: session.user.id,
      createdAt: { gte: startDate },
      content: { not: null },
    },
    select: { content: true },
  })

  // 単語の出現回数をカウント（簡易版）
  const wordCount: Record<string, number> = {}
  const stopWords = new Set([
    'の', 'は', 'が', 'を', 'に', 'で', 'と', 'も', 'や', 'か',
    'です', 'ます', 'した', 'して', 'する', 'ある', 'いる',
    'この', 'その', 'あの', 'こと', 'もの', 'ため',
    'から', 'まで', 'より', 'など', 'ない', 'なる',
    'いう', 'れる', 'られ', 'せる', 'させ', 'よう',
    'という', 'これ', 'それ', 'あれ', 'どれ',
  ])

  posts.forEach(post => {
    if (!post.content) return

    // 簡易的なトークン化（実際はMeCabやkuromojiを推奨）
    // 連続するカタカナ、漢字、ひらがなを抽出
    const words = post.content
      .replace(/https?:\/\/[^\s]+/g, '') // URL削除
      .replace(/[、。！？「」『』【】（）\s\n]/g, ' ')
      .split(' ')
      .filter(w => w.length >= 2 && !stopWords.has(w))

    words.forEach(word => {
      wordCount[word] = (wordCount[word] || 0) + 1
    })
  })

  // 上位キーワードを抽出
  const keywords = Object.entries(wordCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([word, count]) => ({ word, count }))

  return {
    keywords,
    totalWords: Object.values(wordCount).reduce((a, b) => a + b, 0),
    uniqueWords: Object.keys(wordCount).length,
  }
}

/**
 * エンゲージメント推移を取得
 */
export async function getEngagementTrend(days = 30) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  const isPremium = await isPremiumUser(session.user.id)
  if (!isPremium) {
    return { error: '分析機能は有料会員限定です' }
  }

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  // 日別の投稿数、いいね数、コメント数を取得
  const posts = await prisma.post.findMany({
    where: {
      userId: session.user.id,
      createdAt: { gte: startDate },
    },
    include: {
      _count: { select: { likes: true, comments: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  // 日別データを集計
  const dailyStats: Record<string, { posts: number; likes: number; comments: number }> = {}

  // 期間内の全日付を初期化
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate)
    date.setDate(date.getDate() + i)
    const dateKey = date.toISOString().split('T')[0]
    dailyStats[dateKey] = { posts: 0, likes: 0, comments: 0 }
  }

  // 投稿データを集計
  posts.forEach(post => {
    const dateKey = post.createdAt.toISOString().split('T')[0]
    if (dailyStats[dateKey]) {
      dailyStats[dateKey].posts++
      dailyStats[dateKey].likes += post._count.likes
      dailyStats[dateKey].comments += post._count.comments
    }
  })

  const trend = Object.entries(dailyStats)
    .map(([date, stats]) => ({
      date,
      ...stats,
      engagement: stats.likes + stats.comments,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return { trend }
}

/**
 * 分析ダッシュボードの全データを取得
 */
export async function getAnalyticsDashboard(days = 30) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  const isPremium = await isPremiumUser(session.user.id)
  if (!isPremium) {
    return { error: '分析機能は有料会員限定です' }
  }

  // 並列で全データを取得
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

  return {
    postAnalytics: 'error' in postAnalytics ? null : postAnalytics,
    likeAnalytics: 'error' in likeAnalytics ? null : likeAnalytics,
    quoteAnalytics: 'error' in quoteAnalytics ? null : quoteAnalytics,
    keywordAnalytics: 'error' in keywordAnalytics ? null : keywordAnalytics,
    engagementTrend: 'error' in engagementTrend ? null : engagementTrend,
  }
}
