# 018: 有料会員（プレミアム）機能

## 概要
有料会員向けの特典機能を実装する。投稿制限の緩和、予約投稿、投稿分析機能を提供。

## 優先度
**中** - Phase 3

## 依存チケット
- 003: 認証
- 004: ユーザープロフィール
- 005: 投稿
- 007: いいね/ブックマーク

---

## 有料会員特典一覧

| 機能 | 無料会員 | 有料会員 |
|------|----------|----------|
| 投稿文字数 | 500文字 | 2000文字 |
| 画像添付 | 4枚 | 6枚 |
| 動画添付 | 1本 | 3本 |
| 予約投稿 | × | ○ |
| 投稿分析 | × | ○ |

---

## Todo

### データベース設計
- [x] `User` モデルに有料会員フィールド追加
  - [x] `isPremium` - 有料会員フラグ
  - [x] `premiumExpiresAt` - 有料会員期限
  - [x] `stripeCustomerId` - Stripe顧客ID
  - [x] `stripeSubscriptionId` - Stripeサブスクリプション ID
- [x] `ScheduledPost` モデル - 予約投稿
- [x] `Payment` モデル - 支払い履歴
- [x] マイグレーション実行

### 有料会員判定ロジック
- [x] `lib/premium.ts`
  - [x] `isPremiumUser(userId)` - 有料会員判定
  - [x] `getPremiumLimits(userId)` - 会員種別に応じた制限値取得
  - [x] `checkPremiumExpiry()` - 期限切れチェック（バッチ処理用）

### 投稿制限の緩和
- [x] `lib/actions/post.ts` 修正
  - [x] 文字数制限を会員種別で分岐（500 / 2000文字）
  - [x] 画像枚数制限を会員種別で分岐（4 / 6枚）
  - [x] 動画本数制限を会員種別で分岐（2 / 3本）
- [ ] `components/post/PostForm.tsx` 修正
  - [ ] 文字数カウンターの上限を動的に変更
  - [ ] メディア添付数の上限を動的に変更
  - [ ] 有料会員限定機能の表示（非会員にはアップグレード案内）

### 予約投稿機能
- [x] `lib/actions/scheduled-post.ts`
  - [x] `createScheduledPost` - 予約投稿作成
  - [x] `getScheduledPosts` - 予約投稿一覧取得
  - [x] `updateScheduledPost` - 予約投稿編集
  - [x] `deleteScheduledPost` - 予約投稿削除
  - [x] `publishScheduledPosts` - 予約時刻になった投稿を公開（バッチ処理）
- [x] `app/(main)/posts/scheduled/page.tsx` - 予約投稿一覧ページ
- [x] `components/post/ScheduledPostForm.tsx` - 予約投稿フォーム
- [x] `components/post/ScheduledPostList.tsx` - 予約投稿一覧
- [x] `components/post/ScheduledPostCard.tsx` - 予約投稿カード

### 投稿分析機能
- [x] `lib/actions/analytics.ts`
  - [x] `getPostAnalytics` - 投稿パフォーマンス分析
  - [x] `getLikeAnalytics` - いいね分析（時間帯別、曜日別）
  - [x] `getQuoteAnalytics` - 引用投稿分析
  - [x] `getKeywordAnalytics` - キーワード分析（投稿内容からトレンド抽出）
  - [x] `getEngagementTrend` - エンゲージメント推移
- [x] `app/(main)/analytics/page.tsx` - 分析ダッシュボード
- [x] `components/analytics/AnalyticsDashboard.tsx` - 分析ダッシュボード
- [x] `components/analytics/LikeChart.tsx` - いいね推移グラフ
- [ ] `components/analytics/EngagementChart.tsx` - エンゲージメントグラフ（LikeChartに統合）
- [x] `components/analytics/KeywordCloud.tsx` - キーワードクラウド
- [x] `components/analytics/QuoteList.tsx` - 引用投稿一覧
- [x] `components/analytics/TimeHeatmap.tsx` - 時間帯別ヒートマップ

