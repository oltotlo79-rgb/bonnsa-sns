'use server'

import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { isPremiumUser, getMembershipLimits } from '@/lib/premium'
import { revalidatePath } from 'next/cache'

/**
 * 予約投稿を作成
 */
export async function createScheduledPost(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // 有料会員チェック
  const isPremium = await isPremiumUser(session.user.id)
  if (!isPremium) {
    return { error: '予約投稿は有料会員限定の機能です' }
  }

  const content = formData.get('content') as string
  const scheduledAtStr = formData.get('scheduledAt') as string
  const genreIds = formData.getAll('genreIds') as string[]
  const mediaUrls = formData.getAll('mediaUrls') as string[]
  const mediaTypes = formData.getAll('mediaTypes') as string[]

  // 予約日時のバリデーション
  if (!scheduledAtStr) {
    return { error: '予約日時を指定してください' }
  }

  const scheduledAt = new Date(scheduledAtStr)

  // 過去の日時はエラー
  if (scheduledAt <= new Date()) {
    return { error: '予約日時は未来の日時を指定してください' }
  }

  // 最大30日後までに制限
  const maxDate = new Date()
  maxDate.setDate(maxDate.getDate() + 30)
  if (scheduledAt > maxDate) {
    return { error: '予約日時は30日以内で指定してください' }
  }

  // コンテンツのバリデーション
  if (!content && mediaUrls.length === 0) {
    return { error: 'テキストまたはメディアを入力してください' }
  }

  // 制限チェック
  const limits = await getMembershipLimits(session.user.id)

  if (content && content.length > limits.maxPostLength) {
    return { error: `投稿は${limits.maxPostLength}文字以内で入力してください` }
  }

  // ジャンル数チェック
  if (genreIds.length > 3) {
    return { error: 'ジャンルは3つまで選択できます' }
  }

  const imageCount = mediaTypes.filter(t => t === 'image').length
  if (imageCount > limits.maxImages) {
    return { error: `画像は${limits.maxImages}枚までです` }
  }

  const videoCount = mediaTypes.filter(t => t === 'video').length
  if (videoCount > limits.maxVideos) {
    return { error: `動画は${limits.maxVideos}本までです` }
  }

  // 予約投稿の上限チェック（10件まで）
  const pendingCount = await prisma.scheduledPost.count({
    where: {
      userId: session.user.id,
      status: 'pending',
    },
  })

  if (pendingCount >= 10) {
    return { error: '予約投稿は10件までです。既存の予約を削除してください。' }
  }

  // 予約投稿作成
  const scheduledPost = await prisma.scheduledPost.create({
    data: {
      userId: session.user.id,
      content: content || null,
      scheduledAt,
      media: mediaUrls.length > 0 ? {
        create: mediaUrls.map((url, index) => ({
          url,
          type: mediaTypes[index] || 'image',
          sortOrder: index,
        })),
      } : undefined,
      genres: genreIds.length > 0 ? {
        create: genreIds.map((genreId) => ({
          genreId,
        })),
      } : undefined,
    },
  })

  revalidatePath('/posts/scheduled')
  return { success: true, scheduledPostId: scheduledPost.id }
}

/**
 * 予約投稿一覧を取得
 */
export async function getScheduledPosts() {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  const isPremium = await isPremiumUser(session.user.id)
  if (!isPremium) {
    return { error: '予約投稿は有料会員限定の機能です', scheduledPosts: [] }
  }

  const scheduledPosts = await prisma.scheduledPost.findMany({
    where: {
      userId: session.user.id,
    },
    include: {
      media: {
        orderBy: { sortOrder: 'asc' },
      },
      genres: {
        include: {
          genre: true,
        },
      },
    },
    orderBy: { scheduledAt: 'asc' },
  })

  return {
    scheduledPosts: scheduledPosts.map(sp => ({
      ...sp,
      genres: sp.genres.map(g => g.genre),
    })),
  }
}

/**
 * 予約投稿を取得
 */
export async function getScheduledPost(id: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  const scheduledPost = await prisma.scheduledPost.findUnique({
    where: { id },
    include: {
      media: {
        orderBy: { sortOrder: 'asc' },
      },
      genres: {
        include: {
          genre: true,
        },
      },
    },
  })

  if (!scheduledPost) {
    return { error: '予約投稿が見つかりません' }
  }

  if (scheduledPost.userId !== session.user.id) {
    return { error: 'アクセス権限がありません' }
  }

  return {
    scheduledPost: {
      ...scheduledPost,
      genres: scheduledPost.genres.map(g => g.genre),
    },
  }
}

/**
 * 予約投稿を更新
 */
