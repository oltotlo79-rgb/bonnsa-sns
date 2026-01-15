'use server'

import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

// レビュー投稿
export async function createReview(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  const shopId = formData.get('shopId') as string
  const ratingStr = formData.get('rating') as string
  const content = formData.get('content') as string | null
  const imageUrls = formData.getAll('imageUrls') as string[]

  // バリデーション
  if (!shopId) {
    return { error: '盆栽園IDが必要です' }
  }

  const rating = parseInt(ratingStr, 10)
  if (isNaN(rating) || rating < 1 || rating > 5) {
    return { error: '評価は1〜5の間で選択してください' }
  }

  // 画像は3枚まで
  if (imageUrls.length > 3) {
    return { error: '画像は3枚までです' }
  }

  // 盆栽園の存在確認
  const shop = await prisma.bonsaiShop.findUnique({
    where: { id: shopId },
  })

  if (!shop) {
    return { error: '盆栽園が見つかりません' }
  }

  // 既にレビュー済みかチェック
  const existingReview = await prisma.shopReview.findFirst({
    where: {
      shopId,
      userId: session.user.id,
    },
  })

  if (existingReview) {
    return { error: 'この盆栽園には既にレビューを投稿しています' }
  }

  const review = await prisma.shopReview.create({
    data: {
      shopId,
      userId: session.user.id,
      rating,
      content: content?.trim() || null,
      images: imageUrls.length > 0
        ? {
            create: imageUrls.map((url) => ({ url })),
          }
        : undefined,
    },
  })

  revalidatePath(`/shops/${shopId}`)
  return { success: true, reviewId: review.id }
}

// レビュー削除
export async function deleteReview(reviewId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // 所有者確認
  const review = await prisma.shopReview.findUnique({
    where: { id: reviewId },
    select: { userId: true, shopId: true },
  })

  if (!review) {
    return { error: 'レビューが見つかりません' }
  }

  if (review.userId !== session.user.id) {
    return { error: '削除権限がありません' }
  }

  await prisma.shopReview.delete({
    where: { id: reviewId },
  })

  revalidatePath(`/shops/${review.shopId}`)
  return { success: true }
}

// レビュー一覧取得
export async function getReviews(shopId: string, cursor?: string, limit = 10) {
  const reviews = await prisma.shopReview.findMany({
    where: { shopId },
    include: {
      user: {
        select: { id: true, nickname: true, avatarUrl: true },
      },
      images: true,
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1,
    }),
  })

  const hasMore = reviews.length === limit

  return {
    reviews,
    nextCursor: hasMore ? reviews[reviews.length - 1]?.id : undefined,
  }
}

// レビュー画像アップロード
export async function uploadReviewImage(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  const file = formData.get('file') as File
  if (!file) {
    return { error: 'ファイルが選択されていません' }
  }

  if (!file.type.startsWith('image/')) {
    return { error: '画像ファイルを選択してください' }
  }

  // ファイルサイズチェック（5MB）
  if (file.size > 5 * 1024 * 1024) {
    return { error: '画像は5MB以下にしてください' }
  }

  // ストレージにアップロード
  const { uploadFile } = await import('@/lib/storage')
  const buffer = Buffer.from(await file.arrayBuffer())

  const result = await uploadFile(buffer, file.name, file.type, 'review-images')

  if (!result.success || !result.url) {
    return { error: result.error || 'アップロードに失敗しました' }
  }

  return { success: true, url: result.url }
}