### 有料会員管理（管理者向け）
- [x] `lib/actions/admin/premium.ts`
  - [x] `grantPremium` - 有料会員付与
  - [x] `revokePremium` - 有料会員取り消し
  - [x] `extendPremium` - 有料会員期限延長
  - [x] `getPremiumUsers` - 有料会員一覧
- [ ] `app/admin/premium/page.tsx` - 有料会員管理ページ

### UI/UX
- [x] ヘッダー/サイドバーに有料会員バッジ表示
- [ ] プロフィールページに有料会員ステータス表示
- [x] 設定ページに有料会員情報・アップグレード案内
- [x] 有料会員限定機能へのアクセス時に非会員向けモーダル表示

### Stripe決済
- [x] Stripeセットアップ
  - [x] `npm install stripe @stripe/stripe-js`
  - [ ] Stripeダッシュボードで商品・価格を作成（月額プラン）
  - [ ] 環境変数設定（`STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`）
- [x] `lib/stripe.ts` - Stripeクライアント設定
- [x] `lib/actions/subscription.ts`
  - [x] `createCheckoutSession` - Checkout Session作成（決済ページへリダイレクト）
  - [x] `createCustomerPortalSession` - カスタマーポータル（プラン管理）
  - [x] `cancelSubscription` - サブスクリプションキャンセル
  - [x] `getSubscriptionStatus` - サブスクリプション状態取得
- [x] `app/api/webhooks/stripe/route.ts` - Stripe Webhook処理
  - [x] `checkout.session.completed` - 決済完了 → 有料会員有効化
  - [x] `customer.subscription.updated` - サブスクリプション更新
  - [x] `customer.subscription.deleted` - サブスクリプション解約 → 有料会員無効化
  - [x] `invoice.payment_failed` - 支払い失敗処理
- [x] `app/(main)/settings/subscription/page.tsx` - サブスクリプション管理ページ
- [x] `components/subscription/PricingCard.tsx` - 料金プランカード
- [x] `components/subscription/SubscriptionStatus.tsx` - 契約状態表示
- [x] `components/subscription/UpgradeButton.tsx` - アップグレードボタン（PremiumUpgradeCardに統合）

### バッチ処理
- [x] 予約投稿の定期公開（cron: 毎分実行）
- [x] 有料会員期限切れチェック（cron: 毎日実行）
- [x] Stripe同期チェック（cron: 毎日実行）- Stripeとの状態整合性確認

---

## 完了条件
- [x] 有料会員は2000文字まで投稿できる
- [x] 有料会員は画像6枚、動画3本まで添付できる
- [x] 有料会員は予約投稿を作成・管理できる
- [x] 予約時刻になると自動で投稿が公開される
- [x] 有料会員は投稿分析ダッシュボードにアクセスできる
- [x] いいね・引用・キーワードの分析が表示される
- [x] 無料会員が有料機能にアクセスするとアップグレード案内が表示される
- [x] 管理者が有料会員を管理できる
- [x] Stripeで月額プランを購入できる
- [x] 決済完了後に自動で有料会員になる
- [x] サブスクリプションをキャンセルできる
- [x] 支払い履歴を確認できる

---

## 参考スキーマ

