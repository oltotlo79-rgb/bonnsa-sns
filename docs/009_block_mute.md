# 009: ブロック・ミュート機能

## 概要
ユーザーのブロック・ミュート機能を実装する。
- ブロック: 相手からのフォロー、投稿閲覧を制限
- ミュート: 相手の投稿をタイムラインに表示しない

## 優先度
**中** - Phase 7

## 依存チケット
- 004: ユーザープロフィール
- 008: フォロー機能
- 010: タイムライン・フィード

---

## Todo

### ブロック機能
- [ ] `components/user/BlockButton.tsx` - ブロックボタン
- [ ] ブロック時の処理
  - [ ] 相互フォロー解除
  - [ ] ブロックレコード作成
- [ ] ブロック解除機能

### ミュート機能
- [ ] `components/user/MuteButton.tsx` - ミュートボタン
- [ ] ミュート/ミュート解除

### 設定ページ
- [ ] `app/(main)/settings/blocked/page.tsx` - ブロックユーザー一覧
- [ ] `app/(main)/settings/muted/page.tsx` - ミュートユーザー一覧
- [ ] ブロック解除ボタン
- [ ] ミュート解除ボタン

### Server Actions
- [ ] `lib/actions/block.ts`
  - [ ] `blockUser` - ユーザーブロック
  - [ ] `unblockUser` - ブロック解除
  - [ ] `getBlockedUsers` - ブロックユーザー一覧
  - [ ] `isBlocked` - ブロック状態確認
- [ ] `lib/actions/mute.ts`
  - [ ] `muteUser` - ユーザーミュート
  - [ ] `unmuteUser` - ミュート解除
  - [ ] `getMutedUsers` - ミュートユーザー一覧
  - [ ] `isMuted` - ミュート状態確認

### ブロックの影響
- [ ] ブロックしたユーザーの投稿を非表示
- [ ] ブロックしたユーザーからのコメントを非表示
- [ ] ブロックしたユーザーのプロフィールにアクセス不可
- [ ] ブロックされたユーザーから見てプロフィールにアクセス不可

### ミュートの影響
- [ ] ミュートしたユーザーの投稿をタイムラインに表示しない
- [ ] ミュートしたユーザーからの通知を非表示

### ユーザーメニュー連携
- [ ] プロフィールページにブロック/ミュートオプション追加
- [ ] ドロップダウンメニューから操作

### UI/UX
- [ ] ブロック確認ダイアログ
- [ ] ミュート確認ダイアログ
- [ ] 操作成功時のトースト表示

---

## 完了条件
- [ ] ブロック/ブロック解除が正常に動作する
- [ ] ミュート/ミュート解除が正常に動作する
- [ ] ブロックしたユーザーの投稿が表示されない
- [ ] ミュートしたユーザーの投稿がタイムラインに表示されない
- [ ] ブロック/ミュートユーザー一覧が表示される

## 参考コード
```typescript
// lib/actions/block.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function blockUser(targetUserId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: '認証が必要です' }
  }

  // 相互フォロー解除
  await supabase
    .from('follows')
    .delete()
    .or(`and(follower_id.eq.${user.id},following_id.eq.${targetUserId}),and(follower_id.eq.${targetUserId},following_id.eq.${user.id})`)

  // ブロック作成
  const { error } = await supabase
    .from('blocks')
    .insert({
      blocker_id: user.id,
      blocked_id: targetUserId,
    })

  if (error) {
    return { error: 'ブロックに失敗しました' }
  }

  revalidatePath('/feed')
  revalidatePath(`/users/${targetUserId}`)
  return { success: true }
}
```