export async function updateScheduledPost(id: string, formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // 予約投稿の存在と権限チェック
  const existing = await prisma.scheduledPost.findUnique({
    where: { id },
    select: { userId: true, status: true },
  })

  if (!existing) {
    return { error: '予約投稿が見つかりません' }
  }

  if (existing.userId !== session.user.id) {
    return { error: '更新権限がありません' }
  }

  if (existing.status !== 'pending') {
    return { error: '公開済みまたはキャンセル済みの予約投稿は編集できません' }
  }

  const content = formData.get('content') as string
  const scheduledAtStr = formData.get('scheduledAt') as string
  const genreIds = formData.getAll('genreIds') as string[]
  const mediaUrls = formData.getAll('mediaUrls') as string[]
  const mediaTypes = formData.getAll('mediaTypes') as string[]

  // 予約日時のバリデーション
  if (!scheduledAtStr) {
    return { error: '予約日時を指定してください' }
  }

  const scheduledAt = new Date(scheduledAtStr)

  if (scheduledAt <= new Date()) {
    return { error: '予約日時は未来の日時を指定してください' }
  }

  const maxDate = new Date()
  maxDate.setDate(maxDate.getDate() + 30)
  if (scheduledAt > maxDate) {
    return { error: '予約日時は30日以内で指定してください' }
  }

  // コンテンツのバリデーション
  if (!content && mediaUrls.length === 0) {
    return { error: 'テキストまたはメディアを入力してください' }
  }

  const limits = await getMembershipLimits(session.user.id)

  if (content && content.length > limits.maxPostLength) {
    return { error: `投稿は${limits.maxPostLength}文字以内で入力してください` }
  }

  if (genreIds.length > 3) {
    return { error: 'ジャンルは3つまで選択できます' }
  }

  const imageCount = mediaTypes.filter(t => t === 'image').length
  if (imageCount > limits.maxImages) {
    return { error: `画像は${limits.maxImages}枚までです` }
  }

  const videoCount = mediaTypes.filter(t => t === 'video').length
  if (videoCount > limits.maxVideos) {
    return { error: `動画は${limits.maxVideos}本までです` }
  }

  // トランザクションで更新
  await prisma.$transaction(async (tx) => {
    // 既存のメディアとジャンルを削除
    await tx.scheduledPostMedia.deleteMany({ where: { scheduledPostId: id } })
    await tx.scheduledPostGenre.deleteMany({ where: { scheduledPostId: id } })

    // 予約投稿を更新
    await tx.scheduledPost.update({
      where: { id },
      data: {
        content: content || null,
        scheduledAt,
        media: mediaUrls.length > 0 ? {
          create: mediaUrls.map((url, index) => ({
            url,
            type: mediaTypes[index] || 'image',
            sortOrder: index,
          })),
        } : undefined,
        genres: genreIds.length > 0 ? {
          create: genreIds.map((genreId) => ({
            genreId,
          })),
        } : undefined,
      },
    })
  })

  revalidatePath('/posts/scheduled')
  return { success: true }
}

/**
 * 予約投稿を削除
 */
export async function deleteScheduledPost(id: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  const scheduledPost = await prisma.scheduledPost.findUnique({
    where: { id },
    select: { userId: true, status: true },
  })

  if (!scheduledPost) {
    return { error: '予約投稿が見つかりません' }
  }

  if (scheduledPost.userId !== session.user.id) {
    return { error: '削除権限がありません' }
  }

  if (scheduledPost.status === 'published') {
    return { error: '公開済みの予約投稿は削除できません' }
  }

  await prisma.scheduledPost.delete({ where: { id } })

  revalidatePath('/posts/scheduled')
  return { success: true }
}

/**
 * 予約投稿をキャンセル
 */
export async function cancelScheduledPost(id: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  const scheduledPost = await prisma.scheduledPost.findUnique({
    where: { id },
    select: { userId: true, status: true },
  })

  if (!scheduledPost) {
    return { error: '予約投稿が見つかりません' }
  }

  if (scheduledPost.userId !== session.user.id) {
    return { error: 'キャンセル権限がありません' }
  }

  if (scheduledPost.status !== 'pending') {
    return { error: '予約中の投稿のみキャンセルできます' }
  }

  await prisma.scheduledPost.update({
    where: { id },
    data: { status: 'cancelled' },
  })

  revalidatePath('/posts/scheduled')
  return { success: true }
}

/**
 * 予約投稿を公開（バッチ処理用）
 */
export async function publishScheduledPosts() {
  const now = new Date()

  // 公開時刻を過ぎた予約投稿を取得
  const scheduledPosts = await prisma.scheduledPost.findMany({
    where: {
      status: 'pending',
      scheduledAt: { lte: now },
    },
    include: {
      media: { orderBy: { sortOrder: 'asc' } },
      genres: true,
    },
  })

  let publishedCount = 0
  let failedCount = 0

  for (const scheduled of scheduledPosts) {
    try {
      // 投稿を作成
      const post = await prisma.post.create({
        data: {
          userId: scheduled.userId,
          content: scheduled.content,
          media: scheduled.media.length > 0 ? {
            create: scheduled.media.map((m) => ({
              url: m.url,
              type: m.type,
              sortOrder: m.sortOrder,
            })),
          } : undefined,
          genres: scheduled.genres.length > 0 ? {
            create: scheduled.genres.map((g) => ({
              genreId: g.genreId,
            })),
          } : undefined,
        },
      })

      // 予約投稿のステータスを更新
      await prisma.scheduledPost.update({
        where: { id: scheduled.id },
        data: {
          status: 'published',
          publishedPostId: post.id,
        },
      })

      publishedCount++
    } catch (error) {
      console.error(`Failed to publish scheduled post ${scheduled.id}:`, error)
      // エラー時はステータスを失敗に
      await prisma.scheduledPost.update({
        where: { id: scheduled.id },
        data: { status: 'failed' },
      })
      failedCount++
    }
  }

  return { published: publishedCount, failed: failedCount }
}