```prisma
// Userモデルに追加
model User {
  // 既存フィールド...

  isPremium            Boolean   @default(false) @map("is_premium")
  premiumExpiresAt     DateTime? @map("premium_expires_at")
  stripeCustomerId     String?   @unique @map("stripe_customer_id")
  stripeSubscriptionId String?   @unique @map("stripe_subscription_id")

  scheduledPosts   ScheduledPost[]
  payments         Payment[]
}

// 支払い履歴
model Payment {
  id                String   @id @default(cuid())
  userId            String   @map("user_id")
  stripePaymentId   String   @unique @map("stripe_payment_id")
  amount            Int      // 金額（円）
  currency          String   @default("jpy")
  status            String   // succeeded, pending, failed
  description       String?
  createdAt         DateTime @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("payments")
}

// 予約投稿
model ScheduledPost {
  id          String   @id @default(cuid())
  userId      String   @map("user_id")
  content     String?  @db.Text
  scheduledAt DateTime @map("scheduled_at")
  status      ScheduledPostStatus @default(pending)
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  // 公開後の投稿ID（公開済みの場合）
  publishedPostId String? @unique @map("published_post_id")

  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  publishedPost Post?  @relation(fields: [publishedPostId], references: [id])
  media       ScheduledPostMedia[]
  genres      ScheduledPostGenre[]

  @@index([userId])
  @@index([scheduledAt])
  @@index([status])
  @@map("scheduled_posts")
}

enum ScheduledPostStatus {
  pending    // 予約中
  published  // 公開済み
  failed     // 公開失敗
  cancelled  // キャンセル
}

// 予約投稿メディア
model ScheduledPostMedia {
  id              String @id @default(cuid())
  scheduledPostId String @map("scheduled_post_id")
  url             String
  type            String @default("image")
  sortOrder       Int    @default(0) @map("sort_order")

  scheduledPost   ScheduledPost @relation(fields: [scheduledPostId], references: [id], onDelete: Cascade)

  @@index([scheduledPostId])
  @@map("scheduled_post_media")
}

// 予約投稿ジャンル
model ScheduledPostGenre {
  scheduledPostId String @map("scheduled_post_id")
  genreId         String @map("genre_id")

  scheduledPost   ScheduledPost @relation(fields: [scheduledPostId], references: [id], onDelete: Cascade)
  genre           Genre         @relation(fields: [genreId], references: [id], onDelete: Cascade)

  @@id([scheduledPostId, genreId])
  @@map("scheduled_post_genres")
}
```

---

## 参考コード

### 有料会員判定
```typescript
// lib/premium.ts
import { prisma } from '@/lib/db'

export type MembershipType = 'free' | 'premium'

export interface MembershipLimits {
  maxPostLength: number
  maxImages: number
  maxVideos: number
  canSchedulePost: boolean
  canViewAnalytics: boolean
}

const FREE_LIMITS: MembershipLimits = {
  maxPostLength: 500,
  maxImages: 4,
  maxVideos: 1,
  canSchedulePost: false,
  canViewAnalytics: false,
}

const PREMIUM_LIMITS: MembershipLimits = {
  maxPostLength: 2000,
  maxImages: 6,
  maxVideos: 3,
  canSchedulePost: true,
  canViewAnalytics: true,
}

export async function isPremiumUser(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isPremium: true, premiumExpiresAt: true },
  })

  if (!user || !user.isPremium) return false

  // 期限切れチェック
  if (user.premiumExpiresAt && user.premiumExpiresAt < new Date()) {
    // 期限切れの場合はフラグを更新
    await prisma.user.update({
      where: { id: userId },
      data: { isPremium: false },
    })
    return false
  }

  return true
}

export async function getMembershipLimits(userId: string): Promise<MembershipLimits> {
  const isPremium = await isPremiumUser(userId)
  return isPremium ? PREMIUM_LIMITS : FREE_LIMITS
}

export async function getMembershipType(userId: string): Promise<MembershipType> {
  const isPremium = await isPremiumUser(userId)
  return isPremium ? 'premium' : 'free'
}
```

### 投稿制限の適用
```typescript
// lib/actions/post.ts（修正例）
import { getMembershipLimits } from '@/lib/premium'

export async function createPost(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  const content = formData.get('content') as string
  const mediaUrls = formData.getAll('mediaUrls') as string[]
  const mediaTypes = formData.getAll('mediaTypes') as string[]

  // 会員種別に応じた制限を取得
  const limits = await getMembershipLimits(session.user.id)

  // 文字数チェック
  if (content && content.length > limits.maxPostLength) {
    return { error: `投稿は${limits.maxPostLength}文字以内で入力してください` }
  }

  // 画像枚数チェック
  const imageCount = mediaTypes.filter(t => t === 'image').length
  if (imageCount > limits.maxImages) {
    return { error: `画像は${limits.maxImages}枚までです` }
  }

  // 動画本数チェック
  const videoCount = mediaTypes.filter(t => t === 'video').length
  if (videoCount > limits.maxVideos) {
    return { error: `動画は${limits.maxVideos}本までです` }
  }

  // 以降の処理...
}
```

