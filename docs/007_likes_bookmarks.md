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
```typescript
// components/post/LikeButton.tsx
'use client'

import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'
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
  const supabase = createClient()
  const [liked, setLiked] = useState(initialLiked)
  const [count, setCount] = useState(initialCount)
  const [loading, setLoading] = useState(false)

  async function handleToggle() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    setLoading(true)

    // Optimistic UI
    setLiked(!liked)
    setCount(prev => liked ? prev - 1 : prev + 1)

    try {
      if (liked) {
        await supabase
          .from('likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id)
      } else {
        await supabase
          .from('likes')
          .insert({ post_id: postId, user_id: user.id })
      }
    } catch (error) {
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
