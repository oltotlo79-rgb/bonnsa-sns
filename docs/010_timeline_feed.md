# 010: タイムライン・フィード

## 概要
フォロー中ユーザーの投稿を表示するタイムライン機能を実装する。
新着順で表示し、無限スクロールで追加読み込みする。

## 優先度
**高** - Phase 2

## 依存チケット
- 005: 投稿機能
- 008: フォロー機能

---

## Todo

### タイムラインページ
- [ ] `app/(main)/feed/page.tsx` - タイムラインページ
- [ ] `app/(main)/feed/loading.tsx` - ローディング
- [ ] `app/(main)/layout.tsx` - メインレイアウト（3カラム）

### タイムラインコンポーネント
- [ ] `components/feed/Timeline.tsx` - タイムラインコンテナ
- [ ] `components/feed/TimelinePost.tsx` - タイムライン用投稿カード
- [ ] `components/feed/TimelineSkeleton.tsx` - ローディングスケルトン
- [ ] `components/feed/EmptyTimeline.tsx` - 投稿がない場合の表示

### レイアウトコンポーネント
- [ ] `components/layout/Sidebar.tsx` - 左サイドバー（ナビゲーション）
- [ ] `components/layout/RightSidebar.tsx` - 右サイドバー
- [ ] `components/layout/MobileNav.tsx` - モバイルボトムナビ
- [ ] `components/layout/Header.tsx` - ヘッダー

### 無限スクロール
- [ ] React Query の `useInfiniteQuery` 使用
- [ ] Intersection Observer でスクロール検知
- [ ] 追加読み込み中のローディング表示
- [ ] 「これ以上投稿はありません」の表示

### データ取得
- [ ] `lib/actions/feed.ts`
  - [ ] `getTimeline` - タイムライン取得
  - [ ] フォロー中ユーザーの投稿取得
  - [ ] ブロック/ミュートユーザーの除外
  - [ ] ページネーション（カーソルベース）
- [ ] 投稿20件ずつ取得
- [ ] 新着順ソート

### リアルタイム更新
- [ ] WebSocket（Socket.io）でタイムライン更新
- [ ] 新しい投稿の通知バナー
- [ ] 「新しい投稿があります」クリックで最新表示

### 投稿フォーム統合
- [ ] タイムライン上部に投稿フォーム配置
- [ ] 投稿後の即座反映

### パフォーマンス最適化
- [ ] React Query でキャッシュ管理
- [ ] 仮想スクロール検討
- [ ] 画像の遅延読み込み

### UI/UX
- [ ] プルトゥリフレッシュ（モバイル）
- [ ] スクロール位置の保持
- [ ] スムーズなアニメーション
- [ ] レスポンシブデザイン

### 3カラムレイアウト
- [ ] 左: ナビゲーション
  - [ ] ホーム
  - [ ] 検索
  - [ ] 通知
  - [ ] ブックマーク
  - [ ] 盆栽園マップ
  - [ ] イベント
  - [ ] プロフィール
  - [ ] 設定
- [ ] 中央: タイムライン
- [ ] 右: おすすめユーザー、トレンドジャンル

### モバイルレイアウト
- [ ] 1カラム表示
- [ ] ボトムナビゲーション
- [ ] スワイプジェスチャー検討

---

## 完了条件
- [ ] フォロー中ユーザーの投稿が表示される
- [ ] 無限スクロールが正常に動作する
- [ ] ブロック/ミュートユーザーの投稿が表示されない
- [ ] リアルタイム更新が動作する
- [ ] 3カラムレイアウトが正常に表示される
- [ ] モバイルレイアウトが正常に表示される

## 参考コード
```typescript
// lib/actions/feed.ts
'use server'

import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

export async function getTimeline(cursor?: string, limit = 20) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です', posts: [] }
  }

  // フォロー中のユーザーIDを取得
  const following = await prisma.follow.findMany({
    where: { followerId: session.user.id },
    select: { followingId: true },
  })
  const followingIds = following.map((f) => f.followingId)

  // 自分の投稿も含める
  followingIds.push(session.user.id)

  // ブロック/ミュートしているユーザーを取得
  const [blocks, mutes] = await Promise.all([
    prisma.block.findMany({
      where: { blockerId: session.user.id },
      select: { blockedId: true },
    }),
    prisma.mute.findMany({
      where: { muterId: session.user.id },
      select: { mutedId: true },
    }),
  ])
  const excludeIds = [
    ...blocks.map((b) => b.blockedId),
    ...mutes.map((m) => m.mutedId),
  ]

  // タイムライン取得
  const posts = await prisma.post.findMany({
    where: {
      userId: {
        in: followingIds,
        notIn: excludeIds.length > 0 ? excludeIds : undefined,
      },
    },
    include: {
      user: {
        select: { id: true, nickname: true, avatarUrl: true },
      },
      media: {
        orderBy: { sortOrder: 'asc' },
      },
      genres: {
        include: { genre: true },
      },
      _count: {
        select: { likes: true, comments: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1,
    }),
  })

  const formattedPosts = posts.map((post) => ({
    ...post,
    likeCount: post._count.likes,
    commentCount: post._count.comments,
    genres: post.genres.map((pg) => pg.genre),
  }))

  return {
    posts: formattedPosts,
    nextCursor: posts.length === limit ? posts[posts.length - 1]?.id : undefined,
  }
}
```

```typescript
// app/(main)/feed/page.tsx
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getTimeline } from '@/lib/actions/feed'
import { Timeline } from '@/components/feed/Timeline'
import { PostForm } from '@/components/post/PostForm'

export default async function FeedPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/login')
  }

  const { posts } = await getTimeline()

  return (
    <div>
      <PostForm />
      <Timeline initialPosts={posts} />
    </div>
  )
}
```

```typescript
// components/feed/Timeline.tsx
'use client'

import { useInfiniteQuery } from '@tanstack/react-query'
import { useInView } from 'react-intersection-observer'
import { useEffect } from 'react'
import { PostCard } from '@/components/post/PostCard'
import { getTimeline } from '@/lib/actions/feed'

export function Timeline({ initialPosts }) {
  const { ref, inView } = useInView()

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['timeline'],
    queryFn: async ({ pageParam }) => {
      return await getTimeline(pageParam)
    },
    initialData: {
      pages: [{ posts: initialPosts, nextCursor: initialPosts[initialPosts.length - 1]?.id }],
      pageParams: [undefined],
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  })

  useEffect(() => {
    if (inView && hasNextPage) {
      fetchNextPage()
    }
  }, [inView, hasNextPage, fetchNextPage])

  return (
    <div>
      {data.pages.map((page, i) =>
        page.posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))
      )}
      <div ref={ref}>
        {isFetchingNextPage && <p>読み込み中...</p>}
        {!hasNextPage && <p>これ以上投稿はありません</p>}
      </div>
    </div>
  )
}
```