### 予約投稿作成
```typescript
// lib/actions/scheduled-post.ts
'use server'

import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { isPremiumUser, getMembershipLimits } from '@/lib/premium'
import { revalidatePath } from 'next/cache'

export async function createScheduledPost(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // 有料会員チェック
  const isPremium = await isPremiumUser(session.user.id)
  if (!isPremium) {
    return { error: '予約投稿は有料会員限定の機能です' }
  }

  const content = formData.get('content') as string
  const scheduledAtStr = formData.get('scheduledAt') as string
  const genreIds = formData.getAll('genreIds') as string[]
  const mediaUrls = formData.getAll('mediaUrls') as string[]
  const mediaTypes = formData.getAll('mediaTypes') as string[]

  const scheduledAt = new Date(scheduledAtStr)

  // 過去の日時はエラー
  if (scheduledAt <= new Date()) {
    return { error: '予約日時は未来の日時を指定してください' }
  }

  // 制限チェック
  const limits = await getMembershipLimits(session.user.id)

  if (content && content.length > limits.maxPostLength) {
    return { error: `投稿は${limits.maxPostLength}文字以内で入力してください` }
  }

  const imageCount = mediaTypes.filter(t => t === 'image').length
  if (imageCount > limits.maxImages) {
    return { error: `画像は${limits.maxImages}枚までです` }
  }

  const videoCount = mediaTypes.filter(t => t === 'video').length
  if (videoCount > limits.maxVideos) {
    return { error: `動画は${limits.maxVideos}本までです` }
  }

  // 予約投稿作成
  const scheduledPost = await prisma.scheduledPost.create({
    data: {
      userId: session.user.id,
      content: content || null,
      scheduledAt,
      media: mediaUrls.length > 0 ? {
        create: mediaUrls.map((url, index) => ({
          url,
          type: mediaTypes[index] || 'image',
          sortOrder: index,
        })),
      } : undefined,
      genres: genreIds.length > 0 ? {
        create: genreIds.map((genreId) => ({
          genreId,
        })),
      } : undefined,
    },
  })

  revalidatePath('/posts/scheduled')
  return { success: true, scheduledPostId: scheduledPost.id }
}

// 予約投稿の公開（バッチ処理用）
export async function publishScheduledPosts() {
  const now = new Date()

  // 公開時刻を過ぎた予約投稿を取得
  const scheduledPosts = await prisma.scheduledPost.findMany({
    where: {
      status: 'pending',
      scheduledAt: { lte: now },
    },
    include: {
      media: { orderBy: { sortOrder: 'asc' } },
      genres: true,
    },
  })

  for (const scheduled of scheduledPosts) {
    try {
      // 投稿を作成
      const post = await prisma.post.create({
        data: {
          userId: scheduled.userId,
          content: scheduled.content,
          media: scheduled.media.length > 0 ? {
            create: scheduled.media.map((m) => ({
              url: m.url,
              type: m.type,
              sortOrder: m.sortOrder,
            })),
          } : undefined,
          genres: scheduled.genres.length > 0 ? {
            create: scheduled.genres.map((g) => ({
              genreId: g.genreId,
            })),
          } : undefined,
        },
      })

      // 予約投稿のステータスを更新
      await prisma.scheduledPost.update({
        where: { id: scheduled.id },
        data: {
          status: 'published',
          publishedPostId: post.id,
        },
      })
    } catch (error) {
      // エラー時はステータスを失敗に
      await prisma.scheduledPost.update({
        where: { id: scheduled.id },
        data: { status: 'failed' },
      })
    }
  }

  return { published: scheduledPosts.length }
}
```

