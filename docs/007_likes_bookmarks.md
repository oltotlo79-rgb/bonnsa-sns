# 007: いいね・ブックマーク機能

## 概要
投稿・コメントへのいいね機能と、投稿のブックマーク機能を実装する。

## 優先度
**高** - Phase 2

## 依存チケット
- 005: 投稿機能
- 006: コメント機能

---

## Todo

### いいね機能
- [x] `components/post/LikeButton.tsx` - 投稿いいねボタン
  - [x] いいね状態の表示
  - [x] いいね数の表示
  - [x] クリックでトグル
  - [x] Optimistic UI
- [x] `components/comment/CommentLikeButton.tsx` - コメントいいねボタン

### ブックマーク機能
- [x] `components/post/BookmarkButton.tsx` - ブックマークボタン
  - [x] ブックマーク状態の表示
  - [x] クリックでトグル
  - [x] Optimistic UI
- [x] `app/(main)/bookmarks/page.tsx` - ブックマーク一覧ページ

### Server Actions
- [x] `lib/actions/like.ts`
  - [x] `togglePostLike` - 投稿いいねトグル
  - [x] `toggleCommentLike` - コメントいいねトグル
  - [x] `getPostLikeStatus` - いいね状態取得
  - [x] `getLikedPosts` - いいねした投稿一覧
- [x] `lib/actions/bookmark.ts`
  - [x] `toggleBookmark` - ブックマークトグル
  - [x] `getBookmarkStatus` - ブックマーク状態取得
  - [x] `getBookmarkedPosts` - ブックマーク一覧

### 通知連携
- [x] 投稿いいね時に投稿者へ通知
- [x] コメントいいね時にコメント投稿者へ通知

### UI/UX
- [x] いいねアニメーション
- [x] Optimistic UI（即座に反映）
- [x] エラー時のロールバック

### データ取得
- [x] 投稿のいいね数取得
- [x] コメントのいいね数取得
- [x] 自分がいいねしているかの判定
- [x] 自分がブックマークしているかの判定

### いいね一覧
- [x] `app/(main)/users/[id]/likes/page.tsx` - ユーザーのいいね一覧

---

## 完了条件
- [x] 投稿へのいいねが正常に動作する
- [x] コメントへのいいねが正常に動作する
- [x] ブックマークが正常に動作する
- [x] いいね/ブックマーク一覧が表示される
- [x] 通知が正常に作成される

## 参考コード

### lib/actions/like.ts
```typescript
'use server'

import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

// 投稿いいねトグル
export async function togglePostLike(postId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // 現在のいいね状態を確認
  const existingLike = await prisma.like.findFirst({
    where: {
      postId,
      userId: session.user.id,
      commentId: null,
    },
  })

  if (existingLike) {
    // いいね解除
    await prisma.like.delete({
      where: { id: existingLike.id },
    })

    return { success: true, liked: false }
  } else {
    // いいね追加
    await prisma.like.create({
      data: {
        postId,
        userId: session.user.id,
      },
    })

    // 通知作成（投稿者へ）
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { userId: true },
    })

    if (post && post.userId !== session.user.id) {
      await prisma.notification.create({
        data: {
          userId: post.userId,
          actorId: session.user.id,
          type: 'like',
          postId,
        },
      })
    }

    return { success: true, liked: true }
  }
}

// コメントいいねトグル
export async function toggleCommentLike(commentId: string, postId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // 現在のいいね状態を確認
  const existingLike = await prisma.like.findFirst({
    where: {
      commentId,
      userId: session.user.id,
    },
  })

  if (existingLike) {
    // いいね解除
    await prisma.like.delete({
      where: { id: existingLike.id },
    })

    return { success: true, liked: false }
  } else {
    // いいね追加
    await prisma.like.create({
      data: {
        commentId,
        postId,
        userId: session.user.id,
      },
    })

    // 通知作成（コメント投稿者へ）
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { userId: true },
    })

    if (comment && comment.userId !== session.user.id) {
      await prisma.notification.create({
        data: {
          userId: comment.userId,
          actorId: session.user.id,
          type: 'comment_like',
          postId,
          commentId,
        },
      })
    }

    return { success: true, liked: true }
  }
}

// 投稿いいね状態取得
export async function getPostLikeStatus(postId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { liked: false }
  }

  const existingLike = await prisma.like.findFirst({
    where: {
      postId,
      userId: session.user.id,
      commentId: null,
    },
  })

  return { liked: !!existingLike }
}
```

### lib/actions/bookmark.ts
```typescript
'use server'

import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

// ブックマークトグル
export async function toggleBookmark(postId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // 現在のブックマーク状態を確認
  const existingBookmark = await prisma.bookmark.findFirst({
    where: {
      postId,
      userId: session.user.id,
    },
  })

  if (existingBookmark) {
    // ブックマーク解除
    await prisma.bookmark.delete({
      where: { id: existingBookmark.id },
    })

    return { success: true, bookmarked: false }
  } else {
    // ブックマーク追加
    await prisma.bookmark.create({
      data: {
        postId,
        userId: session.user.id,
      },
    })

    return { success: true, bookmarked: true }
  }
}

// ブックマーク状態取得
export async function getBookmarkStatus(postId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { bookmarked: false }
  }

  const existingBookmark = await prisma.bookmark.findFirst({
    where: {
      postId,
      userId: session.user.id,
    },
  })

  return { bookmarked: !!existingBookmark }
}

// ブックマーク一覧取得
export async function getBookmarkedPosts(cursor?: string, limit = 20) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です', posts: [] }
  }

  const bookmarks = await prisma.bookmark.findMany({
    where: { userId: session.user.id },
    include: {
      post: {
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
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1,
    }),
  })

  const posts = bookmarks
    .filter((bookmark) => bookmark.post)
    .map((bookmark) => ({
      ...bookmark.post,
      likeCount: bookmark.post._count.likes,
      commentCount: bookmark.post._count.comments,
      genres: bookmark.post.genres.map((pg) => pg.genre),
    }))

  const hasMore = bookmarks.length === limit

  return {
    posts,
    nextCursor: hasMore ? bookmarks[bookmarks.length - 1]?.id : undefined,
  }
}
```

### components/post/LikeButton.tsx (Client Component)
```typescript
'use client'

import { useState } from 'react'
import { togglePostLike } from '@/lib/actions/like'
import { Heart } from 'lucide-react'

export function LikeButton({
  postId,
  initialLiked,
  initialCount,
}: {
  postId: string
  initialLiked: boolean
  initialCount: number
}) {
  const [liked, setLiked] = useState(initialLiked)
  const [count, setCount] = useState(initialCount)
  const [loading, setLoading] = useState(false)

  async function handleToggle() {
    setLoading(true)

    // Optimistic UI
    setLiked(!liked)
    setCount((prev) => (liked ? prev - 1 : prev + 1))

    try {
      const result = await togglePostLike(postId)
      if (result.error) {
        // ロールバック
        setLiked(liked)
        setCount(initialCount)
      }
    } catch {
      // ロールバック
      setLiked(liked)
      setCount(initialCount)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`flex items-center gap-1 ${liked ? 'text-red-500' : 'text-gray-500'}`}
    >
      <Heart className={liked ? 'fill-current' : ''} size={20} />
      <span>{count}</span>
    </button>
  )
}
```
