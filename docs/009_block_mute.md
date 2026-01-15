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
- [*] `components/user/BlockButton.tsx` - ブロックボタン
- [*] ブロック時の処理
  - [*] 相互フォロー解除
  - [*] ブロックレコード作成
- [*] ブロック解除機能

### ミュート機能
- [*] `components/user/MuteButton.tsx` - ミュートボタン
- [*] ミュート/ミュート解除

### 設定ページ
- [*] `app/(main)/settings/blocked/page.tsx` - ブロックユーザー一覧
- [*] `app/(main)/settings/muted/page.tsx` - ミュートユーザー一覧
- [*] ブロック解除ボタン
- [*] ミュート解除ボタン

### Server Actions
- [*] `lib/actions/block.ts`
  - [*] `blockUser` - ユーザーブロック
  - [*] `unblockUser` - ブロック解除
  - [*] `getBlockedUsers` - ブロックユーザー一覧
  - [*] `isBlocked` - ブロック状態確認
- [*] `lib/actions/mute.ts`
  - [*] `muteUser` - ユーザーミュート
  - [*] `unmuteUser` - ミュート解除
  - [*] `getMutedUsers` - ミュートユーザー一覧
  - [*] `isMuted` - ミュート状態確認

### ブロックの影響
- [x] ブロックしたユーザーの投稿を非表示
- [x] ブロックしたユーザーからのコメントを非表示
- [x] ブロックしたユーザーのプロフィールにアクセス不可
- [x] ブロックされたユーザーから見てプロフィールにアクセス不可

### ミュートの影響
- [x] ミュートしたユーザーの投稿をタイムラインに表示しない
- [x] ミュートしたユーザーからの通知を非表示

### ユーザーメニュー連携
- [*] プロフィールページにブロック/ミュートオプション追加
- [*] ドロップダウンメニューから操作

### UI/UX
- [*] ブロック確認ダイアログ
- [*] ミュート確認ダイアログ
- [*] 操作成功時のトースト表示

---

## 完了条件
- [*] ブロック/ブロック解除が正常に動作する
- [*] ミュート/ミュート解除が正常に動作する
- [*] ブロックしたユーザーの投稿が表示されない
- [*] ミュートしたユーザーの投稿がタイムラインに表示されない
- [*] ブロック/ミュートユーザー一覧が表示される

## 参考コード
```typescript
// lib/actions/block.ts
'use server'

import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export async function blockUser(targetUserId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  if (session.user.id === targetUserId) {
    return { error: '自分自身をブロックできません' }
  }

  // トランザクションで相互フォロー解除とブロック作成を実行
  await prisma.$transaction([
    // 相互フォロー解除
    prisma.follow.deleteMany({
      where: {
        OR: [
          { followerId: session.user.id, followingId: targetUserId },
          { followerId: targetUserId, followingId: session.user.id },
        ],
      },
    }),
    // ブロック作成
    prisma.block.create({
      data: {
        blockerId: session.user.id,
        blockedId: targetUserId,
      },
    }),
  ])

  revalidatePath('/feed')
  revalidatePath(`/users/${targetUserId}`)
  return { success: true }
}

export async function unblockUser(targetUserId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  await prisma.block.delete({
    where: {
      blockerId_blockedId: {
        blockerId: session.user.id,
        blockedId: targetUserId,
      },
    },
  })

  revalidatePath('/feed')
  revalidatePath(`/users/${targetUserId}`)
  return { success: true }
}

export async function getBlockedUsers(cursor?: string, limit = 20) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です', users: [] }
  }

  const blocks = await prisma.block.findMany({
    where: { blockerId: session.user.id },
    include: {
      blocked: {
        select: { id: true, nickname: true, avatarUrl: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    ...(cursor && {
      cursor: { blockerId_blockedId: { blockerId: session.user.id, blockedId: cursor } },
      skip: 1,
    }),
  })

  return {
    users: blocks.map((b) => b.blocked),
    nextCursor: blocks.length === limit ? blocks[blocks.length - 1]?.blockedId : undefined,
  }
}

export async function isBlocked(targetUserId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { blocked: false }
  }

  const block = await prisma.block.findUnique({
    where: {
      blockerId_blockedId: {
        blockerId: session.user.id,
        blockedId: targetUserId,
      },
    },
  })

  return { blocked: !!block }
}
```

```typescript
// lib/actions/mute.ts
'use server'

import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export async function muteUser(targetUserId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  await prisma.mute.create({
    data: {
      muterId: session.user.id,
      mutedId: targetUserId,
    },
  })

  revalidatePath('/feed')
  return { success: true }
}

export async function unmuteUser(targetUserId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  await prisma.mute.delete({
    where: {
      muterId_mutedId: {
        muterId: session.user.id,
        mutedId: targetUserId,
      },
    },
  })

  revalidatePath('/feed')
  return { success: true }
}

export async function getMutedUsers(cursor?: string, limit = 20) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です', users: [] }
  }

  const mutes = await prisma.mute.findMany({
    where: { muterId: session.user.id },
    include: {
      muted: {
        select: { id: true, nickname: true, avatarUrl: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    ...(cursor && {
      cursor: { muterId_mutedId: { muterId: session.user.id, mutedId: cursor } },
      skip: 1,
    }),
  })

  return {
    users: mutes.map((m) => m.muted),
    nextCursor: mutes.length === limit ? mutes[mutes.length - 1]?.mutedId : undefined,
  }
}
```
