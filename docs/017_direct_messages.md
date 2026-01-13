# 017: ダイレクトメッセージ機能

## 概要
ユーザー間で1対1のメッセージを送受信できる機能を実装する。

## 優先度
**中** - Phase 3

## 依存チケット
- 003: 認証
- 004: ユーザープロフィール
- 008: フォロー機能
- 009: ブロック/ミュート
- 012: 通知

---

## Todo

### データベース設計
- [ ] `Conversation` モデル - 会話を管理
- [ ] `ConversationParticipant` モデル - 会話の参加者
- [ ] `Message` モデル - メッセージ本体
- [ ] `MessageMedia` モデル - メッセージに添付するメディア（任意）
- [ ] マイグレーション実行

### Server Actions
- [ ] `lib/actions/message.ts`
  - [ ] `createConversation` - 会話を開始（または既存を取得）
  - [ ] `sendMessage` - メッセージ送信
  - [ ] `getConversations` - 会話一覧取得
  - [ ] `getMessages` - 特定の会話のメッセージ取得
  - [ ] `markAsRead` - 既読にする
  - [ ] `getUnreadCount` - 未読メッセージ数取得
  - [ ] `deleteMessage` - メッセージ削除（任意）

### ページ
- [ ] `app/(main)/messages/page.tsx` - 会話一覧ページ
- [ ] `app/(main)/messages/[conversationId]/page.tsx` - 会話詳細ページ
- [ ] `app/(main)/messages/new/page.tsx` - 新規会話作成ページ（任意）

### コンポーネント
- [ ] `components/message/ConversationList.tsx` - 会話一覧
- [ ] `components/message/ConversationCard.tsx` - 会話カード
- [ ] `components/message/MessageList.tsx` - メッセージ一覧
- [ ] `components/message/MessageCard.tsx` - メッセージカード
- [ ] `components/message/MessageForm.tsx` - メッセージ送信フォーム
- [ ] `components/message/NewConversationModal.tsx` - 新規会話モーダル

### ユーザープロフィール連携
- [ ] プロフィールページに「メッセージを送る」ボタン追加
- [ ] 自分自身には表示しない
- [ ] ブロックされている場合は無効化

### 通知連携
- [ ] メッセージ受信時に通知作成
- [ ] ヘッダーに未読メッセージバッジ表示

### リアルタイム機能（Phase 3+）
- [ ] WebSocket (Socket.io) 導入
- [ ] 新着メッセージのリアルタイム受信
- [ ] 入力中インジケーター表示

### プライバシー・制限
- [ ] ブロックしているユーザーへのメッセージ送信禁止
- [ ] ブロックされているユーザーからのメッセージ受信拒否
- [ ] 1日のメッセージ送信上限（スパム対策）

---

## 完了条件
- [ ] 会話一覧が表示される
- [ ] メッセージの送受信ができる
- [ ] 既読状態が正しく表示される
- [ ] 未読メッセージ数がバッジで表示される
- [ ] 通知が正常に作成される
- [ ] ブロック/ミュート機能と連携している

---

## 参考スキーマ

```prisma
// 会話
model Conversation {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  participants ConversationParticipant[]
  messages     Message[]

  @@map("conversations")
}

// 会話参加者
model ConversationParticipant {
  conversationId String   @map("conversation_id")
  userId         String   @map("user_id")
  joinedAt       DateTime @default(now()) @map("joined_at")
  lastReadAt     DateTime? @map("last_read_at")

  conversation Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  user         User         @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([conversationId, userId])
  @@map("conversation_participants")
}

// メッセージ
model Message {
  id             String   @id @default(cuid())
  conversationId String   @map("conversation_id")
  senderId       String   @map("sender_id")
  content        String   @db.Text
  createdAt      DateTime @default(now()) @map("created_at")

  conversation Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  sender       User         @relation(fields: [senderId], references: [id], onDelete: Cascade)

  @@index([conversationId])
  @@map("messages")
}
```

---

## 参考コード

