# 012: 通知機能

## 概要
いいね・コメント・フォロー等のアクションに対するリアルタイム通知機能を実装する。
WebSocket（Socket.io）とブラウザ通知を使用。

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
- [ ] Socket.io サーバー設定
- [ ] 通知イベントのサブスクリプション
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
// lib/actions/notification.ts
'use server'

import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

export async function getNotifications(cursor?: string, limit = 20) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です', notifications: [] }
  }

  const notifications = await prisma.notification.findMany({
    where: { userId: session.user.id },
    include: {
      actor: {
        select: { id: true, nickname: true, avatarUrl: true },
      },
      post: {
        select: { id: true, content: true },
      },
      comment: {
        select: { id: true, content: true },
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
    notifications,
    nextCursor: notifications.length === limit ? notifications[notifications.length - 1]?.id : undefined,
  }
}

export async function markAsRead(notificationId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  await prisma.notification.update({
    where: {
      id: notificationId,
      userId: session.user.id,
    },
    data: { isRead: true },
  })

  return { success: true }
}

export async function markAllAsRead() {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  await prisma.notification.updateMany({
    where: {
      userId: session.user.id,
      isRead: false,
    },
    data: { isRead: true },
  })

  return { success: true }
}

export async function getUnreadCount() {
  const session = await auth()
  if (!session?.user?.id) {
    return { count: 0 }
  }

  const count = await prisma.notification.count({
    where: {
      userId: session.user.id,
      isRead: false,
    },
  })

  return { count }
}
```

```typescript
// components/notification/NotificationListener.tsx
'use client'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { io } from 'socket.io-client'

export function NotificationListener({ userId }: { userId: string }) {
  const queryClient = useQueryClient()

  useEffect(() => {
    const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || '', {
      query: { userId },
    })

    socket.on('notification', (notification) => {
      // React Queryのキャッシュを更新
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['unreadCount'] })

      // ブラウザ通知
      if (Notification.permission === 'granted') {
        new Notification('BON-LOG', {
          body: getNotificationMessage(notification),
          icon: '/icon.png',
        })
      }
    })

    return () => {
      socket.disconnect()
    }
  }, [userId, queryClient])

  return null
}

function getNotificationMessage(notification: { type: string }) {
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