### 分析データ取得
```typescript
// lib/actions/analytics.ts
'use server'

import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { isPremiumUser } from '@/lib/premium'

export async function getPostAnalytics() {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // 有料会員チェック
  const isPremium = await isPremiumUser(session.user.id)
  if (!isPremium) {
    return { error: '分析機能は有料会員限定です' }
  }

  // 過去30日の投稿パフォーマンス
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const posts = await prisma.post.findMany({
    where: {
      userId: session.user.id,
      createdAt: { gte: thirtyDaysAgo },
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

  return {
    totalPosts: posts.length,
    totalLikes,
    totalComments,
    avgEngagement,
    posts: posts.map(p => ({
      id: p.id,
      content: p.content?.slice(0, 100),
      createdAt: p.createdAt,
      likeCount: p._count.likes,
      commentCount: p._count.comments,
    })),
  }
}

export async function getLikeAnalytics() {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  const isPremium = await isPremiumUser(session.user.id)
  if (!isPremium) {
    return { error: '分析機能は有料会員限定です' }
  }

  // 過去30日のいいねを時間帯別に集計
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const likes = await prisma.like.findMany({
    where: {
      post: { userId: session.user.id },
      createdAt: { gte: thirtyDaysAgo },
    },
    select: { createdAt: true },
  })

  // 時間帯別集計
  const hourlyData = Array(24).fill(0)
  // 曜日別集計
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

  return {
    totalLikes: likes.length,
    hourlyData,
    weekdayData,
    dailyData,
  }
}

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

  return {
    totalQuotes: quotes.length,
    quotes: quotes.map(q => ({
      id: q.id,
      content: q.content,
      user: q.user,
      originalPostId: q.quotePost?.id,
      originalContent: q.quotePost?.content?.slice(0, 100),
      likeCount: q._count.likes,
      commentCount: q._count.comments,
      createdAt: q.createdAt,
    })),
  }
}

export async function getKeywordAnalytics() {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  const isPremium = await isPremiumUser(session.user.id)
  if (!isPremium) {
    return { error: '分析機能は有料会員限定です' }
  }

  // 過去30日の投稿からキーワードを抽出
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const posts = await prisma.post.findMany({
    where: {
      userId: session.user.id,
      createdAt: { gte: thirtyDaysAgo },
      content: { not: null },
    },
    select: { content: true },
  })

  // 単語の出現回数をカウント（簡易版）
  const wordCount: Record<string, number> = {}
  const stopWords = ['の', 'は', 'が', 'を', 'に', 'で', 'と', 'も', 'や', 'か', 'です', 'ます', 'した', 'して', 'する', 'ある', 'いる', 'この', 'その', 'あの']

  posts.forEach(post => {
    if (!post.content) return

    // 簡易的な形態素解析（実際はMeCabやkuromoji等を使用推奨）
    const words = post.content
      .replace(/[。、！？\s]/g, ' ')
      .split(' ')
      .filter(w => w.length >= 2 && !stopWords.includes(w))

    words.forEach(word => {
      wordCount[word] = (wordCount[word] || 0) + 1
    })
  })

  // 上位キーワードを抽出
  const keywords = Object.entries(wordCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([word, count]) => ({ word, count }))

  return { keywords }
}
```

---

## UI設計

### 予約投稿一覧 (`/posts/scheduled`)
```
┌─────────────────────────────────┐
│ 予約投稿              [新規作成] │
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │ 2024/01/20 10:00 に公開予定  │ │
│ │ 今日は松の手入れをしました... │ │
│ │ [画像x2]                     │ │
│ │ [編集] [削除]                │ │
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ 2024/01/21 09:00 に公開予定  │ │
│ │ 新しい盆栽を購入しました...   │ │
│ │ [編集] [削除]                │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

### 分析ダッシュボード (`/analytics`)
```
┌─────────────────────────────────────────────┐
│ 投稿分析                         過去30日 ▼ │
├─────────────────────────────────────────────┤
│                                             │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│ │ 投稿数   │ │ いいね   │ │ コメント │     │
│ │   25     │ │   142    │ │    38    │     │
│ └──────────┘ └──────────┘ └──────────┘     │
│                                             │
│ いいね推移                                   │
│ ┌─────────────────────────────────────────┐ │
│ │ ▂ ▄ ▆ █ ▅ ▃ ▂ ▄ ▇ █ ▆ ▄ ▃ ▂ ▄ ▅ ▇ █ ▅ │ │
│ │ 1/1                              1/30   │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ 時間帯別エンゲージメント                      │
│ ┌─────────────────────────────────────────┐ │
│ │  0  3  6  9  12  15  18  21             │ │
│ │ 月 ░ ░ ░ ▒ ▓  █  ▓  ▒                   │ │
│ │ 火 ░ ░ ░ ▒ █  ▓  ▓  ▒                   │ │
│ │ ...                                     │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ よく使うキーワード                           │
│ ┌─────────────────────────────────────────┐ │
│ │ 「盆栽」「松」「黒松」「真柏」「植え替え」 │ │
│ │ 「水やり」「剪定」「整姿」...              │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ 引用された投稿                               │
│ ┌─────────────────────────────────────────┐ │
│ │ @user1 さんが引用                 1日前  │ │
│ │ 「すごい技術ですね！」                    │ │
│ │ └→ 元投稿: 今日の黒松の手入れ...          │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

