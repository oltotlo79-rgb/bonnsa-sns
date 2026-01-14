# 011: 検索機能

## 概要
投稿・ユーザー・ハッシュタグ・地域での検索機能を実装する。
ジャンル別フィルタリングも含む。

## 優先度
**中** - Phase 3

## 依存チケット
- 005: 投稿機能
- 004: ユーザープロフィール

---

## Todo

### 検索ページ
- [*] `app/(main)/search/page.tsx` - 検索トップページ
- [*] `app/(main)/search/loading.tsx` - ローディングページ

### 検索コンポーネント
- [*] `components/search/SearchBar.tsx` - 検索バー
  - [*] テキスト入力
  - [*] 検索ボタン
  - [*] クリアボタン
- [*] `components/search/SearchTabs.tsx` - 検索タブ（投稿/ユーザー/タグ）
- [*] `components/search/SearchResults.tsx` - 検索結果コンテナ
- [*] `components/search/GenreFilter.tsx` - ジャンルフィルター
- [ ] `components/search/RecentSearches.tsx` - 最近の検索

### 検索種類

#### 全文検索
- [*] 投稿本文の検索
- [ ] PostgreSQL全文検索設定
- [ ] 日本語対応（pg_bigm等）

#### ユーザー検索
- [*] ニックネームで検索
- [*] 部分一致検索

#### ハッシュタグ検索
- [*] #タグで検索
- [*] タグ一覧表示
- [*] タグごとの投稿数表示

#### 地域検索
- [ ] 地域名で投稿検索
- [ ] ユーザーの居住地域で検索

### Server Actions
- [*] `lib/actions/search.ts`
  - [*] `searchPosts` - 投稿検索
  - [*] `searchUsers` - ユーザー検索
  - [*] `searchByTag` - ハッシュタグ検索
  - [ ] `searchByRegion` - 地域検索
  - [*] `getPopularTags` - 人気タグ取得

### フィルタリング
- [*] ジャンル別絞り込み
- [*] 複数ジャンル選択対応
- [*] フィルター状態のURL反映

### 検索履歴
- [ ] 最近の検索キーワード保存（ローカルストレージ）
- [ ] 検索履歴の削除

### おすすめ表示
- [*] 人気のハッシュタグ
- [*] おすすめユーザー

### UI/UX
- [*] 検索中のローディング表示
- [*] 検索結果0件の表示
- [ ] インクリメンタルサーチ（デバウンス）
- [ ] キーボードショートカット（/で検索フォーカス）

### パフォーマンス
- [*] 検索結果のキャッシュ（React Query）
- [*] ページネーション（無限スクロール）
- [ ] 検索インデックス最適化

---

## 完了条件
- [*] 投稿の全文検索が正常に動作する
- [*] ユーザー検索が正常に動作する
- [*] ハッシュタグ検索が正常に動作する
- [ ] 地域検索が正常に動作する
- [*] ジャンルフィルタリングが正常に動作する

## 参考コード
```typescript
// lib/actions/search.ts
'use server'

import { prisma } from '@/lib/db'

export async function searchPosts(query: string, genreIds?: string[], cursor?: string, limit = 20) {
  // 投稿を検索（部分一致）
  const posts = await prisma.post.findMany({
    where: {
      AND: [
        {
          content: {
            contains: query,
            mode: 'insensitive',
          },
        },
        genreIds && genreIds.length > 0
          ? {
              genres: {
                some: {
                  genreId: { in: genreIds },
                },
              },
            }
          : {},
      ],
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

export async function searchUsers(query: string, cursor?: string, limit = 20) {
  const users = await prisma.user.findMany({
    where: {
      nickname: {
        contains: query,
        mode: 'insensitive',
      },
    },
    select: {
      id: true,
      nickname: true,
      avatarUrl: true,
      bio: true,
      _count: {
        select: { followers: true, following: true },
      },
    },
    take: limit,
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1,
    }),
  })

  return {
    users: users.map((user) => ({
      ...user,
      followersCount: user._count.followers,
      followingCount: user._count.following,
    })),
    nextCursor: users.length === limit ? users[users.length - 1]?.id : undefined,
  }
}

export async function searchByTag(tag: string, cursor?: string, limit = 20) {
  // ハッシュタグを含む投稿を検索
  const posts = await prisma.post.findMany({
    where: {
      content: {
        contains: `#${tag}`,
      },
    },
    include: {
      user: {
        select: { id: true, nickname: true, avatarUrl: true },
      },
      media: {
        orderBy: { sortOrder: 'asc' },
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

  return {
    posts: posts.map((post) => ({
      ...post,
      likeCount: post._count.likes,
      commentCount: post._count.comments,
    })),
    nextCursor: posts.length === limit ? posts[posts.length - 1]?.id : undefined,
  }
}
```

```sql
-- PostgreSQL 全文検索設定
-- 日本語対応のための設定（pg_bigm拡張が必要）
CREATE EXTENSION IF NOT EXISTS pg_bigm;

-- 投稿テキストにインデックス作成
CREATE INDEX posts_content_idx ON posts USING gin (content gin_bigm_ops);
```