```typescript
// lib/actions/message.ts
'use server'

import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

// 会話を開始または取得
export async function getOrCreateConversation(targetUserId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  if (session.user.id === targetUserId) {
    return { error: '自分自身にメッセージを送ることはできません' }
  }

  // ブロックチェック
  const blocked = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: session.user.id, blockedId: targetUserId },
        { blockerId: targetUserId, blockedId: session.user.id },
      ],
    },
  })

  if (blocked) {
    return { error: 'このユーザーにはメッセージを送れません' }
  }

  // 既存の会話を検索
  const existingConversation = await prisma.conversation.findFirst({
    where: {
      AND: [
        { participants: { some: { userId: session.user.id } } },
        { participants: { some: { userId: targetUserId } } },
      ],
    },
  })

  if (existingConversation) {
    return { conversationId: existingConversation.id }
  }

  // 新規会話を作成
  const conversation = await prisma.conversation.create({
    data: {
      participants: {
        create: [
          { userId: session.user.id },
          { userId: targetUserId },
        ],
      },
    },
  })

  return { conversationId: conversation.id }
}

// メッセージ送信
export async function sendMessage(conversationId: string, content: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  if (!content || content.trim().length === 0) {
    return { error: 'メッセージを入力してください' }
  }

  if (content.length > 1000) {
    return { error: 'メッセージは1000文字以内で入力してください' }
  }

  // 会話の参加者かチェック
  const participant = await prisma.conversationParticipant.findUnique({
    where: {
      conversationId_userId: {
        conversationId,
        userId: session.user.id,
      },
    },
  })

  if (!participant) {
    return { error: 'この会話にアクセスする権限がありません' }
  }

  // メッセージ作成
  const message = await prisma.message.create({
    data: {
      conversationId,
      senderId: session.user.id,
      content: content.trim(),
    },
  })

  // 会話のupdatedAtを更新
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  })

  // 相手に通知を作成
  const otherParticipant = await prisma.conversationParticipant.findFirst({
    where: {
      conversationId,
      userId: { not: session.user.id },
    },
  })

  if (otherParticipant) {
    await prisma.notification.create({
      data: {
        userId: otherParticipant.userId,
        actorId: session.user.id,
        type: 'message',
      },
    })
  }

  revalidatePath(`/messages/${conversationId}`)
  return { success: true, message }
}

// 会話一覧取得
export async function getConversations() {
  const session = await auth()
  if (!session?.user?.id) {
    return { conversations: [] }
  }

  const conversations = await prisma.conversation.findMany({
    where: {
      participants: { some: { userId: session.user.id } },
    },
    include: {
      participants: {
        where: { userId: { not: session.user.id } },
        include: {
          user: {
            select: { id: true, nickname: true, avatarUrl: true },
          },
        },
      },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { updatedAt: 'desc' },
  })

  return { conversations }
}

// メッセージ取得
export async function getMessages(conversationId: string, cursor?: string, limit = 50) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // 会話の参加者かチェック
  const participant = await prisma.conversationParticipant.findUnique({
    where: {
      conversationId_userId: {
        conversationId,
        userId: session.user.id,
      },
    },
  })

  if (!participant) {
    return { error: 'この会話にアクセスする権限がありません' }
  }

  const messages = await prisma.message.findMany({
    where: { conversationId },
    include: {
      sender: {
        select: { id: true, nickname: true, avatarUrl: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1,
    }),
  })

  // 既読を更新
  await prisma.conversationParticipant.update({
    where: {
      conversationId_userId: {
        conversationId,
        userId: session.user.id,
      },
    },
    data: { lastReadAt: new Date() },
  })

  return {
    messages: messages.reverse(), // 古い順に並べ替え
    nextCursor: messages.length === limit ? messages[0]?.id : undefined,
  }
}
```

---

## UI設計

### 会話一覧 (`/messages`)
```
┌─────────────────────────────────┐
│ メッセージ          [新規作成]  │
├─────────────────────────────────┤
│ [Avatar] ユーザー名      1時間前│
│          最新メッセージ...   ●  │
├─────────────────────────────────┤
│ [Avatar] ユーザー名      昨日   │
│          最新メッセージ...      │
└─────────────────────────────────┘
```

### 会話詳細 (`/messages/[id]`)
```
┌─────────────────────────────────┐
│ ← [Avatar] ユーザー名           │
├─────────────────────────────────┤
│                                 │
│        [相手のメッセージ]       │
│                          10:00  │
│                                 │
│ [自分のメッセージ]              │
│ 10:05                           │
│                                 │
├─────────────────────────────────┤
│ [入力欄]               [送信]   │
└─────────────────────────────────┘
```