### 有料会員バッジ
```
┌─────────────────────┐
│ [Avatar] ユーザー名 ★│  ← ★が有料会員バッジ
│ @username           │
└─────────────────────┘
```

### サブスクリプション管理 (`/settings/subscription`)
```
┌─────────────────────────────────────────────┐
│ プラン管理                                   │
├─────────────────────────────────────────────┤
│                                             │
│ 現在のプラン                                 │
│ ┌─────────────────────────────────────────┐ │
│ │ ★ プレミアム会員                         │ │
│ │   次回更新日: 2024年2月15日              │ │
│ │   [プラン管理] [解約する]                 │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ ─── または（無料会員の場合） ───            │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │        プレミアム会員                     │ │
│ │          ¥500/月                        │ │
│ │                                         │ │
│ │ ✓ 投稿文字数 2000文字                    │ │
│ │ ✓ 画像添付 6枚まで                       │ │
│ │ ✓ 動画添付 3本まで                       │ │
│ │ ✓ 予約投稿機能                           │ │
│ │ ✓ 投稿分析ダッシュボード                  │ │
│ │                                         │ │
│ │      [プレミアムに登録する]               │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ 支払い履歴                                   │
│ ┌─────────────────────────────────────────┐ │
│ │ 2024/01/15  プレミアム会員更新  ¥500    │ │
│ │ 2023/12/15  プレミアム会員登録  ¥500    │ │
│ └─────────────────────────────────────────┘ │
│                                             │
└─────────────────────────────────────────────┘
```

---

## 自動有料会員化フロー

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Stripe決済 → 自動有料会員化                        │
└─────────────────────────────────────────────────────────────────────────┘

【登録フロー】
┌──────────┐    ┌─────────────┐    ┌──────────────┐    ┌────────────────┐
│ ユーザー  │───▶│ 料金プラン   │───▶│ Stripe       │───▶│ 決済完了       │
│ 登録ボタン │    │ 選択画面    │    │ Checkout    │    │ success_url   │
└──────────┘    └─────────────┘    └──────────────┘    └────────────────┘
                                          │
                                          ▼ Webhook
                               ┌──────────────────────┐
                               │ checkout.session     │
                               │ .completed           │
                               └──────────────────────┘
                                          │
                                          ▼
                               ┌──────────────────────┐
                               │ DBを自動更新         │
                               │ • isPremium: true   │
                               │ • premiumExpiresAt  │
                               │ • subscriptionId    │
                               └──────────────────────┘
                                          │
                                          ▼
                               ┌──────────────────────┐
                               │ 即座に有料会員機能   │
                               │ が利用可能に！       │
                               └──────────────────────┘

【機能利用時の判定フロー】
┌──────────────┐    ┌─────────────────┐    ┌─────────────────────┐
│ 投稿作成     │───▶│ getMembership   │───▶│ 有料会員？           │
│ 予約投稿     │    │ Limits()        │    │ • Yes → 2000文字/6枚 │
│ 分析閲覧     │    │                 │    │ • No  → 500文字/4枚  │
└──────────────┘    └─────────────────┘    └─────────────────────┘

【継続課金・解約フロー】
┌─────────────────┐         ┌─────────────────┐
│ 月次自動課金    │────────▶│ invoice.payment │──▶ 期限自動延長
│ (Stripe側で実行) │         │ _succeeded      │
└─────────────────┘         └─────────────────┘

