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

  try {
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
  } catch (error) {
    console.error('Block user error:', error)
    return { error: 'ブロックに失敗しました' }
  }
}

export async function unblockUser(targetUserId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  try {
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
    revalidatePath('/settings/blocked')
    return { success: true }
  } catch (error) {
    console.error('Unblock user error:', error)
    return { error: 'ブロック解除に失敗しました' }
  }
}

export async function getBlockedUsers(cursor?: string, limit = 20) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です', users: [] }
  }

  try {
    const blocks = await prisma.block.findMany({
      where: { blockerId: session.user.id },
      include: {
        blocked: {
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
        cursor: { blockerId_blockedId: { blockerId: session.user.id, blockedId: cursor } },
        skip: 1,
      }),
    })

    return {
      users: blocks.map((b) => b.blocked),
      nextCursor: blocks.length === limit ? blocks[blocks.length - 1]?.blockedId : undefined,
    }
  } catch (error) {
    console.error('Get blocked users error:', error)
    return { error: 'ブロックユーザーの取得に失敗しました', users: [] }
  }
}

export async function isBlocked(targetUserId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { blocked: false, blockedBy: false }
  }

  try {
    const [block, blockedBy] = await Promise.all([
      // 自分がブロックしているか
      prisma.block.findUnique({
        where: {
          blockerId_blockedId: {
            blockerId: session.user.id,
            blockedId: targetUserId,
          },
        },
      }),
      // 相手からブロックされているか
      prisma.block.findUnique({
        where: {
          blockerId_blockedId: {
            blockerId: targetUserId,
            blockedId: session.user.id,
          },
        },
      }),
    ])

    return {
      blocked: !!block,
      blockedBy: !!blockedBy,
    }
  } catch (error) {
    console.error('Check block status error:', error)
    return { blocked: false, blockedBy: false }
  }
}
