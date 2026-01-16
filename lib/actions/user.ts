'use server'

import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const profileSchema = z.object({
  nickname: z.string().min(1, 'ニックネームは必須です').max(50, 'ニックネームは50文字以内で入力してください'),
  bio: z.string().max(200, '自己紹介は200文字以内で入力してください').optional(),
  location: z.string().max(100, '居住地域は100文字以内で入力してください').optional(),
  bonsaiStartYear: z.number().int().min(1900).max(new Date().getFullYear()).nullable().optional(),
  bonsaiStartMonth: z.number().int().min(1).max(12).nullable().optional(),
})

export async function getUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      _count: {
        select: {
          posts: true,
          followers: true,
          following: true,
        },
      },
    },
  })

  if (!user) {
    return { error: 'ユーザーが見つかりません' }
  }

  return {
    user: {
      ...user,
      postsCount: user._count.posts,
      followersCount: user._count.followers,
      followingCount: user._count.following,
    },
  }
}

export async function getCurrentUser() {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  })

  if (!user) {
    return { error: 'ユーザー情報の取得に失敗しました' }
  }

  return { user }
}

export async function updateProfile(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // 盆栽開始年月の処理
  const bonsaiStartYearStr = formData.get('bonsaiStartYear') as string
  const bonsaiStartMonthStr = formData.get('bonsaiStartMonth') as string
  const bonsaiStartYear = bonsaiStartYearStr ? parseInt(bonsaiStartYearStr, 10) : null
  const bonsaiStartMonth = bonsaiStartMonthStr ? parseInt(bonsaiStartMonthStr, 10) : null

  const result = profileSchema.safeParse({
    nickname: formData.get('nickname'),
    bio: formData.get('bio') || '',
    location: formData.get('location') || '',
    bonsaiStartYear: isNaN(bonsaiStartYear as number) ? null : bonsaiStartYear,
    bonsaiStartMonth: isNaN(bonsaiStartMonth as number) ? null : bonsaiStartMonth,
  })

  if (!result.success) {
    return { error: result.error.issues[0].message }
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      nickname: result.data.nickname,
      bio: result.data.bio || null,
      location: result.data.location || null,
      bonsaiStartYear: result.data.bonsaiStartYear ?? null,
      bonsaiStartMonth: result.data.bonsaiStartMonth ?? null,
    },
  })

  revalidatePath(`/users/${session.user.id}`)
  revalidatePath('/settings/profile')
  return { success: true }
}

export async function updatePrivacy(isPublic: boolean) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { isPublic },
  })

  revalidatePath(`/users/${session.user.id}`)
  revalidatePath('/settings/account')
  return { success: true }
}

export async function uploadAvatar(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  const file = formData.get('file') as File
  if (!file) {
    return { error: 'ファイルが選択されていません' }
  }

  // ファイルサイズチェック（5MB）
  if (file.size > 5 * 1024 * 1024) {
    return { error: 'ファイルサイズは5MB以下にしてください' }
  }

  // MIMEタイプチェック
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    return { error: 'JPEG、PNG、WebP形式のみ対応しています' }
  }

  // TODO: Azure Blob Storageへのアップロード実装
  // 開発環境では仮のURLを返す
  const publicUrl = `/uploads/avatars/${session.user.id}-${Date.now()}.${file.type.split('/')[1]}`

  await prisma.user.update({
    where: { id: session.user.id },
    data: { avatarUrl: publicUrl },
  })

  revalidatePath(`/users/${session.user.id}`)
  revalidatePath('/settings/profile')
  return { success: true, url: publicUrl }
}

export async function uploadHeader(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  const file = formData.get('file') as File
  if (!file) {
    return { error: 'ファイルが選択されていません' }
  }

  // ファイルサイズチェック（5MB）
  if (file.size > 5 * 1024 * 1024) {
    return { error: 'ファイルサイズは5MB以下にしてください' }
  }

  // MIMEタイプチェック
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    return { error: 'JPEG、PNG、WebP形式のみ対応しています' }
  }

  // TODO: Azure Blob Storageへのアップロード実装
  const publicUrl = `/uploads/headers/${session.user.id}-${Date.now()}.${file.type.split('/')[1]}`

  await prisma.user.update({
    where: { id: session.user.id },
    data: { headerUrl: publicUrl },
  })

  revalidatePath(`/users/${session.user.id}`)
  revalidatePath('/settings/profile')
  return { success: true, url: publicUrl }
}

export async function deleteAccount() {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // Prismaのカスケード削除により関連データも削除される
  await prisma.user.delete({
    where: { id: session.user.id },
  })

  return { success: true }
}

export async function getFollowers(userId: string, cursor?: string) {
  const follows = await prisma.follow.findMany({
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
    take: 20,
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

  return { followers: follows.map((f) => f.follower) }
}

export async function getFollowing(userId: string, cursor?: string) {
  const follows = await prisma.follow.findMany({
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
    take: 20,
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

  return { following: follows.map((f) => f.following) }
}