┌─────────────────┐         ┌─────────────────┐
│ 解約            │────────▶│ subscription    │──▶ isPremium: false
│ (カスタマーポータル)│        │ .deleted        │    に自動更新
└─────────────────┘         └─────────────────┘
```

### ポイント
- **Webhookで自動処理**: ユーザー操作不要、決済完了と同時に有料会員化
- **リアルタイム反映**: 決済完了後、即座に有料会員機能が使用可能
- **継続課金も自動**: 毎月の課金・期限延長もWebhookで自動処理
- **解約も自動反映**: カスタマーポータルで解約 → 自動で無料会員に戻る

---

## Stripe決済実装

### 料金プラン
- **月額プラン**: ¥350/月（税込）
- **年額プラン**: ¥3,500/年（税込）- 2ヶ月分お得

### 環境変数
```bash
# Stripe
STRIPE_SECRET_KEY=sk_live_xxx           # 本番用シークレットキー
STRIPE_PUBLISHABLE_KEY=pk_live_xxx      # 本番用公開キー
STRIPE_WEBHOOK_SECRET=whsec_xxx         # Webhookシークレット
STRIPE_PRICE_ID_MONTHLY=price_xxx       # 月額プランの価格ID
STRIPE_PRICE_ID_YEARLY=price_xxx        # 年額プランの価格ID
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx  # クライアント用

# 開発環境では sk_test_xxx, pk_test_xxx を使用
```

### 参考コード（Stripe）

```typescript
// lib/stripe.ts
import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
})
```

```typescript
// lib/actions/subscription.ts
'use server'

import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { stripe } from '@/lib/stripe'

// Checkout Session作成（決済ページへリダイレクト）
export async function createCheckoutSession(priceId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, stripeCustomerId: true, isPremium: true },
  })

  if (!user) {
    return { error: 'ユーザーが見つかりません' }
  }

  if (user.isPremium) {
    return { error: 'すでに有料会員です' }
  }

  // 既存のStripe顧客があれば使用、なければ作成
  let customerId = user.stripeCustomerId

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email!,
      metadata: { userId: session.user.id },
    })
    customerId = customer.id

    await prisma.user.update({
      where: { id: session.user.id },
      data: { stripeCustomerId: customerId },
    })
  }

  // Checkout Session作成
  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/subscription?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/subscription?canceled=true`,
    metadata: {
      userId: session.user.id,
    },
  })

  return { url: checkoutSession.url }
}

// カスタマーポータル（プラン管理・解約）
export async function createCustomerPortalSession() {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { stripeCustomerId: true },
  })

  if (!user?.stripeCustomerId) {
    return { error: 'サブスクリプション情報が見つかりません' }
  }

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/subscription`,
  })

  return { url: portalSession.url }
}

