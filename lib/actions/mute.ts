'use server'

import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export async function muteUser(targetUserId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  if (session.user.id === targetUserId) {
    return { error: '自分自身をミュートできません' }
  }

  try {
    await prisma.mute.create({
      data: {
        muterId: session.user.id,
        mutedId: targetUserId,
      },
    })

    revalidatePath('/feed')
    revalidatePath(`/users/${targetUserId}`)
    return { success: true }
  } catch (error) {
    console.error('Mute user error:', error)
    return { error: 'ミュートに失敗しました' }
  }
}

export async function unmuteUser(targetUserId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  try {
    await prisma.mute.delete({
      where: {
        muterId_mutedId: {
          muterId: session.user.id,
          mutedId: targetUserId,
        },
      },
    })

    revalidatePath('/feed')
    revalidatePath(`/users/${targetUserId}`)
    revalidatePath('/settings/muted')
    return { success: true }
  } catch (error) {
    console.error('Unmute user error:', error)
    return { error: 'ミュート解除に失敗しました' }
  }
}

export async function getMutedUsers(cursor?: string, limit = 20) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です', users: [] }
  }

  try {
    const mutes = await prisma.mute.findMany({
      where: { muterId: session.user.id },
      include: {
        muted: {
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
        cursor: { muterId_mutedId: { muterId: session.user.id, mutedId: cursor } },
        skip: 1,
      }),
    })

    return {
      users: mutes.map((m) => m.muted),
      nextCursor: mutes.length === limit ? mutes[mutes.length - 1]?.mutedId : undefined,
    }
  } catch (error) {
    console.error('Get muted users error:', error)
    return { error: 'ミュートユーザーの取得に失敗しました', users: [] }
  }
}

export async function isMuted(targetUserId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { muted: false }
  }

  try {
    const mute = await prisma.mute.findUnique({
      where: {
        muterId_mutedId: {
          muterId: session.user.id,
          mutedId: targetUserId,
        },
      },
    })

    return { muted: !!mute }
  } catch (error) {
    console.error('Check mute status error:', error)
    return { muted: false }
  }
}
