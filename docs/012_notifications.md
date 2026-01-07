# 012: 通知機能

## 概要
いいね・コメント・フォロー等のアクションに対するリアルタイム通知機能を実装する。
WebSocket（Supabase Realtime）とブラウザ通知を使用。

## 優先度
**中** - Phase 6

## 依存チケット
- 007: いいね・ブックマーク機能
- 006: コメント機能
- 008: フォロー機能

---

## Todo

### 通知ページ
- [ ] `app/(main)/notifications/page.tsx` - 通知一覧ページ
- [ ] `app/(main)/notifications/loading.tsx` - ローディング

### 通知コンポーネント
- [ ] `components/notification/NotificationList.tsx` - 通知一覧
- [ ] `components/notification/NotificationItem.tsx` - 通知アイテム
  - [ ] 通知タイプアイコン
  - [ ] アクター情報
  - [ ] 対象コンテンツ
  - [ ] 日時
  - [ ] 既読/未読状態
- [ ] `components/notification/NotificationBadge.tsx` - 未読バッジ
- [ ] `components/notification/NotificationListener.tsx` - リアルタイムリスナー

### 通知種類
- [ ] いいねされた時
- [ ] コメントされた時
- [ ] フォローされた時
- [ ] 引用投稿された時
- [ ] 返信された時

### Server Actions
- [ ] `lib/actions/notification.ts`
  - [ ] `getNotifications` - 通知一覧取得
  - [ ] `markAsRead` - 既読にする
  - [ ] `markAllAsRead` - すべて既読にする
  - [ ] `getUnreadCount` - 未読数取得
  - [ ] `createNotification` - 通知作成

### リアルタイム通知
- [ ] Supabase Realtime設定
- [ ] 通知テーブルのサブスクリプション
- [ ] 新着通知の即座反映

### ブラウザ通知
- [ ] Service Worker設定
- [ ] 通知許可リクエスト
- [ ] プッシュ通知送信
- [ ] 通知クリックで該当ページへ遷移

### 通知バッジ
- [ ] ナビゲーションに未読バッジ表示
- [ ] リアルタイム更新
- [ ] ページタイトルに未読数表示

### UI/UX
- [ ] 通知クリックで該当コンテンツへ遷移
- [ ] スワイプで既読（モバイル）
- [ ] 無限スクロール
- [ ] 通知のグループ化（同一投稿への複数いいね等）

### 通知設定（将来）
- [ ] 通知種類ごとのON/OFF
- [ ] 通知頻度設定

---

## 完了条件
- [ ] 通知一覧が正常に表示される
- [ ] リアルタイムで新着通知が表示される
- [ ] 既読/未読管理が正常に動作する
- [ ] ブラウザ通知が正常に動作する
- [ ] 未読バッジが正常に表示される

## 参考コード
```typescript
// components/notification/NotificationListener.tsx
'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'

export function NotificationListener({ userId }: { userId: string }) {
  const supabase = createClient()
  const router = useRouter()
  const queryClient = useQueryClient()

  useEffect(() => {
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          // React Queryのキャッシュを更新
          queryClient.invalidateQueries({ queryKey: ['notifications'] })
          queryClient.invalidateQueries({ queryKey: ['unreadCount'] })

          // ブラウザ通知
          if (Notification.permission === 'granted') {
            new Notification('BON-LOG', {
              body: getNotificationMessage(payload.new),
              icon: '/icon.png',
            })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, supabase, queryClient])

  return null
}

function getNotificationMessage(notification: any) {
  switch (notification.type) {
    case 'like':
      return 'あなたの投稿がいいねされました'
    case 'comment':
      return 'あなたの投稿にコメントがありました'
    case 'follow':
      return '新しいフォロワーがいます'
    case 'quote':
      return 'あなたの投稿が引用されました'
    case 'reply':
      return 'あなたのコメントに返信がありました'
    default:
      return '新しい通知があります'
  }
}
```

```typescript
// lib/actions/notification.ts
'use server'

import { createClient } from '@/lib/supabase/server'

export async function getNotifications(cursor?: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: '認証が必要です' }
  }

  let query = supabase
    .from('notifications')
    .select(`
      *,
      actor:users!actor_id(id, nickname, avatar_url),
      post:posts(id, content)
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  if (cursor) {
    query = query.lt('created_at', cursor)
  }

  const { data: notifications, error } = await query

  if (error) {
    return { error: '通知の取得に失敗しました' }
  }

  return { notifications }
}

export async function markAsRead(notificationId: string) {
  const supabase = await createClient()

  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)

  return { success: true }
}
```