// サブスクリプション状態取得
export async function getSubscriptionStatus() {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      isPremium: true,
      premiumExpiresAt: true,
      stripeSubscriptionId: true,
    },
  })

  if (!user) {
    return { error: 'ユーザーが見つかりません' }
  }

  let subscription = null
  if (user.stripeSubscriptionId) {
    try {
      subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId)
    } catch {
      // サブスクリプションが見つからない場合は無視
    }
  }

  return {
    isPremium: user.isPremium,
    premiumExpiresAt: user.premiumExpiresAt,
    subscription: subscription ? {
      status: subscription.status,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    } : null,
  }
}
```

```typescript
// app/api/webhooks/stripe/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/db'
import Stripe from 'stripe'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')!

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  switch (event.type) {
    // 決済完了 → 有料会員有効化
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const userId = session.metadata?.userId
      const subscriptionId = session.subscription as string

      if (userId && subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId)

        await prisma.user.update({
          where: { id: userId },
          data: {
            isPremium: true,
            stripeSubscriptionId: subscriptionId,
            premiumExpiresAt: new Date(subscription.current_period_end * 1000),
          },
        })

        // 支払い履歴を記録
        if (session.payment_intent) {
          const paymentIntent = await stripe.paymentIntents.retrieve(
            session.payment_intent as string
          )
          await prisma.payment.create({
            data: {
              userId,
              stripePaymentId: paymentIntent.id,
              amount: paymentIntent.amount,
              currency: paymentIntent.currency,
              status: paymentIntent.status,
              description: 'プレミアム会員登録',
            },
          })
        }
      }
      break
    }

    // サブスクリプション更新（更新・期限延長）
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      const user = await prisma.user.findFirst({
        where: { stripeSubscriptionId: subscription.id },
      })

      if (user) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            isPremium: subscription.status === 'active',
            premiumExpiresAt: new Date(subscription.current_period_end * 1000),
          },
        })
      }
      break
    }

    // サブスクリプション解約
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      const user = await prisma.user.findFirst({
        where: { stripeSubscriptionId: subscription.id },
      })

      if (user) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            isPremium: false,
            stripeSubscriptionId: null,
            premiumExpiresAt: null,
          },
        })
      }
      break
    }

    // 支払い失敗
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      const subscriptionId = invoice.subscription as string

      if (subscriptionId) {
        const user = await prisma.user.findFirst({
          where: { stripeSubscriptionId: subscriptionId },
        })

        if (user) {
          // 支払い失敗の通知を作成（任意）
          await prisma.notification.create({
            data: {
              userId: user.id,
              actorId: user.id,
              type: 'system',
              // メッセージは通知表示時に判定
            },
          })
        }
      }
      break
    }

    // 請求書支払い成功（継続課金）
    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice
      const subscriptionId = invoice.subscription as string

      if (subscriptionId && invoice.billing_reason === 'subscription_cycle') {
        const user = await prisma.user.findFirst({
          where: { stripeSubscriptionId: subscriptionId },
        })

        if (user && invoice.payment_intent) {
          await prisma.payment.create({
            data: {
              userId: user.id,
              stripePaymentId: invoice.payment_intent as string,
              amount: invoice.amount_paid,
              currency: invoice.currency,
              status: 'succeeded',
              description: 'プレミアム会員更新',
            },
          })
        }
      }
      break
    }
  }

  return NextResponse.json({ received: true })
}
```

```tsx
// components/subscription/PricingCard.tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createCheckoutSession } from '@/lib/actions/subscription'
import { Check } from 'lucide-react'

interface PricingCardProps {
  isPremium: boolean
}

export function PricingCard({ isPremium }: PricingCardProps) {
  const [loading, setLoading] = useState(false)

  const handleSubscribe = async (priceId: string) => {
    setLoading(true)
    const result = await createCheckoutSession(priceId)
    if (result.url) {
      window.location.href = result.url
    }
    setLoading(false)
  }

  const features = [
    '投稿文字数 2000文字',
    '画像添付 6枚まで',
    '動画添付 3本まで',
    '予約投稿機能',
    '投稿分析ダッシュボード',
  ]

  return (
    <Card className="border-primary">
      <CardHeader>
        <CardTitle className="text-center">
          <span className="text-2xl font-bold">プレミアム会員</span>
        </CardTitle>
        <div className="text-center">
          <span className="text-4xl font-bold">¥500</span>
          <span className="text-muted-foreground">/月</span>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3 mb-6">
          {features.map((feature) => (
            <li key={feature} className="flex items-center gap-2">
              <Check className="h-5 w-5 text-primary" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>

        {isPremium ? (
          <Button className="w-full" disabled>
            現在ご利用中
          </Button>
        ) : (
          <Button
            className="w-full"
            onClick={() => handleSubscribe(process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_MONTHLY!)}
            disabled={loading}
          >
            {loading ? '処理中...' : 'プレミアムに登録'}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
```

---

## 注意事項

- 有料会員の期限切れは日次バッチで自動的に処理
- 予約投稿の公開は毎分のバッチ処理で実行
- 分析データは過去30日分を対象（パフォーマンス考慮）
- キーワード分析は簡易版として実装、必要に応じて形態素解析ライブラリ導入

### Stripe関連
- 開発環境ではStripeテストモードを使用（`sk_test_xxx`, `pk_test_xxx`）
- Webhook URLは `https://yourdomain.com/api/webhooks/stripe` に設定
- ローカル開発時は `stripe listen --forward-to localhost:3000/api/webhooks/stripe` を使用
- Stripeダッシュボードで商品・価格を事前に作成しておく必要あり
- カスタマーポータルは Stripe ダッシュボードで有効化が必要
- 日本円（JPY）は小数点以下がないため、amount は円単位でそのまま使用
