'use server'

import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { recordNewFollower } from './analytics'

// フォロートグル
export async function toggleFollow(userId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  if (session.user.id === userId) {
    return { error: '自分自身をフォローすることはできません' }
  }

  // 現在のフォロー状態を確認
  const existingFollow = await prisma.follow.findUnique({
    where: {
      followerId_followingId: {
        followerId: session.user.id,
        followingId: userId,
      },
    },
  })

  if (existingFollow) {
    // フォロー解除
    await prisma.follow.delete({
      where: {
        followerId_followingId: {
          followerId: session.user.id,
          followingId: userId,
        },
      },
    })

    return { success: true, following: false }
  } else {
    // フォロー
    await prisma.follow.create({
      data: {
        followerId: session.user.id,
        followingId: userId,
      },
    })

    // 通知作成
    await prisma.notification.create({
      data: {
        userId,
        actorId: session.user.id,
        type: 'follow',
      },
    })

    // フォロワー増加を記録
    recordNewFollower(userId).catch(() => {})

    return { success: true, following: true }
  }
}

// フォロー状態取得
export async function getFollowStatus(userId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { following: false }
  }

  const existingFollow = await prisma.follow.findUnique({
    where: {
      followerId_followingId: {
        followerId: session.user.id,
        followingId: userId,
      },
    },
  })

  return { following: !!existingFollow }
}

// フォロワー一覧取得
export async function getFollowers(userId: string, cursor?: string, limit = 20) {
  const followers = await prisma.follow.findMany({
    where: { followingId: userId },
    include: {
      follower: {
        select: {
          id: true,
          nickname: true,
          avatarUrl: true,
          bio: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    ...(cursor && {
      cursor: {
        followerId_followingId: {
          followerId: cursor,
          followingId: userId,
        },
      },
      skip: 1,
    }),
  })

  const hasMore = followers.length === limit

  return {
    users: followers.map((f: typeof followers[number]) => f.follower),
    nextCursor: hasMore ? followers[followers.length - 1]?.followerId : undefined,
  }
}

// フォロー中一覧取得
export async function getFollowing(userId: string, cursor?: string, limit = 20) {
  const following = await prisma.follow.findMany({
    where: { followerId: userId },
    include: {
      following: {
        select: {
          id: true,
          nickname: true,
          avatarUrl: true,
          bio: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    ...(cursor && {
      cursor: {
        followerId_followingId: {
          followerId: userId,
          followingId: cursor,
        },
      },
      skip: 1,
    }),
  })

  const hasMore = following.length === limit

  return {
    users: following.map((f: typeof following[number]) => f.following),
    nextCursor: hasMore ? following[following.length - 1]?.followingId : undefined,
  }
}
