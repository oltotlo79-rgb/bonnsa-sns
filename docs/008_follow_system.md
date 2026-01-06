# 008: フォロー機能

## 概要
ユーザーのフォロー/フォロー解除機能を実装する。

## 優先度
**高** - Phase 2

## 依存チケット
- 004: ユーザープロフィール

---

## Todo

### フォローボタン
- [ ] `components/user/FollowButton.tsx` - フォローボタン
  - [ ] フォロー状態の表示
  - [ ] クリックでトグル
  - [ ] Optimistic UI
  - [ ] 自分自身には表示しない

### フォロー一覧
- [ ] `app/(main)/users/[id]/followers/page.tsx` - フォロワー一覧
- [ ] `app/(main)/users/[id]/following/page.tsx` - フォロー中一覧
- [ ] `components/user/FollowerList.tsx` - フォロワーリスト
- [ ] `components/user/FollowingList.tsx` - フォロー中リスト

### Server Actions
- [ ] `lib/actions/follow.ts`
  - [ ] `toggleFollow` - フォロートグル
  - [ ] `getFollowStatus` - フォロー状態取得
  - [ ] `getFollowers` - フォロワー一覧取得
  - [ ] `getFollowing` - フォロー中一覧取得
  - [ ] `getFollowCounts` - フォロー数/フォロワー数取得

### 通知連携
- [ ] フォロー時にフォローされたユーザーへ通知

### UI/UX
- [ ] フォローボタンのホバー状態
- [ ] 「フォロー中」→ホバーで「フォロー解除」
- [ ] Optimistic UI
- [ ] フォロー数のリアルタイム更新

### データ取得
- [ ] フォロー中ユーザーの取得
- [ ] フォロワーの取得
- [ ] 相互フォロー判定
- [ ] ページネーション対応

### プロフィール連携
- [ ] プロフィールヘッダーにフォロー数表示
- [ ] プロフィールヘッダーにフォローボタン表示

---

## 完了条件
- [ ] フォロー/フォロー解除が正常に動作する
- [ ] フォロワー/フォロー中一覧が表示される
- [ ] フォロー数が正しく表示される
- [ ] 通知が正常に作成される

## 参考コード
```typescript
// lib/actions/follow.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function toggleFollow(targetUserId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: '認証が必要です' }
  }

  if (user.id === targetUserId) {
    return { error: '自分自身をフォローできません' }
  }

  // 現在のフォロー状態を確認
  const { data: existing } = await supabase
    .from('follows')
    .select()
    .eq('follower_id', user.id)
    .eq('following_id', targetUserId)
    .single()

  if (existing) {
    // フォロー解除
    await supabase
      .from('follows')
      .delete()
      .eq('follower_id', user.id)
      .eq('following_id', targetUserId)
  } else {
    // フォロー
    await supabase
      .from('follows')
      .insert({
        follower_id: user.id,
        following_id: targetUserId,
      })

    // 通知作成
    await supabase.from('notifications').insert({
      user_id: targetUserId,
      actor_id: user.id,
      type: 'follow',
    })
  }

  revalidatePath(`/users/${targetUserId}`)
  return { success: true, isFollowing: !existing }
}
```
