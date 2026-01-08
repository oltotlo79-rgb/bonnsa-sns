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

import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export async function toggleFollow(targetUserId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  if (session.user.id === targetUserId) {
    return { error: '自分自身をフォローできません' }
  }

  // 現在のフォロー状態を確認
  const existing = await prisma.follow.findUnique({
    where: {
      followerId_followingId: {
        followerId: session.user.id,
        followingId: targetUserId,
      },
    },
  })

  if (existing) {
    // フォロー解除
    await prisma.follow.delete({
      where: {
        followerId_followingId: {
          followerId: session.user.id,
          followingId: targetUserId,
        },
      },
    })
  } else {
    // フォロー
    await prisma.$transaction([
      prisma.follow.create({
        data: {
          followerId: session.user.id,
          followingId: targetUserId,
        },
      }),
      // 通知作成
      prisma.notification.create({
        data: {
          userId: targetUserId,
          actorId: session.user.id,
          type: 'follow',
        },
      }),
    ])
  }

  revalidatePath(`/users/${targetUserId}`)
  return { success: true, isFollowing: !existing }
}

// フォロー状態取得
export async function getFollowStatus(targetUserId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { isFollowing: false }
  }

  const existing = await prisma.follow.findUnique({
    where: {
      followerId_followingId: {
        followerId: session.user.id,
        followingId: targetUserId,
      },
    },
  })

  return { isFollowing: !!existing }
}

// フォロワー一覧取得
export async function getFollowers(userId: string, cursor?: string, limit = 20) {
  const followers = await prisma.follow.findMany({
    where: { followingId: userId },
    include: {
      follower: {
        select: { id: true, nickname: true, avatarUrl: true, bio: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    ...(cursor && {
      cursor: { followerId_followingId: { followerId: cursor, followingId: userId } },
      skip: 1,
    }),
  })

  return {
    users: followers.map((f) => f.follower),
    nextCursor: followers.length === limit ? followers[followers.length - 1]?.followerId : undefined,
  }
}

// フォロー中一覧取得
export async function getFollowing(userId: string, cursor?: string, limit = 20) {
  const following = await prisma.follow.findMany({
    where: { followerId: userId },
    include: {
      following: {
        select: { id: true, nickname: true, avatarUrl: true, bio: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    ...(cursor && {
      cursor: { followerId_followingId: { followerId: userId, followingId: cursor } },
      skip: 1,
    }),
  })

  return {
    users: following.map((f) => f.following),
    nextCursor: following.length === limit ? following[following.length - 1]?.followingId : undefined,
  }
}
```
