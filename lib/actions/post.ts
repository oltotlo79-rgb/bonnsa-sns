'use server'

import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const createPostSchema = z.object({
  content: z.string().max(500, '投稿は500文字以内で入力してください').optional(),
  genreIds: z.array(z.string()).max(3, 'ジャンルは3つまで選択できます'),
})

export async function createPost(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  const content = formData.get('content') as string
  const genreIds = formData.getAll('genreIds') as string[]
  const mediaUrls = formData.getAll('mediaUrls') as string[]
  const mediaType = formData.get('mediaType') as string | null

  // バリデーション
  if (!content && mediaUrls.length === 0) {
    return { error: 'テキストまたはメディアを入力してください' }
  }

  const result = createPostSchema.safeParse({ content, genreIds })
  if (!result.success) {
    return { error: result.error.issues[0].message }
  }

  // 投稿制限チェック（1日20件）
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const count = await prisma.post.count({
    where: {
      userId: session.user.id,
      createdAt: { gte: today },
    },
  })

  if (count >= 20) {
    return { error: '1日の投稿上限（20件）に達しました' }
  }

  // 投稿作成
  const post = await prisma.post.create({
    data: {
      userId: session.user.id,
      content: content || null,
      media: mediaUrls.length > 0 ? {
        create: mediaUrls.map((url, index) => ({
          url,
          type: mediaType || 'image',
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

  revalidatePath('/feed')
  return { success: true, postId: post.id }
}

export async function createQuotePost(formData: FormData, quotePostId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  const content = formData.get('content') as string

  if (!content) {
    return { error: '引用コメントを入力してください' }
  }

  if (content.length > 500) {
    return { error: '投稿は500文字以内で入力してください' }
  }

  // 投稿制限チェック
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const count = await prisma.post.count({
    where: {
      userId: session.user.id,
      createdAt: { gte: today },
    },
  })

  if (count >= 20) {
    return { error: '1日の投稿上限（20件）に達しました' }
  }

  const post = await prisma.post.create({
    data: {
      userId: session.user.id,
      content,
      quotePostId,
    },
  })

  revalidatePath('/feed')
  return { success: true, postId: post.id }
}

export async function createRepost(postId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // 既にリポスト済みかチェック
  const existing = await prisma.post.findFirst({
    where: {
      userId: session.user.id,
      repostPostId: postId,
    },
  })

  if (existing) {
    // リポスト解除
    await prisma.post.delete({ where: { id: existing.id } })
    revalidatePath('/feed')
    return { success: true, reposted: false }
  }

  // 投稿制限チェック
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const count = await prisma.post.count({
    where: {
      userId: session.user.id,
      createdAt: { gte: today },
    },
  })

  if (count >= 20) {
    return { error: '1日の投稿上限（20件）に達しました' }
  }

  await prisma.post.create({
    data: {
      userId: session.user.id,
      repostPostId: postId,
    },
  })

  revalidatePath('/feed')
  return { success: true, reposted: true }
}

export async function deletePost(postId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // 投稿の所有者確認
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { userId: true },
  })

  if (!post || post.userId !== session.user.id) {
    return { error: '削除権限がありません' }
  }

  await prisma.post.delete({ where: { id: postId } })

  revalidatePath('/feed')
  return { success: true }
}

export async function getPost(postId: string) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: {
      user: {
        select: { id: true, nickname: true, avatarUrl: true },
      },
      media: {
        orderBy: { sortOrder: 'asc' },
      },
      genres: {
        include: {
          genre: true,
        },
      },
      _count: {
        select: { likes: true, comments: true },
      },
      quotePost: {
        include: {
          user: {
            select: { id: true, nickname: true, avatarUrl: true },
          },
        },
      },
      repostPost: {
        include: {
          user: {
            select: { id: true, nickname: true, avatarUrl: true },
          },
          media: {
            orderBy: { sortOrder: 'asc' },
          },
        },
      },
    },
  })

  if (!post) {
    return { error: '投稿が見つかりません' }
  }

  return {
    post: {
      ...post,
      likeCount: post._count.likes,
      commentCount: post._count.comments,
      genres: post.genres.map((pg) => pg.genre),
    },
  }
}

export async function getPosts(cursor?: string, limit = 20) {
  const posts = await prisma.post.findMany({
    include: {
      user: {
        select: { id: true, nickname: true, avatarUrl: true },
      },
      media: {
        orderBy: { sortOrder: 'asc' },
      },
      genres: {
        include: {
          genre: true,
        },
      },
      _count: {
        select: { likes: true, comments: true },
      },
      quotePost: {
        include: {
          user: {
            select: { id: true, nickname: true, avatarUrl: true },
          },
        },
      },
      repostPost: {
        include: {
          user: {
            select: { id: true, nickname: true, avatarUrl: true },
          },
          media: {
            orderBy: { sortOrder: 'asc' },
          },
        },
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
    posts: posts.map((post) => ({
      ...post,
      likeCount: post._count.likes,
      commentCount: post._count.comments,
      genres: post.genres.map((pg) => pg.genre),
    })),
  }
}

export async function getGenres() {
  const genres = await prisma.genre.findMany({
    orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
  })

  // カテゴリごとにグループ化
  const grouped = genres.reduce((acc, genre) => {
    if (!acc[genre.category]) {
      acc[genre.category] = []
    }
    acc[genre.category].push(genre)
    return acc
  }, {} as Record<string, typeof genres>)

  return { genres: grouped }
}

export async function uploadPostMedia(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  const file = formData.get('file') as File
  if (!file) {
    return { error: 'ファイルが選択されていません' }
  }

  const isVideo = file.type.startsWith('video/')
  const isImage = file.type.startsWith('image/')

  if (!isVideo && !isImage) {
    return { error: '画像または動画ファイルを選択してください' }
  }

  // ファイルサイズチェック
  const maxSize = isVideo ? 512 * 1024 * 1024 : 5 * 1024 * 1024
  if (file.size > maxSize) {
    return { error: isVideo ? '動画は512MB以下にしてください' : '画像は5MB以下にしてください' }
  }

  // TODO: Azure Blob Storageへのアップロード実装
  const ext = file.name.split('.').pop()
  const folder = isVideo ? 'post-videos' : 'post-images'
  const publicUrl = `/uploads/${folder}/${session.user.id}-${Date.now()}.${ext}`

  return {
    success: true,
    url: publicUrl,
    type: isVideo ? 'video' : 'image',
  }
}
