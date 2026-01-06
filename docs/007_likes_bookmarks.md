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
- [ ] `components/post/LikeButton.tsx` - 投稿いいねボタン
  - [ ] いいね状態の表示
  - [ ] いいね数の表示
  - [ ] クリックでトグル
  - [ ] Optimistic UI
- [ ] `components/comment/CommentLikeButton.tsx` - コメントいいねボタン

### ブックマーク機能
- [ ] `components/post/BookmarkButton.tsx` - ブックマークボタン
  - [ ] ブックマーク状態の表示
  - [ ] クリックでトグル
  - [ ] Optimistic UI
- [ ] `app/(main)/bookmarks/page.tsx` - ブックマーク一覧ページ

### Server Actions
- [ ] `lib/actions/like.ts`
  - [ ] `togglePostLike` - 投稿いいねトグル
  - [ ] `toggleCommentLike` - コメントいいねトグル
  - [ ] `getPostLikeStatus` - いいね状態取得
  - [ ] `getLikedPosts` - いいねした投稿一覧
- [ ] `lib/actions/bookmark.ts`
  - [ ] `toggleBookmark` - ブックマークトグル
  - [ ] `getBookmarkStatus` - ブックマーク状態取得
  - [ ] `getBookmarkedPosts` - ブックマーク一覧

### 通知連携
- [ ] 投稿いいね時に投稿者へ通知
- [ ] コメントいいね時にコメント投稿者へ通知

### UI/UX
- [ ] いいねアニメーション
- [ ] Optimistic UI（即座に反映）
- [ ] エラー時のロールバック

### データ取得
- [ ] 投稿のいいね数取得
- [ ] コメントのいいね数取得
- [ ] 自分がいいねしているかの判定
- [ ] 自分がブックマークしているかの判定

### いいね一覧
- [ ] `app/(main)/users/[id]/likes/page.tsx` - ユーザーのいいね一覧

---

## 完了条件
- [ ] 投稿へのいいねが正常に動作する
- [ ] コメントへのいいねが正常に動作する
- [ ] ブックマークが正常に動作する
- [ ] いいね/ブックマーク一覧が表示される
- [ ] 通知が正常に作成される

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
